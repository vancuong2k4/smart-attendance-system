import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'

/**
 * GET /api/branches/stats
 * Tổng hợp số liệu thống kê mạng lưới chi nhánh, phân bổ Geofence và quy mô nhân sự
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const [
      totalBranches,
      activeBranches,
      totalEmployees,
      totalDepartments,
      branches,
    ] = await Promise.all([
      prisma.branch.count(),
      prisma.branch.count({ where: { isActive: true } }),
      prisma.employee.count(),
      prisma.department.count(),
      prisma.branch.findMany({
        select: {
          gpsRadius: true,
        },
      }),
    ])

    const inactiveBranches = totalBranches - activeBranches

    let averageRadius = 100
    let minRadius = 100
    let maxRadius = 100

    if (branches.length > 0) {
      const radii = branches.map((b) => b.gpsRadius)
      const sum = radii.reduce((acc, r) => acc + r, 0)
      averageRadius = Math.round(sum / branches.length)
      minRadius = Math.min(...radii)
      maxRadius = Math.max(...radii)
    }

    return successResponse({
      totalBranches,
      activeBranches,
      inactiveBranches,
      totalEmployees,
      totalDepartments,
      averageRadius,
      minRadius,
      maxRadius,
    })
  } catch (error: any) {
    console.error('Error fetching branch stats:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải thống kê chi nhánh',
      500
    )
  }
}
