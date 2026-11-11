import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { cancelAttendanceAdjustment } from '@/lib/attendance-adjustment'
import { AdjustmentStatus, UserRole } from '@prisma/client'

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
    const adjustment = await prisma.attendanceAdjustment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            branchId: true,
            department: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!adjustment) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn giải trình', 404)
    }

    // Kiểm tra quyền xem
    if (session.user.role === UserRole.EMPLOYEE) {
      if (adjustment.employeeId !== session.user.employee?.id) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem đơn này', 403)
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      if (adjustment.employee.branchId !== session.user.employee?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ được xem đơn trong chi nhánh mình',
          403
        )
      }
    }

    return successResponse(adjustment)
  } catch (error: any) {
    console.error('Error getting adjustment detail:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Lỗi khi tải chi tiết đơn giải trình bù công',
      500
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await params
    const currentEmpId = session.user.employee?.id
    const isSuperAdminUser = session.user.role === UserRole.SUPER_ADMIN

    const adjustment = await prisma.attendanceAdjustment.findUnique({
      where: { id },
    })

    if (!adjustment) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn giải trình', 404)
    }

    if (adjustment.status !== AdjustmentStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Chỉ có thể hủy đơn đang ở trạng thái chờ duyệt (trạng thái hiện tại: ${adjustment.status})`,
        400
      )
    }

    if (adjustment.employeeId !== currentEmpId && !isSuperAdminUser) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền hủy đơn giải trình của người khác',
        403
      )
    }

    const cancelled = await cancelAttendanceAdjustment(
      prisma,
      id,
      adjustment.employeeId,
      isSuperAdminUser
    )

    return successResponse({
      message: 'Hủy đơn giải trình thành công',
      adjustment: cancelled,
    })
  } catch (error: any) {
    console.error('Error cancelling adjustment:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      error.message || 'Lỗi khi hủy đơn giải trình',
      500
    )
  }
}
