import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { approveLeaveSchema } from '@/lib/validations'
import { canApproveRequests } from '@/lib/rbac'
import { AttendanceStatus, LeaveStatus, UserRole } from '@prisma/client'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canApproveRequests(session.user.role)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền phê duyệt đơn nghỉ phép',
        403
      )
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = approveLeaveSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { action, rejectReason } = parsed.data

    // 1. Tìm đơn xin nghỉ
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        leaveType: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            branchId: true,
            annualLeaveBalance: true,
            sickLeaveBalance: true,
          },
        },
      },
    })

    if (!leaveRequest) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn xin nghỉ phép', 404)
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Đơn này đã được xử lý hoặc đã hủy (trạng thái hiện tại: ${leaveRequest.status})`,
        400
      )
    }

    // 2. Branch Admin chỉ duyệt nhân viên chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (leaveRequest.employee.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền duyệt đơn cho nhân viên thuộc chi nhánh của mình',
          403
        )
      }
    }

    // 3. Xử lý APPROVE hoặc REJECT
    if (action === 'APPROVED') {
      // Nếu là phép năm (AL) hoặc nghỉ ốm (SL), kiểm tra số dư
      if (leaveRequest.leaveType.code === 'AL') {
        if (leaveRequest.employee.annualLeaveBalance < leaveRequest.totalDays) {
          return errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Số dư ngày phép năm không đủ (còn ${leaveRequest.employee.annualLeaveBalance} ngày, yêu cầu ${leaveRequest.totalDays} ngày)`,
            400
          )
        }
      } else if (leaveRequest.leaveType.code === 'SL') {
        if (leaveRequest.employee.sickLeaveBalance < leaveRequest.totalDays) {
          return errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Số dư ngày phép ốm không đủ (còn ${leaveRequest.employee.sickLeaveBalance} ngày, yêu cầu ${leaveRequest.totalDays} ngày)`,
            400
          )
        }
      }

      // Thực hiện cập nhật đơn và trừ ngày phép trong transaction
      const updatedLeave = await prisma.$transaction(async (tx) => {
        // Trừ ngày phép tương ứng
        if (leaveRequest.leaveType.code === 'AL') {
          await tx.employee.update({
            where: { id: leaveRequest.employeeId },
            data: {
              annualLeaveBalance: {
                decrement: leaveRequest.totalDays,
              },
            },
          })
        } else if (leaveRequest.leaveType.code === 'SL') {
          await tx.employee.update({
            where: { id: leaveRequest.employeeId },
            data: {
              sickLeaveBalance: {
                decrement: leaveRequest.totalDays,
              },
            },
          })
        }

        // Cập nhật đơn
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.APPROVED,
            approvedById: session.user.id,
            approvedAt: new Date(),
            rejectReason: null,
          },
          include: {
            leaveType: true,
            employee: true,
          },
        })

        // Cập nhật AttendanceRecord cho các ngày làm việc (T2 - T6)
        const curDate = new Date(leaveRequest.startDate.getTime())
        const endDate = new Date(leaveRequest.endDate.getTime())

        while (curDate <= endDate) {
          const dayOfWeek = curDate.getUTCDay()
          // Chỉ ghi nhận chấm công cho các ngày trong tuần (T2 - T6)
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const dateOnly = new Date(curDate.getTime())
            await tx.attendanceRecord.upsert({
              where: {
                employeeId_date: {
                  employeeId: leaveRequest.employeeId,
                  date: dateOnly,
                },
              },
              update: {
                status: AttendanceStatus.LEAVE,
                workDays: leaveRequest.leaveType.isPaid ? 1 : 0,
                note: `Nghỉ phép: ${leaveRequest.leaveType.name}`,
              },
              create: {
                employeeId: leaveRequest.employeeId,
                date: dateOnly,
                status: AttendanceStatus.LEAVE,
                workDays: leaveRequest.leaveType.isPaid ? 1 : 0,
                note: `Nghỉ phép: ${leaveRequest.leaveType.name}`,
              },
            })
          }
          curDate.setUTCDate(curDate.getUTCDate() + 1)
        }

        // Tạo thông báo
        await tx.notification.create({
          data: {
            employeeId: leaveRequest.employeeId,
            type: 'LEAVE_APPROVED',
            title: 'Đơn nghỉ phép đã được phê duyệt',
            message: `Đơn xin nghỉ phép từ ${leaveRequest.startDate.toISOString().slice(0, 10)} đến ${leaveRequest.endDate.toISOString().slice(0, 10)} đã được phê duyệt.`,
          },
        })

        return updated
      })

      return successResponse(updatedLeave)
    } else {
      // REJECTED
      const updatedLeave = await prisma.$transaction(async (tx) => {
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.REJECTED,
            approvedById: session.user.id,
            approvedAt: new Date(),
            rejectReason: rejectReason || null,
          },
          include: {
            leaveType: true,
            employee: true,
          },
        })

        await tx.notification.create({
          data: {
            employeeId: leaveRequest.employeeId,
            type: 'LEAVE_REJECTED',
            title: 'Đơn nghỉ phép bị từ chối',
            message: `Đơn xin nghỉ phép từ ${leaveRequest.startDate.toISOString().slice(0, 10)} đến ${leaveRequest.endDate.toISOString().slice(0, 10)} đã bị từ chối.${
              rejectReason ? ` Lý do: ${rejectReason}` : ''
            }`,
          },
        })

        return updated
      })

      return successResponse(updatedLeave)
    }
  } catch (error: any) {
    console.error('Error approving/rejecting leave:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi xử lý duyệt đơn nghỉ phép',
      500
    )
  }
}
