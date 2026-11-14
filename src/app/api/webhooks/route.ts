import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { webhookSubscriptionSchema } from '@/lib/webhook-validation'
import { UserRole } from '@prisma/client'

/**
 * GET /api/webhooks
 * Lấy danh sách các Webhook Subscriptions kèm tỷ lệ gửi thành công
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền quản lý cấu hình webhook',
        403
      )
    }

    const where: any = {}
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmployee?.branchId) {
        where.OR = [{ branchId: null }, { branchId: adminEmployee.branchId }]
      }
    }

    const subscriptions = await prisma.webhookSubscription.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        deliveries: {
          select: { isSuccess: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const items = subscriptions.map((sub) => {
      const totalDeliveries = sub.deliveries.length
      const successCount = sub.deliveries.filter((d) => d.isSuccess).length
      const successRatePercent =
        totalDeliveries > 0 ? Math.round((successCount / totalDeliveries) * 100) : 100
      const lastDelivery = sub.deliveries[0] || null

      return {
        id: sub.id,
        name: sub.name,
        channel: sub.channel,
        url: sub.url,
        secret: sub.secret ? '••••••••' : null,
        events: sub.events,
        isActive: sub.isActive,
        branchId: sub.branchId,
        branchName: sub.branch?.name || 'Toàn công ty',
        metadata: sub.metadata,
        metrics: {
          totalDeliveries,
          successCount,
          successRatePercent,
          lastDeliveryAt: lastDelivery?.createdAt || null,
          lastDeliverySuccess: lastDelivery?.isSuccess ?? null,
        },
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      }
    })

    return successResponse(items)
  } catch (error: any) {
    console.error('Error fetching webhooks:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách webhook', 500)
  }
}

/**
 * POST /api/webhooks
 * Tạo mới Webhook Subscription
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền tạo webhook',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = webhookSubscriptionSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu webhook không hợp lệ',
        422,
        validation.error.issues
      )
    }

    const data = validation.data

    // Nếu là BRANCH_ADMIN, tự động gán branchId của họ
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (!adminEmployee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không gắn với chi nhánh nào', 403)
      }
      data.branchId = adminEmployee.branchId
    }

    const created = await prisma.webhookSubscription.create({
      data: {
        name: data.name,
        channel: data.channel,
        url: data.url,
        secret: data.secret || null,
        events: data.events,
        isActive: data.isActive ?? true,
        branchId: data.branchId || null,
        metadata: data.metadata || null,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return successResponse(created, 201)
  } catch (error: any) {
    console.error('Error creating webhook:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tạo webhook', 500)
  }
}
