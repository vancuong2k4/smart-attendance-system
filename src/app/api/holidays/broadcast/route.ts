import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { dispatchWebhookEvent, WebhookEvents } from '@/lib/webhooks'
import { createNotification } from '@/lib/notifications'
import { logAuditEvent } from '@/lib/audit'
import { UserRole } from '@prisma/client'

/**
 * POST /api/holidays/broadcast
 * Phát thông báo lịch nghỉ lễ / làm bù qua In-App Notification và Webhook đa kênh
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.HR_MANAGER,
      UserRole.BRANCH_ADMIN,
    ]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền phát thông báo lịch nghỉ lễ',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body?.holidayId) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Vui lòng cung cấp holidayId cần thông báo',
        400
      )
    }

    const holiday = await prisma.companyHoliday.findUnique({
      where: { id: body.holidayId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    if (!holiday) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ngày lễ', 404)
    }

    // Kiểm tra quyền đối với Branch Admin
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (holiday.branchId && holiday.branchId !== adminEmp?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền phát thông báo cho ngày lễ của chi nhánh khác',
          403
        )
      }
    }

    const sendInApp = body?.sendInApp !== false
    const sendWebhooks = body?.sendWebhooks !== false

    const startDateStr = new Date(holiday.date).toLocaleDateString('vi-VN')
    const endDateStr = holiday.endDate
      ? new Date(holiday.endDate).toLocaleDateString('vi-VN')
      : null
    const dateRangeStr = endDateStr ? `từ ${startDateStr} đến ${endDateStr}` : `vào ngày ${startDateStr}`

    const defaultTitle = `Thông báo: ${holiday.name}`
    const defaultMessage =
      body?.customMessage ||
      `Công ty xin thông báo lịch ${holiday.name} ${dateRangeStr}. Hệ số lương đi làm ngày này: ${holiday.payMultiplier * 100}%.`

    let notifiedEmployeesCount = 0

    // 1. Gửi thông báo trong hệ thống cho nhân viên
    if (sendInApp) {
      const employeeWhere: any = { isActive: true }
      if (holiday.branchId) {
        employeeWhere.branchId = holiday.branchId
      }

      const employees = await prisma.employee.findMany({
        where: employeeWhere,
        select: { id: true },
      })

      for (const emp of employees) {
        await createNotification({
          employeeId: emp.id,
          type: 'HOLIDAY_REMINDER',
          title: defaultTitle,
          message: defaultMessage,
          link: '/holidays',
        })
      }
      notifiedEmployeesCount = employees.length
    }

    // 2. Kích hoạt Webhook đa kênh (Telegram, Discord, Zalo)
    if (sendWebhooks) {
      await dispatchWebhookEvent(
        WebhookEvents.HOLIDAY_UPCOMING_REMINDER,
        {
          holidayId: holiday.id,
          name: holiday.name,
          code: holiday.code,
          type: holiday.type,
          date: holiday.date,
          endDate: holiday.endDate,
          isPaid: holiday.isPaid,
          payMultiplier: holiday.payMultiplier,
          branchName: holiday.branch?.name || 'Toàn công ty',
          message: defaultMessage,
        },
        holiday.branchId
      )
    }

    await logAuditEvent({
      userId: session.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entity: 'CompanyHoliday',
      entityId: holiday.id,
      newData: {
        action: 'BROADCAST_HOLIDAY',
        holidayName: holiday.name,
        notifiedEmployeesCount,
        sendWebhooks,
      },
    })

    return successResponse({
      message: `Đã phát thông báo lịch "${holiday.name}" thành công`,
      holidayId: holiday.id,
      notifiedEmployeesCount,
      sendWebhooks,
    })
  } catch (error: any) {
    console.error('Error broadcasting holiday announcement:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Lỗi khi phát thông báo lịch nghỉ lễ',
      500
    )
  }
}
