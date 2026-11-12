import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { branchUpdateSchema } from '@/lib/branch-validation'
import { UserRole } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/branches/[id]
 * Lấy chi tiết thông tin chi nhánh kèm danh sách phòng ban, ca làm việc và nhân sự
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await context.params

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            managerId: true,
            _count: {
              select: {
                employees: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        schedules: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            isDefault: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            employees: true,
            departments: true,
            schedules: true,
          },
        },
      },
    })

    if (!branch) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh yêu cầu', 404)
    }

    return successResponse(branch)
  } catch (error: any) {
    console.error('Error fetching branch details:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải thông tin chi nhánh', 500)
  }
}

/**
 * PATCH /api/branches/[id]
 * Cập nhật thông tin chi nhánh và tọa độ / bán kính Geofence
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
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền chỉnh sửa thông tin chi nhánh',
        403
      )
    }

    // Branch Admin chỉ được cập nhật chi nhánh của chính mình
    if (isBranchAdmin && session.user.employee?.branchId !== id) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chi nhánh chỉ được phép chỉnh sửa chi nhánh được phân công',
        403
      )
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
    })

    if (!branch) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh cần chỉnh sửa', 404)
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu cập nhật không hợp lệ', 400)
    }

    const validation = branchUpdateSchema.safeParse(body)
    if (!validation.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        validation.error.errors
      )
    }

    const updateData = { ...validation.data }

    // Nếu không phải Super Admin, không cho phép đổi mã chi nhánh hoặc đổi trạng thái hoạt động
    if (!isSuperAdmin) {
      delete updateData.code
      delete updateData.isActive
    }

    // Nếu có đổi mã chi nhánh, kiểm tra trùng lặp
    if (updateData.code && updateData.code !== branch.code) {
      const codeCollision = await prisma.branch.findFirst({
        where: {
          companyId: branch.companyId,
          code: updateData.code,
          id: { not: id },
        },
      })

      if (codeCollision) {
        return errorResponse(
          ErrorCodes.BAD_REQUEST,
          `Mã chi nhánh "${updateData.code}" đã được sử dụng bởi một chi nhánh khác`,
          409
        )
      }
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
            schedules: true,
          },
        },
      },
    })

    return successResponse(updatedBranch, 'Cập nhật thông tin chi nhánh thành công')
  } catch (error: any) {
    console.error('Error updating branch:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật chi nhánh', 500)
  }
}

/**
 * DELETE /api/branches/[id]
 * Xóa an toàn chi nhánh (Chỉ dành cho SUPER_ADMIN, chống xóa nếu còn nhân viên)
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền xóa chi nhánh',
        403
      )
    }

    const { id } = await context.params

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
          },
        },
      },
    })

    if (!branch) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh cần xóa', 404)
    }

    // Bảo vệ an toàn dữ liệu: Chặn xóa nếu còn nhân viên
    if (branch._count.employees > 0) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        `Không thể xóa chi nhánh "${branch.name}" vì hiện đang có ${branch._count.employees} nhân sự liên kết. Vui lòng chuyển các nhân viên sang chi nhánh khác trước hoặc chuyển trạng thái sang Vô hiệu hóa.`,
        400
      )
    }

    // Xóa các liên kết lịch biểu và phòng ban trống
    await prisma.$transaction([
      prisma.workSchedule.deleteMany({ where: { branchId: id } }),
      prisma.department.deleteMany({ where: { branchId: id } }),
      prisma.branch.delete({ where: { id } }),
    ])

    return successResponse(
      { id, name: branch.name, code: branch.code },
      `Đã xóa chi nhánh "${branch.name}" thành công`
    )
  } catch (error: any) {
    console.error('Error deleting branch:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xóa chi nhánh', 500)
  }
}
