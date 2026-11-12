import { prisma } from '@/lib/db'
import { BadgeType, BadgeTier, AttendanceStatus } from '@prisma/client'

export interface BadgeDefinition {
  type: BadgeType
  tier: BadgeTier
  title: string
  description: string
  icon: string
  points: number
  requirementText: string
}

export const BADGE_DEFINITIONS: Record<BadgeType, BadgeDefinition> = {
  [BadgeType.EARLY_BIRD]: {
    type: BadgeType.EARLY_BIRD,
    tier: BadgeTier.SILVER,
    title: 'Chim Sớm Chăm Chỉ',
    description: 'Check-in sớm hơn giờ quy định ít nhất 15 phút trong 5 ca làm việc',
    icon: 'Sun',
    points: 50,
    requirementText: 'Tích lũy 5 lần check-in sớm >= 15 phút',
  },
  [BadgeType.PERFECT_WEEK]: {
    type: BadgeType.PERFECT_WEEK,
    tier: BadgeTier.BRONZE,
    title: 'Tuần Lễ Hoàn Hảo',
    description: 'Đúng giờ 100% trong 5 ngày làm việc liên tiếp',
    icon: 'CalendarCheck',
    points: 30,
    requirementText: 'Chuỗi streak đúng giờ đạt 5 ngày liên tiếp',
  },
  [BadgeType.PERFECT_MONTH]: {
    type: BadgeType.PERFECT_MONTH,
    tier: BadgeTier.GOLD,
    title: 'Tháng Chuyên Cần Vàng',
    description: '100% đúng giờ và không về sớm trong toàn bộ tháng làm việc',
    icon: 'Award',
    points: 150,
    requirementText: 'Tháng có ít nhất 15 ngày công, không có lần nào đi muộn/về sớm',
  },
  [BadgeType.ON_TIME_HERO]: {
    type: BadgeType.ON_TIME_HERO,
    tier: BadgeTier.GOLD,
    title: 'Chiến Binh Kỷ Luật',
    description: 'Duy trì chuỗi đúng giờ 30 ngày làm việc liên tiếp',
    icon: 'ShieldCheck',
    points: 200,
    requirementText: 'Chuỗi streak đúng giờ đạt 30 ngày',
  },
  [BadgeType.OVERTIME_CHAMPION]: {
    type: BadgeType.OVERTIME_CHAMPION,
    tier: BadgeTier.SILVER,
    title: 'Ngôi Sao Cống Hiến',
    description: 'Hoàn thành trên 20 giờ làm thêm giờ (OT) được phê duyệt trong tháng',
    icon: 'Flame',
    points: 100,
    requirementText: 'Tổng số giờ OT được duyệt >= 20 giờ/tháng',
  },
  [BadgeType.STREAK_MASTER]: {
    type: BadgeType.STREAK_MASTER,
    tier: BadgeTier.DIAMOND,
    title: 'Bậc Thầy Kiên Trì',
    description: 'Duy trì chuỗi streak kỷ lục 60 ngày liên tục đúng giờ',
    icon: 'Crown',
    points: 500,
    requirementText: 'Chuỗi streak đúng giờ đạt 60 ngày',
  },
  [BadgeType.PUNCTUALITY_DIAMOND]: {
    type: BadgeType.PUNCTUALITY_DIAMOND,
    tier: BadgeTier.DIAMOND,
    title: 'Kim Cương Chuyên Cần',
    description: 'Đạt điểm chuyên cần 100 điểm tuyệt đối trong tháng',
    icon: 'Sparkles',
    points: 300,
    requirementText: 'Điểm chuyên cần tháng đạt 100.0 với tối thiểu 20 ngày công',
  },
}

/**
 * Tính toán điểm chuyên cần Punctuality Score (thang điểm 0 - 100)
 */
export function calculatePunctualityScore(params: {
  totalWorkedDays: number
  totalLate: number
  totalEarlyLeave: number
  totalAbsent?: number
  currentStreak?: number
}): number {
  const { totalWorkedDays, totalLate, totalEarlyLeave, totalAbsent = 0, currentStreak = 0 } = params

  if (totalWorkedDays <= 0 && totalAbsent <= 0) {
    return 100
  }

  // Khởi đầu 100 điểm
  let score = 100

  // Trừ 5 điểm cho mỗi lần đi muộn
  score -= totalLate * 5

  // Trừ 3 điểm cho mỗi lần về sớm
  score -= totalEarlyLeave * 3

  // Trừ 15 điểm cho mỗi lần vắng không phép
  score -= totalAbsent * 15

  // Thưởng chuỗi streak nếu có
  if (currentStreak >= 10) {
    score += 5
  } else if (currentStreak >= 5) {
    score += 2
  }

  // Giới hạn trong khoảng [0, 100]
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10))
}

export interface AttendanceRecordForGamification {
  date: Date
  status: string
  lateMinutes?: number | null
  earlyLeaveMinutes?: number | null
  checkInTime?: Date | null
}

/**
 * Tính chuỗi ngày đúng giờ liên tiếp (Current Streak & Longest Streak)
 */
export function calculateStreaks(attendances: AttendanceRecordForGamification[]): {
  currentStreak: number
  longestStreak: number
  totalOnTime: number
  totalLate: number
  totalEarlyLeave: number
  earlyCheckInCount: number
} {
  // Sắp xếp ngày tăng dần
  const sorted = [...attendances].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let currentStreak = 0
  let longestStreak = 0
  let runningStreak = 0
  let totalOnTime = 0
  let totalLate = 0
  let totalEarlyLeave = 0
  let earlyCheckInCount = 0

  for (let i = 0; i < sorted.length; i++) {
    const att = sorted[i]
    const isLate = (att.lateMinutes && att.lateMinutes > 0) || att.status === 'LATE'
    const isEarly = att.earlyLeaveMinutes && att.earlyLeaveMinutes > 0
    const isAbsent = att.status === 'ABSENT'

    if (isLate) totalLate++
    if (isEarly) totalEarlyLeave++

    // Kiểm tra check-in sớm (ví dụ sớm >= 15 phút nếu có logic so sánh)
    // Để xác định check-in sớm, ta kiểm tra lateMinutes < -15 hoặc flag đặc thù
    if (att.lateMinutes !== undefined && att.lateMinutes !== null && att.lateMinutes <= -15) {
      earlyCheckInCount++
    }

    const isOnTime = !isLate && !isEarly && !isAbsent && att.status === 'PRESENT'

    if (isOnTime) {
      totalOnTime++
      runningStreak++
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak
      }
    } else if (isLate || isEarly || isAbsent) {
      runningStreak = 0
    }
  }

  // Streak hiện tại chính là running streak ở cuối chuỗi
  currentStreak = runningStreak

  return {
    currentStreak,
    longestStreak,
    totalOnTime,
    totalLate,
    totalEarlyLeave,
    earlyCheckInCount,
  }
}

/**
 * Đánh giá các huy hiệu mới mở khóa của nhân viên
 */
export function evaluateEligibleBadges(params: {
  currentStreak: number
  longestStreak: number
  totalWorkedDays: number
  totalLate: number
  totalEarlyLeave: number
  earlyCheckInCount: number
  approvedOvertimeHours: number
  punctualityScore: number
  existingBadges: BadgeType[]
}): BadgeType[] {
  const {
    currentStreak,
    longestStreak,
    totalWorkedDays,
    totalLate,
    totalEarlyLeave,
    earlyCheckInCount,
    approvedOvertimeHours,
    punctualityScore,
    existingBadges,
  } = params

  const eligible: BadgeType[] = []
  const maxStreak = Math.max(currentStreak, longestStreak)

  // 1. EARLY_BIRD
  if (!existingBadges.includes(BadgeType.EARLY_BIRD) && earlyCheckInCount >= 5) {
    eligible.push(BadgeType.EARLY_BIRD)
  }

  // 2. PERFECT_WEEK
  if (!existingBadges.includes(BadgeType.PERFECT_WEEK) && maxStreak >= 5) {
    eligible.push(BadgeType.PERFECT_WEEK)
  }

  // 3. PERFECT_MONTH
  if (
    !existingBadges.includes(BadgeType.PERFECT_MONTH) &&
    totalWorkedDays >= 15 &&
    totalLate === 0 &&
    totalEarlyLeave === 0
  ) {
    eligible.push(BadgeType.PERFECT_MONTH)
  }

  // 4. ON_TIME_HERO
  if (!existingBadges.includes(BadgeType.ON_TIME_HERO) && maxStreak >= 30) {
    eligible.push(BadgeType.ON_TIME_HERO)
  }

  // 5. OVERTIME_CHAMPION
  if (!existingBadges.includes(BadgeType.OVERTIME_CHAMPION) && approvedOvertimeHours >= 20) {
    eligible.push(BadgeType.OVERTIME_CHAMPION)
  }

  // 6. STREAK_MASTER
  if (!existingBadges.includes(BadgeType.STREAK_MASTER) && maxStreak >= 60) {
    eligible.push(BadgeType.STREAK_MASTER)
  }

  // 7. PUNCTUALITY_DIAMOND
  if (
    !existingBadges.includes(BadgeType.PUNCTUALITY_DIAMOND) &&
    punctualityScore >= 100 &&
    totalWorkedDays >= 20
  ) {
    eligible.push(BadgeType.PUNCTUALITY_DIAMOND)
  }

  return eligible
}

/**
 * Cập nhật số liệu Gamification & Badge cho một nhân viên trong tháng
 */
export async function updateEmployeeGamification(
  employeeId: string,
  month: number,
  year: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0, 23, 59, 59, 999)

  // 1. Lấy dữ liệu chấm công trong tháng
  const attendances = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
      status: true,
      lateMinutes: true,
      earlyLeaveMinutes: true,
      checkInTime: true,
    },
    orderBy: { date: 'asc' },
  })

  // 2. Lấy dữ liệu OT đã duyệt trong tháng
  const approvedOvertimes = await prisma.overtimeRequest.findMany({
    where: {
      employeeId,
      status: 'APPROVED',
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      hours: true,
    },
  })

  const totalOtHours = approvedOvertimes.reduce((sum, item) => sum + (item.hours || 0), 0)

  // 3. Tính streak và chỉ số
  const streakStats = calculateStreaks(attendances as any)
  const punctualityScore = calculatePunctualityScore({
    totalWorkedDays: attendances.length,
    totalLate: streakStats.totalLate,
    totalEarlyLeave: streakStats.totalEarlyLeave,
    currentStreak: streakStats.currentStreak,
  })

  // 4. Lấy badges đã có
  const existingBadgesRecord = await prisma.employeeBadge.findMany({
    where: { employeeId },
    select: { badgeType: true },
  })
  const existingTypes = existingBadgesRecord.map((b) => b.badgeType)

  // 5. Đánh giá badges mới
  const newBadgeTypes = evaluateEligibleBadges({
    currentStreak: streakStats.currentStreak,
    longestStreak: streakStats.longestStreak,
    totalWorkedDays: attendances.length,
    totalLate: streakStats.totalLate,
    totalEarlyLeave: streakStats.totalEarlyLeave,
    earlyCheckInCount: streakStats.earlyCheckInCount,
    approvedOvertimeHours: totalOtHours,
    punctualityScore,
    existingBadges: existingTypes,
  })

  // 6. Ghi badges mới vào DB
  for (const bType of newBadgeTypes) {
    const meta = BADGE_DEFINITIONS[bType]
    await prisma.employeeBadge.create({
      data: {
        employeeId,
        badgeType: bType,
        tier: meta.tier,
        title: meta.title,
        description: meta.description,
        icon: meta.icon,
        metadata: { points: meta.points },
      },
    })
  }

  // 7. Upsert AttendanceStreak record
  const streakRecord = await prisma.attendanceStreak.upsert({
    where: {
      employeeId_month_year: {
        employeeId,
        month,
        year,
      },
    },
    create: {
      employeeId,
      month,
      year,
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      punctualityScore,
      totalOnTime: streakStats.totalOnTime,
      totalLate: streakStats.totalLate,
      totalEarlyLeave: streakStats.totalEarlyLeave,
    },
    update: {
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      punctualityScore,
      totalOnTime: streakStats.totalOnTime,
      totalLate: streakStats.totalLate,
      totalEarlyLeave: streakStats.totalEarlyLeave,
    },
  })

  return {
    streakRecord,
    newBadges: newBadgeTypes.map((t) => BADGE_DEFINITIONS[t]),
  }
}
