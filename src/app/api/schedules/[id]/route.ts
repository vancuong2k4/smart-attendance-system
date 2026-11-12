import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { scheduleUpdateSchema } from '@/lib/shift-validation'
import { UserRole } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/schedules/[id]
 * Chi tiết ca làm việc
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await context.params

    const schedule = await prisma.workSchedule.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    if (!schedule) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ca làm việc yêu cầu', 404)
    }

    return successResponse(schedule)
  } catch (error: any) {
    console.error('Error fetching schedule:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải thông tin ca làm việc', 500)
  }
}

/**
 * PATCH /api/schedules/[id]
 * Chỉnh sửa ca làm việc
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await context.params
    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    const isBranchAdmin = session.user.role === UserRole.BRANCH_ADMIN

    if (!isSuperAdmin && !isBranchAdmin) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền chỉnh sửa ca làm việc', 403)
    }

    const schedule = await prisma.workSchedule.findUnique({
      where: { id },
    })

    if (!schedule) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ca làm việc cần chỉnh sửa', 404)
    }

    if (isBranchAdmin && session.user.employee?.branchId !== schedule.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được chỉnh sửa ca làm việc của chi nhánh mình phụ trách',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu cập nhật không hợp lệ', 400)
    }

    const validation = scheduleUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const data = validation.data

    // Nếu đặt là mặc định, hủy ca mặc định cũ của chi nhánh đó
    if (data.isDefault) {
      const targetBranchId = data.branchId || schedule.branchId
      await prisma.workSchedule.updateMany({
        where: {
          branchId: targetBranchId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const updatedSchedule = await prisma.workSchedule.update({
      where: { id },
      data,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    return successResponse(updatedSchedule)
  } catch (error: any) {
    console.error('Error updating schedule:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật ca làm việc', 500)
  }
}

/**
 * DELETE /api/schedules/[id]
 * Xóa ca làm việc an toàn
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    const isBranchAdmin = session.user.role === UserRole.BRANCH_ADMIN

    if (!isSuperAdmin && !isBranchAdmin) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xóa ca làm việc', 403)
    }

    const { id } = await context.params

    const schedule = await prisma.workSchedule.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    })

    if (!schedule) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy ca làm việc cần xóa', 404)
    }

    if (isBranchAdmin && session.user.employee?.branchId !== schedule.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được xóa ca làm việc của chi nhánh mình phụ trách',
        403
      )
    }

    // Chặn xóa nếu đang có phân ca liên kết
    if (schedule._count.assignments > 0) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        `Không thể xóa ca làm việc "${schedule.name}" vì đang có ${schedule._count.assignments} lượt phân ca liên kết. Vui lòng chuyển nhân viên sang ca khác trước.`,
        400
      )
    }

    await prisma.workSchedule.delete({
      where: { id },
    })

    return successResponse({ id, name: schedule.name })
  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xóa ca làm việc', 500)
  }
}
