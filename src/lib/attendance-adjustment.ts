import { calculateLateMinutes, calculateEarlyLeaveMinutes, calculateWorkDays } from './gps'
import { calculateWorkDuration, toVietnamDate, WorkScheduleInfo } from './attendance'
import { AttendanceStatus } from '@prisma/client'

export interface AdjustmentMetrics {
  workDuration: number
  workDays: number
  lateMinutes: number
  isLate: boolean
  earlyMinutes: number
  isEarlyLeave: boolean
  status: AttendanceStatus
}

/**
 * Ghép chuỗi ngày YYYY-MM-DD và chuỗi giờ HH:mm theo múi giờ Việt Nam (UTC+7)
 * thành Date object UTC lưu trữ vào DB.
 */
export function combineDateAndTimeString(dateStr: string, timeStr: string): Date {
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const [year, month, day] = cleanDate.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  // Giờ VN là UTC+7 -> UTC = VN - 7
  return new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0))
}

/**
 * Lấy nhãn hiển thị tiếng Việt cho loại đơn giải trình bù công
 */
export function getAdjustmentTypeLabel(type: string): string {
  switch (type) {
    case 'FORGOT_CHECKIN':
      return 'Quên check-in'
    case 'FORGOT_CHECKOUT':
      return 'Quên check-out'
    case 'FORGOT_BOTH':
      return 'Quên cả check-in và check-out'
    case 'GPS_ERROR':
      return 'Lỗi định vị GPS'
    case 'BUSINESS_OUTSIDE':
      return 'Đi công tác ngoài văn phòng'
    default:
      return type
  }
}

/**
 * Lấy nhãn và màu sắc hiển thị cho trạng thái đơn giải trình
 */
export function getAdjustmentStatusLabel(status: string): {
  label: string
  color: string
} {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-200' }
    case 'APPROVED':
      return { label: 'Đã duyệt', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    case 'REJECTED':
      return { label: 'Đã từ chối', color: 'bg-rose-100 text-rose-800 border-rose-200' }
    case 'CANCELLED':
      return { label: 'Đã hủy', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' }
    default:
      return { label: status, color: 'bg-zinc-100 text-zinc-700 border-zinc-200' }
  }
}

/**
 * Kiểm tra tính hợp lệ của mốc thời gian đề xuất
 */
export function validateAdjustmentTimes(
  requestedCheckIn: Date | null | undefined,
  requestedCheckOut: Date | null | undefined
): { valid: boolean; error?: string } {
  if (!requestedCheckIn && !requestedCheckOut) {
    return {
      valid: false,
      error: 'Cần cung cấp ít nhất một mốc giờ check-in hoặc check-out đề xuất',
    }
  }

  if (requestedCheckIn && requestedCheckOut) {
    if (requestedCheckOut.getTime() <= requestedCheckIn.getTime()) {
      return {
        valid: false,
        error: 'Thời gian check-out đề xuất phải sau thời gian check-in đề xuất',
      }
    }
  }

  return { valid: true }
}

/**
 * Tính toán công, thời lượng làm việc, đi muộn, về sớm từ checkIn và checkOut
 */
export function calculateAdjustmentWorkMetrics(
  checkInTime: Date,
  checkOutTime: Date,
  schedule?: WorkScheduleInfo
): AdjustmentMetrics {
  const startTime = schedule?.startTime || '08:00'
  const endTime = schedule?.endTime || '17:00'
  const lunchStart = schedule?.lunchStart ?? '12:00'
  const lunchEnd = schedule?.lunchEnd ?? '13:00'
  const lateThreshold = schedule?.lateThreshold ?? 15
  const earlyThreshold = schedule?.earlyThreshold ?? 15

  const workDuration = calculateWorkDuration(checkInTime, checkOutTime, lunchStart, lunchEnd)
  const workDays = calculateWorkDays(workDuration)

  const lateMinutes = calculateLateMinutes(checkInTime, startTime)
  const isLate = lateMinutes > lateThreshold

  const earlyMinutes = calculateEarlyLeaveMinutes(checkOutTime, endTime)
  const isEarlyLeave = earlyMinutes > earlyThreshold

  let status: AttendanceStatus = AttendanceStatus.PRESENT
  if (workDays === 0.5) {
    status = AttendanceStatus.HALF_DAY
  } else if (workDays === 0) {
    status = AttendanceStatus.ABSENT
  }

  return {
    workDuration,
    workDays,
    lateMinutes,
    isLate,
    earlyMinutes,
    isEarlyLeave,
    status,
  }
}

export interface AdjustmentAuditOptions {
  userId?: string
  ipAddress?: string
}

/**
 * Xử lý duyệt đơn giải trình và đồng bộ bản ghi AttendanceRecord kèm AuditLog
 */
export async function applyAttendanceAdjustment(
  prismaClient: any,
  adjustmentId: string,
  approvedById: string,
  options?: AdjustmentAuditOptions
) {
  const adjustment = await prismaClient.attendanceAdjustment.findUnique({
    where: { id: adjustmentId },
    include: {
      employee: {
        include: {
          branch: {
            include: {
              schedules: {
                where: { isActive: true },
              },
            },
          },
        },
      },
    },
  })

  if (!adjustment) {
    throw new Error('Đơn giải trình không tồn tại')
  }

  if (adjustment.status !== 'PENDING') {
    throw new Error('Đơn giải trình đã được xử lý hoặc đã bị hủy')
  }

  const existingRecord = await prismaClient.attendanceRecord.findUnique({
    where: {
      employeeId_date: {
        employeeId: adjustment.employeeId,
        date: adjustment.date,
      },
    },
  })

  const effectiveCheckInTime: Date | null =
    adjustment.requestedCheckIn || existingRecord?.checkInTime || null
  const effectiveCheckOutTime: Date | null =
    adjustment.requestedCheckOut || existingRecord?.checkOutTime || null

  const schedule = adjustment.employee?.branch?.schedules?.[0] || {
    startTime: '08:00',
    endTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    lateThreshold: 15,
    earlyThreshold: 15,
  }

  let workDuration: number = 0
  let workDays: number = 0
  let isLate: boolean = false
  let lateMinutes: number = 0
  let isEarlyLeave: boolean = false
  let earlyMinutes: number = 0
  let attendanceStatus: AttendanceStatus = AttendanceStatus.PRESENT

  if (effectiveCheckInTime && effectiveCheckOutTime) {
    if (effectiveCheckOutTime.getTime() <= effectiveCheckInTime.getTime()) {
      throw new Error('Thời gian check-out phải sau thời gian check-in')
    }
    const metrics = calculateAdjustmentWorkMetrics(
      effectiveCheckInTime,
      effectiveCheckOutTime,
      schedule
    )
    workDuration = metrics.workDuration
    workDays = metrics.workDays
    lateMinutes = metrics.lateMinutes
    isLate = metrics.isLate
    earlyMinutes = metrics.earlyMinutes
    isEarlyLeave = metrics.isEarlyLeave
    attendanceStatus = metrics.status
  } else if (effectiveCheckInTime) {
    lateMinutes = calculateLateMinutes(effectiveCheckInTime, schedule.startTime || '08:00')
    isLate = lateMinutes > (schedule.lateThreshold ?? 15)
    attendanceStatus = AttendanceStatus.PRESENT
  } else if (effectiveCheckOutTime) {
    earlyMinutes = calculateEarlyLeaveMinutes(effectiveCheckOutTime, schedule.endTime || '17:00')
    isEarlyLeave = earlyMinutes > (schedule.earlyThreshold ?? 15)
    attendanceStatus = AttendanceStatus.HALF_DAY
  }

  const now = new Date()
  const noteSuffix = `[Duyệt giải trình: ${getAdjustmentTypeLabel(adjustment.type)}] ${adjustment.reason}`
  const updatedNote = existingRecord?.note
    ? `${existingRecord.note} | ${noteSuffix}`
    : noteSuffix

  const txOps: any[] = [
    prismaClient.attendanceAdjustment.update({
      where: { id: adjustmentId },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: now,
      },
    }),
    prismaClient.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: adjustment.employeeId,
          date: adjustment.date,
        },
      },
      update: {
        checkInTime: effectiveCheckInTime,
        checkInMethod: 'MANUAL',
        checkOutTime: effectiveCheckOutTime,
        checkOutMethod: 'MANUAL',
        isManualEntry: true,
        workDuration,
        workDays,
        isLate,
        lateMinutes,
        isEarlyLeave,
        earlyMinutes,
        status: attendanceStatus,
        approvedById,
        approvedAt: now,
        note: updatedNote,
      },
      create: {
        employeeId: adjustment.employeeId,
        date: adjustment.date,
        checkInTime: effectiveCheckInTime,
        checkInMethod: 'MANUAL',
        checkOutTime: effectiveCheckOutTime,
        checkOutMethod: 'MANUAL',
        isManualEntry: true,
        workDuration,
        workDays,
        isLate,
        lateMinutes,
        isEarlyLeave,
        earlyMinutes,
        status: attendanceStatus,
        approvedById,
        approvedAt: now,
        note: updatedNote,
      },
    }),
  ]

  if (prismaClient.auditLog?.create) {
    txOps.push(
      prismaClient.auditLog.create({
        data: {
          userId: options?.userId || approvedById,
          action: 'APPROVE_ATTENDANCE_ADJUSTMENT',
          entity: 'AttendanceAdjustment',
          entityId: adjustmentId,
          oldData: {
            status: adjustment.status,
            previousAttendance: existingRecord
              ? {
                  checkInTime: existingRecord.checkInTime,
                  checkOutTime: existingRecord.checkOutTime,
                  workDuration: existingRecord.workDuration,
                  workDays: existingRecord.workDays,
                  status: existingRecord.status,
                }
              : null,
          },
          newData: {
            status: 'APPROVED',
            approvedById,
            effectiveCheckInTime,
            effectiveCheckOutTime,
            workDuration,
            workDays,
            status: attendanceStatus,
            isManualEntry: true,
          },
          ipAddress: options?.ipAddress || null,
        },
      })
    )
  }

  const txResults = await prismaClient.$transaction(txOps)
  const updatedAdjustment = txResults[0]
  const attendanceRecord = txResults[1]

  return { adjustment: updatedAdjustment, attendanceRecord }
}

/**
 * Xử lý từ chối đơn giải trình kèm AuditLog
 */
export async function rejectAttendanceAdjustment(
  prismaClient: any,
  adjustmentId: string,
  approvedById: string,
  rejectReason?: string,
  options?: AdjustmentAuditOptions
) {
  const adjustment = await prismaClient.attendanceAdjustment.findUnique({
    where: { id: adjustmentId },
  })

  if (!adjustment) {
    throw new Error('Đơn giải trình không tồn tại')
  }

  if (adjustment.status !== 'PENDING') {
    throw new Error('Đơn giải trình đã được xử lý hoặc đã bị hủy')
  }

  const now = new Date()

  if (prismaClient.auditLog?.create) {
    const [updated] = await prismaClient.$transaction([
      prismaClient.attendanceAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'REJECTED',
          approvedById,
          approvedAt: now,
          rejectReason: rejectReason || null,
        },
      }),
      prismaClient.auditLog.create({
        data: {
          userId: options?.userId || approvedById,
          action: 'REJECT_ATTENDANCE_ADJUSTMENT',
          entity: 'AttendanceAdjustment',
          entityId: adjustmentId,
          oldData: { status: adjustment.status },
          newData: {
            status: 'REJECTED',
            approvedById,
            rejectReason: rejectReason || null,
          },
          ipAddress: options?.ipAddress || null,
        },
      }),
    ])
    return updated
  }

  return prismaClient.attendanceAdjustment.update({
    where: { id: adjustmentId },
    data: {
      status: 'REJECTED',
      approvedById,
      approvedAt: now,
      rejectReason: rejectReason || null,
    },
  })
}

/**
 * Hủy đơn giải trình (bởi chính nhân viên nộp hoặc Super Admin)
 */
export async function cancelAttendanceAdjustment(
  prismaClient: any,
  adjustmentId: string,
  employeeId: string,
  isSuperAdmin: boolean = false
) {
  const adjustment = await prismaClient.attendanceAdjustment.findUnique({
    where: { id: adjustmentId },
  })

  if (!adjustment) {
    throw new Error('Đơn giải trình không tồn tại')
  }

  if (adjustment.status !== 'PENDING') {
    throw new Error('Chỉ có thể hủy đơn đang ở trạng thái chờ duyệt')
  }

  if (adjustment.employeeId !== employeeId && !isSuperAdmin) {
    throw new Error('Bạn không có quyền hủy đơn giải trình này')
  }

  return prismaClient.attendanceAdjustment.update({
    where: { id: adjustmentId },
    data: {
      status: 'CANCELLED',
    },
  })
}
