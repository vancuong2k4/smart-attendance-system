import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { holidayUpdateSchema } from '@/lib/holiday-validation'
import { HOLIDAY_TYPE_MAP } from '@/lib/holidays'
import { logAuditEvent } from '@/lib/audit'
import { UserRole } from '@prisma/client'

/**
 * GET /api/holidays/[id]
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

    const { id } = await params
    const holiday = await prisma.companyHoliday.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    if (!holiday) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ngày lễ', 404)
    }

    // Branch Admin chỉ được xem ngày lễ toàn công ty hoặc của chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN && holiday.branchId) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId !== holiday.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền xem ngày lễ của chi nhánh khác',
          403
        )
      }
    }

    return successResponse({
      ...holiday,
      typeMeta: HOLIDAY_TYPE_MAP[holiday.type],
    })
  } catch (error: any) {
    console.error('Error fetching holiday detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải chi tiết ngày lễ', 500)
  }
}

/**
 * PATCH /api/holidays/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.HR_MANAGER,
      UserRole.BRANCH_ADMIN,
    ]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền chỉnh sửa ngày lễ',
        403
      )
    }

    const { id } = await params
    const existing = await prisma.companyHoliday.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ngày lễ', 404)
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (existing.branchId !== adminEmp?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền chỉnh sửa ngày lễ này',
          403
        )
      }
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = holidayUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu cập nhật không hợp lệ',
        422,
        validation.error.issues
      )
    }

    const data = validation.data
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code.toUpperCase()
    if (data.date !== undefined) updateData.date = new Date(data.date)
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null
    }
    if (data.type !== undefined) updateData.type = data.type
    if (data.isPaid !== undefined) updateData.isPaid = data.isPaid
    if (data.payMultiplier !== undefined) updateData.payMultiplier = data.payMultiplier
    if (data.year !== undefined) updateData.year = data.year
    if (data.description !== undefined) updateData.description = data.description

    // Super Admin / HR Manager có thể đổi branchId
    if (session.user.role !== UserRole.BRANCH_ADMIN && data.branchId !== undefined) {
      updateData.branchId = data.branchId
    }

    const updated = await prisma.companyHoliday.update({
      where: { id },
      data: updateData,
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    await logAuditEvent({
      userId: session.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entity: 'CompanyHoliday',
      entityId: id,
      oldData: existing,
      newData: updated,
    })

    return successResponse({
      ...updated,
      typeMeta: HOLIDAY_TYPE_MAP[updated.type],
    })
  } catch (error: any) {
    console.error('Error updating holiday:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật ngày lễ', 500)
  }
}

/**
 * DELETE /api/holidays/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.HR_MANAGER,
      UserRole.BRANCH_ADMIN,
    ]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền xóa ngày lễ',
        403
      )
    }

    const { id } = await params
    const existing = await prisma.companyHoliday.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ngày lễ', 404)
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (existing.branchId !== adminEmp?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền xóa ngày lễ này',
          403
        )
      }
    }

    await prisma.companyHoliday.delete({
      where: { id },
    })

    await logAuditEvent({
      userId: session.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entity: 'CompanyHoliday',
      entityId: id,
      oldData: existing,
    })

    return successResponse({ message: 'Đã xóa ngày lễ thành công', id })
  } catch (error: any) {
    console.error('Error deleting holiday:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xóa ngày lễ', 500)
  }
}
