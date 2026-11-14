import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { deliverWebhook, WebhookEvents } from '@/lib/webhooks'
import { UserRole } from '@prisma/client'

/**
 * POST /api/webhooks/[id]/test
 * Gửi một gói tin thử nghiệm (Test Ping) đến endpoint webhook để kiểm tra kết nối
 */
export async function POST(
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
      return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền thử nghiệm webhook', 403)
    }

    const { id } = await params
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true } },
      },
    })

    if (!subscription) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy webhook subscription', 404)
    }

    // RBAC check
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (subscription.branchId && subscription.branchId !== adminEmployee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền thử nghiệm webhook chi nhánh khác', 403)
      }
    }

    // Tạo sample payload sinh động
    const testPayload = {
      title: 'Kiểm tra kết nối Webhook thành công',
      message: 'Hệ thống Smart Attendance gửi thử nghiệm gói tin webhook kết nối an toàn.',
      employeeName: 'Nguyễn Quản Trị (Admin Test)',
      employeeCode: 'ADMIN-TEST',
      branchName: subscription.branch?.name || 'Trụ sở chính',
      time: new Date().toLocaleTimeString('vi-VN'),
      isTest: true,
      sender: session.user.email,
    }

    // Gửi thử nghiệm
    const deliveryResult = await deliverWebhook(
      subscription,
      WebhookEvents.ATTENDANCE_CHECK_IN,
      testPayload
    )

    return successResponse({
      message: deliveryResult.isSuccess
        ? 'Gửi thử nghiệm thành công!'
        : 'Gửi thử nghiệm thất bại',
      ...deliveryResult,
    })
  } catch (error: any) {
    console.error('Error testing webhook:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể kiểm tra webhook', 500)
  }
}
