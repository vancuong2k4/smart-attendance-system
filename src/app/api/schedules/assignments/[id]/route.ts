import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { UserRole } from '@prisma/client'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/schedules/assignments/[id]
 * Hủy phân ca làm việc cụ thể
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
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền hủy phân ca', 403)
    }

    const { id } = await context.params

    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
      include: {
        employee: { select: { branchId: true } },
      },
    })

    if (!assignment) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy phân ca yêu cầu', 404)
    }

    if (isBranchAdmin && session.user.employee?.branchId !== assignment.employee.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được hủy phân ca của chi nhánh phụ trách',
        403
      )
    }

    await prisma.shiftAssignment.delete({
      where: { id },
    })

    return successResponse({ id })
  } catch (error: any) {
    console.error('Error deleting shift assignment:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể hủy phân ca',
      500
    )
  }
}
