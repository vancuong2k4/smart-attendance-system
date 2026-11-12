import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { ShiftSwapStatus, UserRole } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/schedules/swaps/[id]
 * Hủy yêu cầu đổi ca (chỉ khi đang ở trạng thái chờ)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await context.params
    const currentEmpId = session.user.employee?.id

    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id },
    })

    if (!swap) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn đổi ca', 404)
    }

    const isRequester = swap.requesterId === currentEmpId
    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN

    if (!isRequester && !isSuperAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền hủy đơn đổi ca này',
        403
      )
    }

    // Chỉ cho phép hủy khi đang chờ đồng nghiệp hoặc chờ quản lý
    const cancellableStatuses: ShiftSwapStatus[] = [
      ShiftSwapStatus.PENDING_PEER,
      ShiftSwapStatus.PENDING_MANAGER,
    ]

    if (!cancellableStatuses.includes(swap.status)) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        'Không thể hủy đơn đổi ca đã được phê duyệt hoặc đã kết thúc',
        400
      )
    }

    const cancelled = await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: ShiftSwapStatus.CANCELLED,
      },
    })

    return successResponse(cancelled)
  } catch (error: any) {
    console.error('Error cancelling shift swap:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể hủy đơn đổi ca',
      500
    )
  }
}
