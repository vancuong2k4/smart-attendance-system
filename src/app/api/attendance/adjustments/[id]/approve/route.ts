import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { approveAttendanceAdjustmentSchema } from '@/lib/validations'
import { canApproveRequests } from '@/lib/rbac'
import { applyAttendanceAdjustment, rejectAttendanceAdjustment } from '@/lib/attendance-adjustment'
import { AdjustmentStatus, UserRole } from '@prisma/client'

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
        'Bạn không có quyền phê duyệt đơn giải trình bù công',
        403
      )
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = approveAttendanceAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { action, rejectReason } = parsed.data

    const adjustment = await prisma.attendanceAdjustment.findUnique({
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

    if (!adjustment) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn giải trình', 404)
    }

    if (adjustment.status !== AdjustmentStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Đơn này đã được xử lý hoặc đã hủy (trạng thái: ${adjustment.status})`,
        400
      )
    }

    // Branch Admin chỉ duyệt nhân viên chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (adjustment.employee.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền phê duyệt đơn của nhân viên thuộc chi nhánh mình',
          403
        )
      }
    }

    const approverId = session.user.employee?.id || session.user.id

    if (action === 'APPROVED') {
      const result = await applyAttendanceAdjustment(prisma, id, approverId)
      return successResponse({
        message: 'Phê duyệt đơn giải trình bù công thành công',
        adjustment: result.adjustment,
        attendanceRecord: result.attendanceRecord,
      })
    } else {
      const updated = await rejectAttendanceAdjustment(prisma, id, approverId, rejectReason)
      return successResponse({
        message: 'Từ chối đơn giải trình bù công thành công',
        adjustment: updated,
      })
    }
  } catch (error: any) {
    console.error('Error approving attendance adjustment:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'Lỗi hệ thống khi phê duyệt đơn giải trình',
      500
    )
  }
}
