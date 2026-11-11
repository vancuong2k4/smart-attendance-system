import { prisma } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { formatVietnamDateDisplay, formatVietnamTime } from '@/lib/attendance'

export interface CreateNotificationParams {
  employeeId: string
  type: string
  title: string
  message: string
  link?: string | null
}

export interface NotifyRolesParams {
  roles: UserRole[]
  branchId?: string
  excludeEmployeeId?: string
  type: string
  title: string
  message: string
  link?: string | null
}

/**
 * Tạo 1 thông báo an toàn cho một nhân viên cụ thể.
 * Hỗ trợ truyền Prisma Client hoặc Prisma Transaction client.
 */
export async function createNotification(
  params: CreateNotificationParams,
  client: any = prisma
) {
  try {
    if (!client?.notification?.create) {
      return null
    }

    return await client.notification.create({
      data: {
        employeeId: params.employeeId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
      },
    })
  } catch (error) {
    console.error('[Notification] Failed to create single notification:', error)
    return null
  }
}

/**
 * Gửi thông báo đến danh sách nhân viên có vai trò phù hợp (Branch Admin, HR Manager, Super Admin).
 */
export async function createNotificationsForRoles(
  params: NotifyRolesParams,
  client: any = prisma
) {
  try {
    if (!client?.employee?.findMany) {
      return []
    }

    const { roles, branchId, excludeEmployeeId, type, title, message, link } = params

    // Xây dựng điều kiện tìm kiếm nhân sự nhận thông báo
    const roleConditions: any[] = []

    if (roles.includes(UserRole.BRANCH_ADMIN)) {
      roleConditions.push({
        user: { role: UserRole.BRANCH_ADMIN, isActive: true },
        ...(branchId ? { branchId } : {}),
      })
    }

    const globalRoles = roles.filter(
      (r) => r === UserRole.HR_MANAGER || r === UserRole.SUPER_ADMIN
    )
    if (globalRoles.length > 0) {
      roleConditions.push({
        user: { role: { in: globalRoles }, isActive: true },
      })
    }

    if (roleConditions.length === 0) {
      return []
    }

    const employees = await client.employee.findMany({
      where: {
        OR: roleConditions,
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
      select: { id: true },
    })

    if (!employees || employees.length === 0) {
      return []
    }

    const notifData = employees.map((emp: { id: string }) => ({
      employeeId: emp.id,
      type,
      title,
      message,
      link: link ?? null,
    }))

    if (typeof client.notification?.createMany === 'function') {
      await client.notification.createMany({
        data: notifData,
      })
      return notifData
    }

    if (typeof client.notification?.create === 'function') {
      const created = await Promise.all(
        notifData.map((data: any) =>
          client.notification.create({ data }).catch((err: any) => {
            console.error('[Notification] Error creating individual notification:', err)
            return null
          })
        )
      )
      return created.filter(Boolean)
    }

    return []
  } catch (error) {
    console.error('[Notification] Failed to create notifications for roles:', error)
    return []
  }
}

/**
 * Thông báo khi nhân viên nộp đơn xin nghỉ phép
 */
export async function notifyLeaveSubmitted(
  params: {
    employeeId: string
    employeeName: string
    branchId: string
    leaveId: string
    startDate: Date | string
    endDate: Date | string
    totalDays: number
    leaveTypeName: string
  },
  client: any = prisma
) {
  const startStr = formatVietnamDateDisplay(params.startDate)
  const endStr = formatVietnamDateDisplay(params.endDate)

  return createNotificationsForRoles(
    {
      roles: [UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN],
      branchId: params.branchId,
      excludeEmployeeId: params.employeeId,
      type: 'LEAVE_SUBMITTED',
      title: 'Đơn xin nghỉ phép mới',
      message: `Nhân viên ${params.employeeName} đã nộp đơn xin nghỉ ${params.leaveTypeName} (${params.totalDays} ngày, từ ${startStr} đến ${endStr}).`,
      link: '/leaves',
    },
    client
  )
}

/**
 * Thông báo khi đơn nghỉ phép được phê duyệt hoặc bị từ chối
 */
export async function notifyLeaveDecision(
  params: {
    employeeId: string
    action: 'APPROVED' | 'REJECTED'
    startDate: Date | string
    endDate: Date | string
    rejectReason?: string | null
  },
  client: any = prisma
) {
  const startStr = formatVietnamDateDisplay(params.startDate)
  const endStr = formatVietnamDateDisplay(params.endDate)
  const isApproved = params.action === 'APPROVED'

  return createNotification(
    {
      employeeId: params.employeeId,
      type: isApproved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      title: isApproved ? 'Đơn nghỉ phép đã được phê duyệt' : 'Đơn nghỉ phép bị từ chối',
      message: isApproved
        ? `Đơn xin nghỉ phép từ ${startStr} đến ${endStr} đã được phê duyệt.`
        : `Đơn xin nghỉ phép từ ${startStr} đến ${endStr} đã bị từ chối.${
            params.rejectReason ? ` Lý do: ${params.rejectReason}` : ''
          }`,
      link: '/leaves',
    },
    client
  )
}

/**
 * Thông báo khi nhân viên đăng ký làm thêm giờ (OT)
 */
export async function notifyOvertimeSubmitted(
  params: {
    employeeId: string
    employeeName: string
    branchId: string
    otId: string
    date: Date | string
    hours: number
  },
  client: any = prisma
) {
  const dateStr = formatVietnamDateDisplay(params.date)

  return createNotificationsForRoles(
    {
      roles: [UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN],
      branchId: params.branchId,
      excludeEmployeeId: params.employeeId,
      type: 'OT_SUBMITTED',
      title: 'Yêu cầu làm thêm giờ mới',
      message: `Nhân viên ${params.employeeName} đã đăng ký làm thêm giờ (${params.hours}h) ngày ${dateStr}.`,
      link: '/leaves',
    },
    client
  )
}

/**
 * Thông báo khi yêu cầu làm thêm giờ được phê duyệt hoặc bị từ chối
 */
export async function notifyOvertimeDecision(
  params: {
    employeeId: string
    action: 'APPROVED' | 'REJECTED'
    date: Date | string
    hours: number
    rejectReason?: string | null
  },
  client: any = prisma
) {
  const dateStr = formatVietnamDateDisplay(params.date)
  const isApproved = params.action === 'APPROVED'

  return createNotification(
    {
      employeeId: params.employeeId,
      type: isApproved ? 'OT_APPROVED' : 'OT_REJECTED',
      title: isApproved ? 'Yêu cầu OT đã được duyệt' : 'Yêu cầu OT bị từ chối',
      message: isApproved
        ? `Yêu cầu làm thêm giờ ngày ${dateStr} (${params.hours}h) đã được duyệt.`
        : `Yêu cầu làm thêm giờ ngày ${dateStr} đã bị từ chối.${
            params.rejectReason ? ` Lý do: ${params.rejectReason}` : ''
          }`,
      link: '/leaves',
    },
    client
  )
}

/**
 * Thông báo khi nhân viên check-in thành công
 */
export async function notifyCheckInSuccess(
  params: {
    employeeId: string
    checkInTime?: Date | string | null
    isLate?: boolean | null
    lateMinutes?: number | null
  },
  client: any = prisma
) {
  const timeFormatted = formatVietnamTime(params.checkInTime || new Date())
  const isLate = Boolean(params.isLate)

  return createNotification(
    {
      employeeId: params.employeeId,
      type: 'ATTENDANCE_CHECKIN',
      title: isLate ? 'Chấm công vào (Đi muộn)' : 'Chấm công vào thành công',
      message: `Bạn đã check-in thành công lúc ${timeFormatted}.${
        isLate && params.lateMinutes
          ? ` Ghi nhận đi muộn ${params.lateMinutes} phút.`
          : ''
      }`,
      link: '/attendance',
    },
    client
  )
}

/**
 * Thông báo khi nhân viên nộp đơn giải trình chấm công bù
 */
export async function notifyAdjustmentSubmitted(
  params: {
    employeeId: string
    employeeName: string
    branchId: string
    adjustmentId: string
    date: Date | string
    typeLabel: string
  },
  client: any = prisma
) {
  const dateStr = formatVietnamDateDisplay(params.date)

  return createNotificationsForRoles(
    {
      roles: [UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER, UserRole.SUPER_ADMIN],
      branchId: params.branchId,
      excludeEmployeeId: params.employeeId,
      type: 'ADJUSTMENT_SUBMITTED',
      title: 'Đơn giải trình chấm công mới',
      message: `Nhân viên ${params.employeeName} đã nộp đơn giải trình (${params.typeLabel}) cho ngày ${dateStr}.`,
      link: '/attendance/manage',
    },
    client
  )
}

/**
 * Thông báo khi đơn giải trình chấm công được phê duyệt hoặc bị từ chối
 */
export async function notifyAdjustmentDecision(
  params: {
    employeeId: string
    action: 'APPROVED' | 'REJECTED'
    date: Date | string
    typeLabel: string
    rejectReason?: string | null
  },
  client: any = prisma
) {
  const dateStr = formatVietnamDateDisplay(params.date)
  const isApproved = params.action === 'APPROVED'

  return createNotification(
    {
      employeeId: params.employeeId,
      type: isApproved ? 'ADJUSTMENT_APPROVED' : 'ADJUSTMENT_REJECTED',
      title: isApproved
        ? 'Đơn giải trình bù công đã được duyệt'
        : 'Đơn giải trình bù công bị từ chối',
      message: isApproved
        ? `Đơn giải trình chấm công (${params.typeLabel}) ngày ${dateStr} đã được duyệt.`
        : `Đơn giải trình chấm công (${params.typeLabel}) ngày ${dateStr} đã bị từ chối.${
            params.rejectReason ? ` Lý do: ${params.rejectReason}` : ''
          }`,
      link: '/attendance',
    },
    client
  )
}

