import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { systemSettingsUpdateSchema } from '@/lib/settings-validation'
import { getOrCreateSystemSettings } from '@/lib/settings'
import { UserRole } from '@prisma/client'

/**
 * GET /api/settings
 * Lấy cấu hình hệ thống và thông tin doanh nghiệp
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { company, settings } = await getOrCreateSystemSettings()

    return successResponse({
      company,
      settings,
    })
  } catch (error: any) {
    console.error('Error fetching system settings:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải cấu hình hệ thống',
      500
    )
  }
}

/**
 * PATCH /api/settings
 * Cập nhật các quy tắc chấm công, chu kỳ lương, phép năm và thông báo (Chỉ dành cho SUPER_ADMIN)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền thay đổi cấu hình hệ thống',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = systemSettingsUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu cấu hình không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const { company, settings } = await getOrCreateSystemSettings()
    const updateData = validation.data

    const [updatedSettings] = await prisma.$transaction([
      prisma.systemSetting.update({
        where: { id: settings.id },
        data: updateData,
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SYSTEM_SETTINGS_UPDATED',
          entity: 'SystemSetting',
          entityId: settings.id,
          oldData: settings as any,
          newData: updateData as any,
        },
      }),
    ])

    return successResponse({
      company,
      settings: updatedSettings,
    })
  } catch (error: any) {
    console.error('Error updating system settings:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể cập nhật cấu hình hệ thống',
      500
    )
  }
}
