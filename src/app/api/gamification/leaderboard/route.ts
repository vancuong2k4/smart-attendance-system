import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { BADGE_DEFINITIONS } from '@/lib/gamification'
import { BadgeType } from '@prisma/client'

/**
 * GET /api/gamification/leaderboard
 * Lấy bảng xếp hạng chuyên cần theo tháng, chi nhánh, phòng ban kèm Podium Top 3
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
    const branchId = searchParams.get('branchId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tháng hoặc năm không hợp lệ', 422)
    }

    // 1. Tìm thông tin nhân viên của người gửi request (để lấy myRank)
    const currentEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true, branchId: true },
    })

    // 2. Xây dựng điều kiện lọc Employee
    const employeeFilter: any = {}
    if (branchId && branchId !== 'all') {
      employeeFilter.branchId = branchId
    }
    if (departmentId && departmentId !== 'all') {
      employeeFilter.departmentId = departmentId
    }

    // 3. Truy vấn bảng streak kết hợp quan hệ Employee
    const allStreaks = await prisma.attendanceStreak.findMany({
      where: {
        month,
        year,
        employee: employeeFilter,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            position: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            badges: {
              select: {
                id: true,
                badgeType: true,
                tier: true,
                title: true,
                icon: true,
              },
              take: 3,
            },
          },
        },
      },
      orderBy: [
        { punctualityScore: 'desc' },
        { currentStreak: 'desc' },
        { totalOnTime: 'desc' },
        { longestStreak: 'desc' },
      ],
    })

    // 4. Gắn thứ hạng và định dạng kết quả
    const rankedList = allStreaks.map((item, index) => ({
      rank: index + 1,
      id: item.id,
      employeeId: item.employeeId,
      fullName: item.employee.fullName,
      employeeCode: item.employee.employeeCode,
      avatarUrl: item.employee.avatarUrl,
      position: item.employee.position,
      branchName: item.employee.branch?.name,
      departmentName: item.employee.department?.name,
      punctualityScore: item.punctualityScore,
      currentStreak: item.currentStreak,
      longestStreak: item.longestStreak,
      totalOnTime: item.totalOnTime,
      totalLate: item.totalLate,
      totalEarlyLeave: item.totalEarlyLeave,
      badges: item.employee.badges.map((b) => ({
        ...b,
        definition: BADGE_DEFINITIONS[b.badgeType as BadgeType],
      })),
    }))

    // 5. Tách Podium (Top 3)
    const podium = rankedList.slice(0, 3)

    // 6. Danh sách xếp hạng (giới hạn theo limit)
    const rankings = rankedList.slice(0, limit)

    // 7. Tìm thứ hạng của requester
    let myRank = null
    if (currentEmployee) {
      const found = rankedList.find((r) => r.employeeId === currentEmployee.id)
      if (found) {
        myRank = found
      }
    }

    return successResponse({
      podium,
      rankings,
      myRank,
      meta: {
        month,
        year,
        totalParticipants: rankedList.length,
        branchId: branchId || 'all',
        departmentId: departmentId || 'all',
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/gamification/leaderboard:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải bảng xếp hạng', 500)
  }
}
