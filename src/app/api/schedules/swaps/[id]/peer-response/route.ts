import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { peerResponseSchema } from '@/lib/shift-validation'
import { notifyShiftSwapPeerResponded } from '@/lib/notifications'
import { ShiftSwapStatus, SwapPeerStatus } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/schedules/swaps/[id]/peer-response
 * Đồng nghiệp chấp thuận hoặc từ chối yêu cầu đổi ca
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const currentEmpId = session.user.employee?.id
    if (!currentEmpId) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Yêu cầu tài khoản nhân viên', 403)
    }

    const { id } = await context.params

    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, fullName: true, branchId: true } },
        targetEmployee: { select: { id: true, fullName: true, branchId: true } },
      },
    })

    if (!swapRequest) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy yêu cầu đổi ca', 404)
    }

    // Chỉ đồng nghiệp mục tiêu mới được phản hồi
    if (swapRequest.targetEmployeeId !== currentEmpId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không phải là người nhận yêu cầu đổi ca này',
        403
      )
    }

    // Chỉ xử lý khi đang ở trạng thái chờ đồng nghiệp
    if (swapRequest.status !== ShiftSwapStatus.PENDING_PEER) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        'Yêu cầu đổi ca này không ở trạng thái chờ phản hồi',
        400
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = peerResponseSchema.safeParse(body)
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

    if (action === 'ACCEPT') {
      const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          peerStatus: SwapPeerStatus.ACCEPTED,
          status: ShiftSwapStatus.PENDING_MANAGER,
        },
      })

      // Gửi thông báo
      await notifyShiftSwapPeerResponded({
        requesterId: swapRequest.requesterId,
        peerName: swapRequest.targetEmployee.fullName,
        action: 'ACCEPTED',
        branchId: swapRequest.targetEmployee.branchId,
      })

      return successResponse(updated)
    } else {
      const updated = await prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          peerStatus: SwapPeerStatus.REJECTED,
          status: ShiftSwapStatus.REJECTED,
          rejectReason: rejectReason || 'Đồng nghiệp từ chối đổi ca',
        },
      })

      // Gửi thông báo
      await notifyShiftSwapPeerResponded({
        requesterId: swapRequest.requesterId,
        peerName: swapRequest.targetEmployee.fullName,
        action: 'REJECTED',
        branchId: swapRequest.targetEmployee.branchId,
        rejectReason: rejectReason || 'Đồng nghiệp từ chối đổi ca',
      })

      return successResponse(updated)
    }
  } catch (error: any) {
    console.error('Error handling peer response to shift swap:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể xử lý phản hồi đổi ca',
      500
    )
  }
}
