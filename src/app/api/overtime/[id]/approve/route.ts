import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { approveOvertimeSchema } from '@/lib/validations'
import { canApproveRequests } from '@/lib/rbac'
import { LeaveStatus, UserRole } from '@prisma/client'

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
        'Bạn không có quyền phê duyệt làm thêm giờ (OT)',
        403
      )
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = approveOvertimeSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { action, rejectReason } = parsed.data

    const otRequest = await prisma.overtimeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            branchId: true,
          },
        },
      },
    })

    if (!otRequest) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy yêu cầu làm thêm giờ', 404)
    }

    if (otRequest.status !== LeaveStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Yêu cầu này đã được xử lý (trạng thái: ${otRequest.status})`,
        400
      )
    }

    // Branch Admin chỉ được duyệt nhân viên trong chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (otRequest.employee.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền duyệt yêu cầu OT cho nhân viên chi nhánh mình',
          403
        )
      }
    }

    const updatedOt = await prisma.$transaction(async (tx) => {
      const updated = await tx.overtimeRequest.update({
        where: { id },
        data: {
          status: action === 'APPROVED' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
          approvedById: session.user.id,
          approvedAt: new Date(),
          rejectReason: action === 'REJECTED' ? rejectReason || null : null,
        },
        include: {
          employee: true,
        },
      })

      await tx.notification.create({
        data: {
          employeeId: otRequest.employeeId,
          type: action === 'APPROVED' ? 'OT_APPROVED' : 'OT_REJECTED',
          title: action === 'APPROVED' ? 'Yêu cầu OT đã được duyệt' : 'Yêu cầu OT bị từ chối',
          message:
            action === 'APPROVED'
              ? `Yêu cầu làm thêm giờ ngày ${otRequest.date.toISOString().slice(0, 10)} (${otRequest.hours}h) đã được duyệt.`
              : `Yêu cầu làm thêm giờ ngày ${otRequest.date.toISOString().slice(0, 10)} đã bị từ chối.${
                  rejectReason ? ` Lý do: ${rejectReason}` : ''
                }`,
        },
      })

      return updated
    })

    return successResponse(updatedOt)
  } catch (error: any) {
    console.error('Error approving/rejecting overtime request:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi xử lý duyệt yêu cầu làm thêm giờ',
      500
    )
  }
}
