import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { BADGE_DEFINITIONS } from '@/lib/gamification'
import { BadgeType } from '@prisma/client'

/**
 * GET /api/gamification/badges
 * Lấy toàn bộ danh mục huy hiệu kèm tỷ lệ đạt được và trạng thái của user hiện tại
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    // 1. Lấy thông tin nhân viên của user hiện tại (nếu có)
    const currentEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    // 2. Lấy tổng số nhân viên trong công ty
    const totalEmployees = await prisma.employee.count()

    // 3. Lấy thống kê số lượng mở khóa của từng badge
    const badgeCounts = await prisma.employeeBadge.groupBy({
      by: ['badgeType'],
      _count: {
        employeeId: true,
      },
    })
    const badgeCountMap = new Map<string, number>()
    for (const item of badgeCounts) {
      badgeCountMap.set(item.badgeType, item._count.employeeId)
    }

    // 4. Lấy danh sách badge của chính nhân viên hiện tại
    const myBadges = currentEmployee
      ? await prisma.employeeBadge.findMany({
          where: { employeeId: currentEmployee.id },
        })
      : []
    const myBadgeMap = new Map<string, any>()
    for (const b of myBadges) {
      myBadgeMap.set(b.badgeType, b)
    }

    // 5. Tổng hợp danh mục
    const allBadges = Object.values(BADGE_DEFINITIONS).map((def) => {
      const unlockedCount = badgeCountMap.get(def.type) || 0
      const unlockRatePercent =
        totalEmployees > 0 ? Math.round((unlockedCount / totalEmployees) * 100) : 0
      const userBadge = myBadgeMap.get(def.type)

      return {
        ...def,
        unlockedCount,
        unlockRatePercent,
        isUnlockedByMe: !!userBadge,
        unlockedAt: userBadge?.unlockedAt || null,
      }
    })

    return successResponse({
      badges: allBadges,
      totalBadges: allBadges.length,
      unlockedByMeCount: myBadges.length,
      totalEmployees,
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/badges:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh mục huy hiệu', 500)
  }
}
