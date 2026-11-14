import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { AUDIT_ACTION_MAP } from '@/lib/audit'
import { UserRole } from '@prisma/client'

/**
 * GET /api/audit-logs/[id]
 * Lấy chi tiết bản ghi nhật ký kiểm toán kèm oldData, newData và metadata
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        'Bạn không có quyền xem chi tiết nhật ký kiểm toán',
        403
      )
    }

    const { id } = await params

    const log = await prisma.auditLog.findUnique({
      where: { id },
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
    })

    if (!log) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy bản ghi kiểm toán', 404)
    }

    // RBAC check cho BRANCH_ADMIN
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (
        adminEmployee?.branchId &&
        log.user?.employee?.branch?.id &&
        adminEmployee.branchId !== log.user.employee.branch.id
      ) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền truy cập bản ghi của chi nhánh khác',
          403
        )
      }
    }

    return successResponse({
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
      oldData: log.oldData,
      newData: log.newData,
      metadata: log.metadata,
      severity: log.severity,
      status: log.status,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Error fetching audit log detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải chi tiết nhật ký kiểm toán', 500)
  }
}
