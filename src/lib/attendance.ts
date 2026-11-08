import { calculateLateMinutes, calculateEarlyLeaveMinutes, calculateWorkDays } from './gps'

/**
 * Trả về chuỗi ngày 'YYYY-MM-DD' theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
export function getVietnamDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

/**
 * Kiểm tra chuỗi ngày có đúng định dạng YYYY-MM-DD và hợp lệ không
 */
export function isValidDateString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr)
}

/**
 * Chuyển đổi timestamp sang Date biểu diễn thời gian Việt Nam (UTC+7)
 * Dùng getUTCHours(), getUTCMinutes(), getUTCDate(), v.v. để lấy các thành phần giờ VN
 */
export function toVietnamDate(date: Date = new Date()): Date {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
}

/**
 * Chuyển chuỗi 'YYYY-MM-DD' thành Date object UTC tại 00:00:00 cho Prisma @db.Date
 */
export function parseDateOnly(dateStr: string): Date {
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  return new Date(`${cleanStr}T00:00:00.000Z`)
}

/**
 * Lấy Date object ngày hôm nay tại Việt Nam
 */
export function getTodayDate(): Date {
  return parseDateOnly(getVietnamDateString())
}

/**
 * Format thời gian theo giờ Việt Nam dạng HH:mm
 */
export function formatVietnamTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

/**
 * Format ngày theo định dạng Việt Nam DD/MM/YYYY
 */
export function formatVietnamDateDisplay(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

/**
 * Format thời lượng làm việc ra chuỗi thân thiện (VD: "8 giờ 5 phút")
 */
export function formatDuration(durationHours: number): string {
  const hours = Math.floor(durationHours)
  const minutes = Math.round((durationHours - hours) * 60)
  if (hours === 0) return `${minutes} phút`
  if (minutes === 0) return `${hours} giờ`
  return `${hours} giờ ${minutes} phút`
}

export interface WorkScheduleInfo {
  startTime: string
  endTime: string
  lunchStart?: string | null
  lunchEnd?: string | null
  lateThreshold?: number
  earlyThreshold?: number
}

/**
 * Tính toán kết quả Check-in
 */
export function calculateAttendanceCheckIn(
  checkInTime: Date,
  schedule: { startTime?: string; lateThreshold?: number }
) {
  const startTime = schedule.startTime || '08:00'
  const threshold = schedule.lateThreshold ?? 15
  const lateMinutes = calculateLateMinutes(checkInTime, startTime)
  const isLate = lateMinutes > threshold

  return {
    lateMinutes,
    isLate,
  }
}

/**
 * Tính toán thời gian làm việc thực tế có trừ thời gian nghỉ trưa nếu ca làm kéo dài qua giờ nghỉ
 */
export function calculateWorkDuration(
  checkInTime: Date,
  checkOutTime: Date,
  lunchStart?: string | null,
  lunchEnd?: string | null
): number {
  if (checkOutTime.getTime() <= checkInTime.getTime()) return 0

  const totalDiffMs = checkOutTime.getTime() - checkInTime.getTime()
  let lunchOverlapMs = 0

  if (lunchStart && lunchEnd) {
    const [lsh, lsm] = lunchStart.split(':').map(Number)
    const [leh, lem] = lunchEnd.split(':').map(Number)

    // Lấy ngày theo múi giờ Việt Nam của thời điểm check-in
    const vnIn = toVietnamDate(checkInTime)
    const year = vnIn.getUTCFullYear()
    const month = vnIn.getUTCMonth()
    const day = vnIn.getUTCDate()

    // Khung giờ nghỉ trưa UTC tương ứng với giờ VN (UTC = VN - 7)
    const lunchStartMs = Date.UTC(year, month, day, lsh - 7, lsm, 0, 0)
    const lunchEndMs = Date.UTC(year, month, day, leh - 7, lem, 0, 0)

    if (lunchEndMs > lunchStartMs) {
      const overlapStart = Math.max(checkInTime.getTime(), lunchStartMs)
      const overlapEnd = Math.min(checkOutTime.getTime(), lunchEndMs)
      if (overlapEnd > overlapStart) {
        lunchOverlapMs = overlapEnd - overlapStart
      }
    }
  }

  const effectiveMs = Math.max(0, totalDiffMs - lunchOverlapMs)
  const hours = effectiveMs / 3600000
  return Math.round(hours * 100) / 100
}

/**
 * Tính toán kết quả Check-out
 */
export function calculateAttendanceCheckOut(
  checkInTime: Date,
  checkOutTime: Date,
  schedule: WorkScheduleInfo
) {
  const workDuration = calculateWorkDuration(
    checkInTime,
    checkOutTime,
    schedule.lunchStart,
    schedule.lunchEnd
  )
  const workDays = calculateWorkDays(workDuration)

  const endTime = schedule.endTime || '17:00'
  const earlyThreshold = schedule.earlyThreshold ?? 15
  const earlyMinutes = calculateEarlyLeaveMinutes(checkOutTime, endTime)
  const isEarlyLeave = earlyMinutes > earlyThreshold

  return {
    workDuration,
    workDays,
    earlyMinutes,
    isEarlyLeave,
  }
}
