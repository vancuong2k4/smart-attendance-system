import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { UserRole } from '@prisma/client'

/**
 * GET /api/webhooks/[id]/deliveries
 * Lấy lịch sử các lần phát webhook gần nhất của subscription
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền truy cập lịch sử phát', 403)
    }

    const { id } = await params
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id },
      select: { id: true, name: true, branchId: true },
    })

    if (!subscription) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy webhook subscription', 404)
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (subscription.branchId && subscription.branchId !== adminEmployee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền xem lịch sử chi nhánh khác', 403)
      }
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    const deliveries = await prisma.webhookDeliveryLog.findMany({
      where: { subscriptionId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return successResponse({
      subscriptionId: id,
      subscriptionName: subscription.name,
      deliveries,
      totalReturned: deliveries.length,
    })
  } catch (error: any) {
    console.error('Error fetching webhook deliveries:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải lịch sử phát webhook', 500)
  }
}
