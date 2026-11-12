import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { getOrCreateSystemSettings } from '@/lib/settings'
import { UserRole } from '@prisma/client'

/**
 * GET /api/settings/export
 * Xuất bản chụp cấu hình hệ thống và thông số toàn diện (System Diagnostics & Configuration Snapshot)
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
        'Bạn không có quyền xuất cấu hình hệ thống',
        403
      )
    }

    const { company, settings } = await getOrCreateSystemSettings()

    const [branchCount, employeeCount, scheduleCount, departmentCount] =
      await Promise.all([
        prisma.branch.count(),
        prisma.employee.count(),
        prisma.workSchedule.count(),
        prisma.department.count(),
      ])

    const exportData = {
      system: 'Smart Attendance System',
      version: '2.5.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
      },
      organization: {
        id: company.id,
        name: company.name,
        code: company.code,
        taxCode: company.taxCode,
        address: company.address,
        phone: company.phone,
        email: company.email,
        timezone: company.timezone,
        currency: company.currency,
      },
      rules: settings,
      metrics: {
        totalBranches: branchCount,
        totalEmployees: employeeCount,
        totalSchedules: scheduleCount,
        totalDepartments: departmentCount,
      },
    }

    return successResponse(exportData)
  } catch (error: any) {
    console.error('Error exporting system configuration:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể xuất bản chụp cấu hình hệ thống',
      500
    )
  }
}
