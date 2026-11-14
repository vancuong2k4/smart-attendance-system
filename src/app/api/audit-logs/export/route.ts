import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, ErrorCodes } from '@/lib/api-response'
import { AUDIT_ACTION_MAP } from '@/lib/audit'
import { UserRole, AuditSeverity, AuditStatus } from '@prisma/client'

/**
 * GET /api/audit-logs/export
 * Xuất dữ liệu nhật ký kiểm toán phục vụ tuân thủ (Compliance Audit Export)
 * Định dạng hỗ trợ: CSV (UTF-8 BOM), JSON
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
        'Bạn không có quyền xuất nhật ký kiểm toán',
        403
      )
    }

    const { searchParams } = new URL(req.url)
    const format = (searchParams.get('format') || 'csv').toLowerCase()
    const search = searchParams.get('search')?.trim() || ''
    const action = searchParams.get('action') || ''
    const severity = searchParams.get('severity') as AuditSeverity | null
    const status = searchParams.get('status') as AuditStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}

    // RBAC
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

    if (action && action !== 'ALL') where.action = action
    if (severity && Object.values(AuditSeverity).includes(severity)) where.severity = severity
    if (status && Object.values(AuditStatus).includes(status)) where.status = status

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

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

    // Lấy tối đa 10,000 bản ghi mới nhất
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            role: true,
            employee: {
              select: {
                fullName: true,
                employeeCode: true,
                branch: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    if (format === 'json') {
      const jsonData = JSON.stringify(
        {
          exportMeta: {
            system: 'Smart Attendance System - Audit Center',
            exportedAt: new Date().toISOString(),
            exportedBy: session.user.email,
            totalRecords: logs.length,
          },
          records: logs,
        },
        null,
        2
      )

      return new NextResponse(jsonData, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.json"`,
        },
      })
    }

    // Mặc định xuất CSV với UTF-8 BOM
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const csvHeaders = [
      'Thời gian',
      'Mức độ',
      'Trạng thái',
      'Mã hành động',
      'Mô tả hành động',
      'Thực thể',
      'ID Thực thể',
      'Email người thực hiện',
      'Họ tên nhân viên',
      'Mã nhân viên',
      'Chi nhánh',
      'Địa chỉ IP',
      'Thiết bị (User Agent)',
    ]

    const csvRows = logs.map((log) => [
      escapeCsv(log.createdAt.toISOString()),
      escapeCsv(log.severity),
      escapeCsv(log.status),
      escapeCsv(log.action),
      escapeCsv(AUDIT_ACTION_MAP[log.action]?.label || log.action),
      escapeCsv(log.entity),
      escapeCsv(log.entityId),
      escapeCsv(log.user?.email || 'N/A'),
      escapeCsv(log.user?.employee?.fullName || 'Quản trị viên'),
      escapeCsv(log.user?.employee?.employeeCode || 'N/A'),
      escapeCsv(log.user?.employee?.branch?.name || 'Toàn công ty'),
      escapeCsv(log.ipAddress || 'Unknown'),
      escapeCsv(log.userAgent || 'Unknown'),
    ])

    const BOM = '\uFEFF'
    const csvContent =
      BOM + [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting audit logs:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xuất nhật ký kiểm toán', 500)
  }
}
