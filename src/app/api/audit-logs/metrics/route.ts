import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { AUDIT_ACTION_MAP } from '@/lib/audit'
import { UserRole, AuditSeverity } from '@prisma/client'

/**
 * GET /api/audit-logs/metrics
 * Tổng hợp số liệu phân tích kiểm toán và giám sát bảo mật hệ thống
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền truy cập thông số kiểm toán',
        403
      )
    }

    // RBAC filter
    const where: any = {}
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmployee?.branchId) {
        where.user = {
          employee: {
            branchId: adminEmployee.branchId,
          },
        }
      }
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalEvents, last24hEvents, criticalCount, warningCount, actionGroups, recentLogs] =
      await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.count({
          where: { ...where, createdAt: { gte: oneDayAgo } },
        }),
        prisma.auditLog.count({
          where: {
            ...where,
            severity: { in: [AuditSeverity.CRITICAL, AuditSeverity.SECURITY] },
          },
        }),
        prisma.auditLog.count({
          where: { ...where, severity: AuditSeverity.WARNING },
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 6,
        }),
        prisma.auditLog.findMany({
          where: { ...where, createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true, severity: true },
          orderBy: { createdAt: 'asc' },
        }),
      ])

    // Tính Top Actors (người dùng thực hiện nhiều hành động nhất)
    const actorGroups = await prisma.auditLog.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    })

    const actorUserIds = actorGroups.map((g) => g.userId)
    const actorUsers = await prisma.user.findMany({
      where: { id: { in: actorUserIds } },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: { fullName: true, employeeCode: true, avatarUrl: true },
        },
      },
    })
    const userMap = new Map(actorUsers.map((u) => [u.id, u]))

    const topActors = actorGroups.map((g) => {
      const u = userMap.get(g.userId)
      return {
        userId: g.userId,
        email: u?.email || 'Unknown',
        fullName: u?.employee?.fullName || 'Quản trị viên',
        employeeCode: u?.employee?.employeeCode || null,
        avatarUrl: u?.employee?.avatarUrl || null,
        count: g._count.id,
      }
    })

    // Phân bổ danh mục
    const actionBreakdown = actionGroups.map((ag) => ({
      action: ag.action,
      count: ag._count.id,
      label: AUDIT_ACTION_MAP[ag.action]?.label || ag.action,
      category: AUDIT_ACTION_MAP[ag.action]?.category || 'Khác',
    }))

    // Tính Timeline Trend 7 ngày gần nhất
    const trendMap = new Map<string, { date: string; total: number; warningsOrCritical: number }>()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = d.toISOString().split('T')[0]
      trendMap.set(dateKey, { date: dateKey, total: 0, warningsOrCritical: 0 })
    }

    for (const log of recentLogs) {
      const dateKey = log.createdAt.toISOString().split('T')[0]
      const bucket = trendMap.get(dateKey)
      if (bucket) {
        bucket.total++
        if (
          log.severity === AuditSeverity.WARNING ||
          log.severity === AuditSeverity.CRITICAL ||
          log.severity === AuditSeverity.SECURITY
        ) {
          bucket.warningsOrCritical++
        }
      }
    }

    const timelineTrend = Array.from(trendMap.values())

    return successResponse({
      summary: {
        totalEvents,
        last24hEvents,
        criticalCount,
        warningCount,
      },
      topActors,
      actionBreakdown,
      timelineTrend,
    })
  } catch (error: any) {
    console.error('Error fetching audit metrics:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải thông số kiểm toán', 500)
  }
}
