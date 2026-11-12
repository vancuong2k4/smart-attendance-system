import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { managerApprovalSchema } from '@/lib/shift-validation'
import { UserRole, ShiftSwapStatus } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/schedules/swaps/[id]/approve
 * Quản trị viên phê duyệt hoặc từ chối đơn đổi ca (Tự động hoán đổi phân ca khi duyệt)
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    const isBranchAdmin = session.user.role === UserRole.BRANCH_ADMIN

    if (!isSuperAdmin && !isBranchAdmin) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xét duyệt đơn đổi ca', 403)
    }

    const { id } = await context.params

    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, fullName: true, branchId: true } },
        targetEmployee: { select: { id: true, fullName: true, branchId: true } },
      },
    })

    if (!swap) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn đổi ca yêu cầu', 404)
    }

    if (isBranchAdmin && session.user.employee?.branchId !== swap.requester.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được duyệt đơn đổi ca của chi nhánh mình',
        403
      )
    }

    if (swap.status !== ShiftSwapStatus.PENDING_MANAGER) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        'Đơn đổi ca này chưa được đồng nghiệp chấp thuận hoặc đã được xử lý trước đó',
        400
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = managerApprovalSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const { action, rejectReason } = validation.data

    if (action === 'APPROVE') {
      // Thực hiện hoán đổi phân ca làm việc trong transaction
      await prisma.$transaction([
        // 1. Cập nhật phân ca cho Người yêu cầu (Requester) nhận ca của Target
        prisma.shiftAssignment.upsert({
          where: {
            employeeId_date: {
              employeeId: swap.requesterId,
              date: swap.targetDate,
            },
          },
          create: {
            employeeId: swap.requesterId,
            scheduleId: swap.targetScheduleId,
            date: swap.targetDate,
            note: `Đổi ca từ ${swap.targetEmployee.fullName}`,
            assignedById: session.user.id,
          },
          update: {
            scheduleId: swap.targetScheduleId,
            note: `Đổi ca từ ${swap.targetEmployee.fullName}`,
            assignedById: session.user.id,
          },
        }),

        // 2. Cập nhật phân ca cho Đồng nghiệp (Target Employee) nhận ca của Requester
        prisma.shiftAssignment.upsert({
          where: {
            employeeId_date: {
              employeeId: swap.targetEmployeeId,
              date: swap.requesterDate,
            },
          },
          create: {
            employeeId: swap.targetEmployeeId,
            scheduleId: swap.requesterScheduleId,
            date: swap.requesterDate,
            note: `Đổi ca từ ${swap.requester.fullName}`,
            assignedById: session.user.id,
          },
          update: {
            scheduleId: swap.requesterScheduleId,
            note: `Đổi ca từ ${swap.requester.fullName}`,
            assignedById: session.user.id,
          },
        }),

        // 3. Cập nhật trạng thái đơn thành APPROVED
        prisma.shiftSwapRequest.update({
          where: { id },
          data: {
            status: ShiftSwapStatus.APPROVED,
            approvedById: session.user.id,
            approvedAt: new Date(),
          },
        }),
      ])

      const result = await prisma.shiftSwapRequest.findUnique({ where: { id } })
      return successResponse(result)
    } else {
      const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          status: ShiftSwapStatus.REJECTED,
          rejectReason: rejectReason || 'Quản lý từ chối yêu cầu đổi ca',
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      })
      return successResponse(updated)
    }
  } catch (error: any) {
    console.error('Error approving/rejecting shift swap:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể xử lý xét duyệt đơn đổi ca',
      500
    )
  }
}
