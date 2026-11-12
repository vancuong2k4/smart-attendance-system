import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { BADGE_DEFINITIONS, updateEmployeeGamification } from '@/lib/gamification'
import { BadgeType } from '@prisma/client'

/**
 * GET /api/gamification/my-stats
 * Lấy số liệu cá nhân: chuỗi ngày đúng giờ, điểm chuyên cần, thứ hạng và danh sách huy hiệu
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const month = parseInt(searchParams.get('month') || `${now.getMonth() + 1}`, 10)
    const year = parseInt(searchParams.get('year') || `${now.getFullYear()}`, 10)

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tháng hoặc năm không hợp lệ', 422)
    }

    // 1. Tìm nhân viên ứng với user
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    })

    if (!employee) {
      // Trường hợp Super Admin hoặc tài khoản chưa gắn Employee
      return successResponse({
        isLinkedEmployee: false,
        stats: {
          currentStreak: 0,
          longestStreak: 0,
          punctualityScore: 100,
          totalOnTime: 0,
          totalLate: 0,
          totalEarlyLeave: 0,
          rank: null,
          branchRank: null,
          totalEmployees: 0,
        },
        badges: [],
        nextMilestone: null,
      })
    }

    // 2. Tính toán & cập nhật thống kê tháng hiện tại
    await updateEmployeeGamification(employee.id, month, year)

    // 3. Lấy bản ghi streak đã lưu
    const streak = await prisma.attendanceStreak.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: employee.id,
          month,
          year,
        },
      },
    })

    // 4. Lấy tất cả badges đã đạt
    const unlockedBadges = await prisma.employeeBadge.findMany({
      where: { employeeId: employee.id },
      orderBy: { unlockedAt: 'desc' },
    })

    // 5. Tính thứ hạng theo punctualityScore trong tháng
    const allStreaksCompany = await prisma.attendanceStreak.findMany({
      where: { month, year },
      orderBy: [
        { punctualityScore: 'desc' },
        { currentStreak: 'desc' },
        { totalOnTime: 'desc' },
      ],
      select: { employeeId: true },
    })

    const rankIndex = allStreaksCompany.findIndex((s) => s.employeeId === employee.id)
    const rank = rankIndex !== -1 ? rankIndex + 1 : null

    // Thứ hạng trong chi nhánh
    const branchEmployees = await prisma.employee.findMany({
      where: { branchId: employee.branchId },
      select: { id: true },
    })
    const branchEmployeeIds = new Set(branchEmployees.map((e) => e.id))

    const branchStreaks = allStreaksCompany.filter((s) => branchEmployeeIds.has(s.employeeId))
    const branchRankIndex = branchStreaks.findIndex((s) => s.employeeId === employee.id)
    const branchRank = branchRankIndex !== -1 ? branchRankIndex + 1 : null

    // 6. Tính toán Next Milestone (Huy hiệu tiếp theo và tiến độ %)
    const unlockedTypes = new Set(unlockedBadges.map((b) => b.badgeType))
    let nextMilestone = null

    const currentStreakCount = streak?.currentStreak || 0
    if (!unlockedTypes.has(BadgeType.PERFECT_WEEK)) {
      nextMilestone = {
        badge: BADGE_DEFINITIONS[BadgeType.PERFECT_WEEK],
        current: Math.min(currentStreakCount, 5),
        target: 5,
        progressPercent: Math.min(100, Math.round((currentStreakCount / 5) * 100)),
      }
    } else if (!unlockedTypes.has(BadgeType.ON_TIME_HERO)) {
      nextMilestone = {
        badge: BADGE_DEFINITIONS[BadgeType.ON_TIME_HERO],
        current: Math.min(currentStreakCount, 30),
        target: 30,
        progressPercent: Math.min(100, Math.round((currentStreakCount / 30) * 100)),
      }
    } else if (!unlockedTypes.has(BadgeType.STREAK_MASTER)) {
      nextMilestone = {
        badge: BADGE_DEFINITIONS[BadgeType.STREAK_MASTER],
        current: Math.min(currentStreakCount, 60),
        target: 60,
        progressPercent: Math.min(100, Math.round((currentStreakCount / 60) * 100)),
      }
    }

    return successResponse({
      isLinkedEmployee: true,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        avatarUrl: employee.avatarUrl,
        position: employee.position,
        branch: employee.branch,
        department: employee.department,
      },
      stats: {
        currentStreak: streak?.currentStreak || 0,
        longestStreak: streak?.longestStreak || 0,
        punctualityScore: streak?.punctualityScore ?? 100,
        totalOnTime: streak?.totalOnTime || 0,
        totalLate: streak?.totalLate || 0,
        totalEarlyLeave: streak?.totalEarlyLeave || 0,
        rank,
        branchRank,
        totalEmployees: allStreaksCompany.length,
        totalBranchEmployees: branchStreaks.length,
      },
      badges: unlockedBadges.map((b) => ({
        ...b,
        definition: BADGE_DEFINITIONS[b.badgeType as BadgeType],
      })),
      nextMilestone,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/my-stats:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải thống kê thành tích', 500)
  }
}
