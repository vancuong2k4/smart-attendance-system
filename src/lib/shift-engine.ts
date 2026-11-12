/**
 * Shift Calculation & Scheduling Engine
 * Supports standard shifts, overnight shifts, split hours, and swap validation
 */

/**
 * Checks if a shift spans across midnight (Overnight Shift, e.g. 22:00 -> 06:00)
 */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  const [sH, sM] = startTime.split(':').map(Number)
  const [eH, eM] = endTime.split(':').map(Number)
  return eH * 60 + eM < sH * 60 + sM
}

/**
 * Calculates net shift working hours, deducting lunch break if configured
 */
export function calculateShiftDuration(
  startTime: string,
  endTime: string,
  lunchStart?: string | null,
  lunchEnd?: string | null
): number {
  const [sH, sM] = startTime.split(':').map(Number)
  const [eH, eM] = endTime.split(':').map(Number)

  let startMinutes = sH * 60 + sM
  let endMinutes = eH * 60 + eM

  if (endMinutes < startMinutes) {
    // Overnight shift: add 24 hours (1440 minutes)
    endMinutes += 1440
  }

  let totalMinutes = endMinutes - startMinutes

  // Deduct lunch break if provided and valid
  if (lunchStart && lunchEnd) {
    const [lsH, lsM] = lunchStart.split(':').map(Number)
    const [leH, leM] = lunchEnd.split(':').map(Number)
    const lunchStartMin = lsH * 60 + lsM
    let lunchEndMin = leH * 60 + leM

    if (lunchEndMin < lunchStartMin) {
      lunchEndMin += 1440
    }

    const lunchDuration = lunchEndMin - lunchStartMin
    if (lunchDuration > 0 && lunchDuration < totalMinutes) {
      totalMinutes -= lunchDuration
    }
  }

  return Math.round((totalMinutes / 60) * 10) / 10
}

/**
 * Formats time range nicely: "08:00 - 17:00" or "22:00 - 06:00 (Hôm sau)"
 */
export function formatShiftTime(startTime: string, endTime: string): string {
  const overnight = isOvernightShift(startTime, endTime)
  return `${startTime} - ${endTime}${overnight ? ' (Qua đêm)' : ''}`
}

/**
 * Returns ISO day of week (1 = Monday, ..., 7 = Sunday) for a Date object
 */
export function getDayOfWeekNumber(date: Date): number {
  const day = date.getDay()
  return day === 0 ? 7 : day
}

/**
 * Converts array of working day numbers to human-readable Vietnamese label
 * e.g., [1,2,3,4,5] -> "Thứ 2 - Thứ 6"
 */
export function formatWorkDaysLabel(workDays: number[]): string {
  if (!workDays || workDays.length === 0) return 'Không có ngày làm việc'
  if (workDays.length === 7) return 'Cả tuần (T2 - CN)'
  if (
    workDays.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => workDays.includes(d))
  ) {
    return 'Thứ 2 - Thứ 6 (Hành chính)'
  }
  if (
    workDays.length === 6 &&
    [1, 2, 3, 4, 5, 6].every((d) => workDays.includes(d))
  ) {
    return 'Thứ 2 - Thứ 7'
  }

  const sorted = [...workDays].sort((a, b) => a - b)
  return sorted.map((d) => (d === 7 ? 'CN' : `T${d + 1}`)).join(', ')
}

export interface SwapEligibilityResult {
  isValid: boolean
  error?: string
}

/**
 * Validates business rules before creating a shift swap request
 */
export function validateSwapEligibility(
  requesterId: string,
  targetEmployeeId: string,
  requesterDateStr: string,
  targetDateStr: string,
  now: Date = new Date()
): SwapEligibilityResult {
  // 1. Anti-self-swap
  if (requesterId === targetEmployeeId) {
    return {
      isValid: false,
      error: 'Không thể tự gửi yêu cầu đổi ca cho chính mình',
    }
  }

  // 2. Chặn đổi ca trong quá khứ
  // Lấy ngày hiện tại dạng YYYY-MM-DD theo giờ VN (UTC+7)
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const todayStr = vnNow.toISOString().slice(0, 10)

  if (requesterDateStr < todayStr) {
    return {
      isValid: false,
      error: 'Không thể gửi yêu cầu đổi ca cho ngày đã qua trong quá khứ',
    }
  }

  if (targetDateStr < todayStr) {
    return {
      isValid: false,
      error: 'Không thể chọn ca của đồng nghiệp trong quá khứ để đổi',
    }
  }

  return { isValid: true }
}
