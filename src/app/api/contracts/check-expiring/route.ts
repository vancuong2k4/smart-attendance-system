import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { calculateDaysRemaining, getExpirationUrgency } from '@/lib/contracts'
import { createNotification, createNotificationsForRoles } from '@/lib/notifications'
import { dispatchWebhookEvent, WebhookEvents } from '@/lib/webhooks'
import { UserRole, ContractStatus } from '@prisma/client'

/**
 * POST /api/contracts/check-expiring
 * Quét các hợp đồng lao động sắp hết hạn, tự động gửi thông báo hệ thống và kích hoạt Webhook
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
        'Bạn không có quyền thực hiện quét hợp đồng hết hạn',
        403
      )
    }

    const body = await req.json().catch(() => ({}))
    const daysThreshold = typeof body?.daysThreshold === 'number' ? body.daysThreshold : 30
    const sendNotifications = body?.sendNotifications !== false
    const dispatchWebhooks = body?.dispatchWebhooks !== false

    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysThreshold)

    const where: any = {
      status: ContractStatus.ACTIVE,
      endDate: {
        gte: now,
        lte: targetDate,
      },
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId) {
        where.employee = { branchId: adminEmp.branchId }
      }
    }

    const expiringContracts = await prisma.employmentContract.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            branchId: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { endDate: 'asc' },
    })

    const processedList: any[] = []

    for (const contract of expiringContracts) {
      const daysRemaining = calculateDaysRemaining(contract.endDate, now)
      const urgency = getExpirationUrgency(daysRemaining)

      if (sendNotifications) {
        // Thông báo cho nhân viên
        await createNotification({
          employeeId: contract.employee.id,
          type: 'CONTRACT_EXPIRING_WARNING',
          title: 'Hợp đồng lao động sắp hết hạn',
          message: `Hợp đồng số ${contract.contractNumber} của bạn sẽ hết hạn sau ${daysRemaining} ngày (${contract.endDate?.toLocaleDateString('vi-VN')}). Vui lòng liên hệ phòng Nhân sự.`,
          link: '/contracts',
        })

        // Thông báo cho HR và Quản trị viên
        await createNotificationsForRoles({
          roles: [UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN],
          branchId: contract.employee.branchId,
          excludeEmployeeId: contract.employee.id,
          type: 'CONTRACT_EXPIRING_HR_ALERT',
          title: `Cảnh báo hợp đồng sắp hết hạn (${daysRemaining} ngày)`,
          message: `Hợp đồng của nhân viên ${contract.employee.fullName} (${contract.contractNumber}) sẽ hết hạn vào ${contract.endDate?.toLocaleDateString('vi-VN')}.`,
          link: '/contracts',
        })
      }

      if (dispatchWebhooks) {
        await dispatchWebhookEvent(
          WebhookEvents.CONTRACT_EXPIRING,
          {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            employeeId: contract.employee.id,
            employeeName: contract.employee.fullName,
            employeeCode: contract.employee.employeeCode,
            branchName: contract.employee.branch?.name,
            daysRemaining,
            endDate: contract.endDate,
            urgency,
          },
          contract.employee.branchId
        )
      }

      processedList.push({
        id: contract.id,
        contractNumber: contract.contractNumber,
        employeeName: contract.employee.fullName,
        employeeCode: contract.employee.employeeCode,
        daysRemaining,
        urgency,
        endDate: contract.endDate,
      })
    }

    return successResponse({
      message: `Đã quét và xử lý cảnh báo cho ${processedList.length} hợp đồng sắp hết hạn`,
      totalExpiring: processedList.length,
      daysThreshold,
      items: processedList,
    })
  } catch (error) {
    console.error('Error checking expiring contracts:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Lỗi trong quá trình quét hợp đồng sắp hết hạn',
      500
    )
  }
}
