import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { companyProfileUpdateSchema } from '@/lib/settings-validation'
import { getOrCreateSystemSettings } from '@/lib/settings'
import { UserRole } from '@prisma/client'

/**
 * PATCH /api/settings/company
 * Cập nhật thông tin hồ sơ doanh nghiệp (Chỉ dành cho SUPER_ADMIN)
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
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền chỉnh sửa hồ sơ công ty',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = companyProfileUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu hồ sơ doanh nghiệp không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const { company } = await getOrCreateSystemSettings()
    const updateData = validation.data

    const [updatedCompany] = await prisma.$transaction([
      prisma.company.update({
        where: { id: company.id },
        data: {
          name: updateData.name,
          taxCode: updateData.taxCode || null,
          address: updateData.address || null,
          phone: updateData.phone || null,
          email: updateData.email || null,
          logoUrl: updateData.logoUrl || null,
          timezone: updateData.timezone,
          currency: updateData.currency,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'COMPANY_PROFILE_UPDATED',
          entity: 'Company',
          entityId: company.id,
          oldData: company as any,
          newData: updateData as any,
        },
      }),
    ])

    return successResponse(updatedCompany)
  } catch (error: any) {
    console.error('Error updating company profile:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể cập nhật hồ sơ doanh nghiệp',
      500
    )
  }
}
