import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { getOrCreateSystemSettings, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings'
import { UserRole } from '@prisma/client'

/**
 * POST /api/settings/reset
 * Khôi phục toàn bộ cấu hình hệ thống về trạng thái tiêu chuẩn (Chỉ dành cho SUPER_ADMIN)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền khôi phục cài đặt gốc',
        403
      )
    }

    const { settings } = await getOrCreateSystemSettings()

    const [resetSettings] = await prisma.$transaction([
      prisma.systemSetting.update({
        where: { id: settings.id },
        data: DEFAULT_SYSTEM_SETTINGS,
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'SYSTEM_SETTINGS_RESET',
          entity: 'SystemSetting',
          entityId: settings.id,
          oldData: settings as any,
          newData: DEFAULT_SYSTEM_SETTINGS as any,
        },
      }),
    ])

    return successResponse(resetSettings)
  } catch (error: any) {
    console.error('Error resetting system settings:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể khôi phục cài đặt hệ thống',
      500
    )
  }
}
