import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { getVietnameseNationalHolidays } from '@/lib/holidays'
import { logAuditEvent } from '@/lib/audit'
import { UserRole } from '@prisma/client'

/**
 * POST /api/holidays/init-defaults
 * 1-click khởi tạo toàn bộ danh mục Ngày lễ Quốc gia theo Bộ luật Lao động cho năm
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ Super Admin và HR Manager mới có quyền khởi tạo lịch ngày lễ mặc định',
        403
      )
    }

    const body = await req.json().catch(() => ({}))
    const currentYear = new Date().getFullYear()
    const year = typeof body?.year === 'number' ? body.year : currentYear
    const branchId = body?.branchId || null
    const overwrite = body?.overwrite === true

    const defaults = getVietnameseNationalHolidays(year)
    const results: any[] = []

    for (const item of defaults) {
      const existing = await prisma.companyHoliday.findFirst({
        where: {
          code: item.code,
          year,
          branchId,
        },
      })

      if (existing) {
        if (overwrite) {
          const updated = await prisma.companyHoliday.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              date: new Date(item.dateStr),
              endDate: item.endDateStr ? new Date(item.endDateStr) : null,
              type: item.type,
              isPaid: item.isPaid,
              payMultiplier: item.payMultiplier,
              description: item.description,
            },
          })
          results.push({ action: 'updated', holiday: updated })
        } else {
          results.push({ action: 'skipped', holiday: existing })
        }
      } else {
        const created = await prisma.companyHoliday.create({
          data: {
            name: item.name,
            code: item.code,
            date: new Date(item.dateStr),
            endDate: item.endDateStr ? new Date(item.endDateStr) : null,
            type: item.type,
            isPaid: item.isPaid,
            payMultiplier: item.payMultiplier,
            year,
            branchId,
            description: item.description,
          },
        })
        results.push({ action: 'created', holiday: created })
      }
    }

    await logAuditEvent({
      userId: session.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entity: 'CompanyHoliday',
      newData: {
        action: 'INIT_NATIONAL_HOLIDAYS',
        year,
        totalItems: results.length,
      },
    })

    return successResponse({
      message: `Đã khởi tạo thành công lịch ngày lễ Quốc gia năm ${year}`,
      year,
      total: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Error initializing national holidays:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể khởi tạo danh sách ngày lễ quốc gia',
      500
    )
  }
}
