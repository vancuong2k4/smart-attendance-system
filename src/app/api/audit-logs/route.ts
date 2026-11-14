import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { AUDIT_ACTION_MAP } from '@/lib/audit'
import { UserRole, AuditSeverity, AuditStatus } from '@prisma/client'

/**
 * GET /api/audit-logs
 * Lấy danh sách nhật ký kiểm toán hệ thống với bộ lọc nâng cao và phân quyền RBAC
 * Phân quyền: SUPER_ADMIN, BRANCH_ADMIN
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
        'Bạn không có quyền truy cập nhật ký kiểm toán hệ thống',
        403
      )
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const action = searchParams.get('action') || ''
    const entity = searchParams.get('entity') || ''
    const severity = searchParams.get('severity') as AuditSeverity | null
    const status = searchParams.get('status') as AuditStatus | null
    const userId = searchParams.get('userId') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    // Xây dựng điều kiện lọc where
    const where: any = {}

    // RBAC: BRANCH_ADMIN chỉ xem được logs do user cùng chi nhánh thực hiện hoặc liên quan chi nhánh
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

    if (action && action !== 'ALL') {
      where.action = action
    }

    if (entity && entity !== 'ALL') {
      where.entity = entity
    }

    if (severity && Object.values(AuditSeverity).includes(severity)) {
      where.severity = severity
    }

    if (status && Object.values(AuditStatus).includes(status)) {
      where.status = status
    }

    if (userId) {
      where.userId = userId
    }

    // Lọc thời gian
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Tìm kiếm toàn văn
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entity: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              {
                employee: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { employeeCode: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
      ]
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  employeeCode: true,
                  avatarUrl: true,
                  position: true,
                  branch: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const items = rawLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            role: log.user.role,
            fullName: log.user.employee?.fullName || 'Tài khoản Quản trị',
            employeeCode: log.user.employee?.employeeCode || null,
            avatarUrl: log.user.employee?.avatarUrl || null,
            position: log.user.employee?.position || null,
            branchName: log.user.employee?.branch?.name || null,
          }
        : null,
      action: log.action,
      actionMeta: AUDIT_ACTION_MAP[log.action] || {
        label: log.action,
        category: 'Khác',
        badgeColor: 'text-slate-700 bg-slate-50 border-slate-200',
      },
      entity: log.entity,
      entityId: log.entityId,
      severity: log.severity,
      status: log.status,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      hasDiff: !!(log.oldData || log.newData),
      createdAt: log.createdAt.toISOString(),
    }))

    return successResponse({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải danh sách nhật ký kiểm toán',
      500
    )
  }
}
