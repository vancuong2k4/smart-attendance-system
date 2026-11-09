import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { LeaveStatus, UserRole } from '@prisma/client'

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
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        leaveType: true,
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

    if (!leave) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn xin nghỉ', 404)
    }

    // Kiểm tra quyền xem
    if (session.user.role === UserRole.EMPLOYEE) {
      if (leave.employeeId !== session.user.employee?.id) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem đơn này', 403)
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      if (leave.employee.branchId !== session.user.employee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn chỉ được xem đơn trong chi nhánh mình', 403)
      }
    }

    return successResponse(leave)
  } catch (error: any) {
    console.error('Error getting leave detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi tải chi tiết đơn nghỉ phép', 500)
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
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    })

    if (!leave) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn xin nghỉ phép', 404)
    }

    // Chỉ người nộp đơn (hoặc SUPER_ADMIN) mới có quyền hủy đơn
    const isOwner = session.user.employee?.id === leave.employeeId
    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    if (!isOwner && !isSuperAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn chỉ có thể hủy đơn xin nghỉ do chính mình tạo',
        403
      )
    }

    // Chỉ được hủy khi đơn đang ở trạng thái PENDING
    if (leave.status !== LeaveStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Chỉ có thể hủy đơn khi đang ở trạng thái chờ duyệt (trạng thái hiện tại: ${leave.status})`,
        400
      )
    }

    const cancelledLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.CANCELLED,
      },
    })

    return successResponse({
      id: cancelledLeave.id,
      status: cancelledLeave.status,
      message: 'Hủy đơn xin nghỉ phép thành công',
    })
  } catch (error: any) {
    console.error('Error cancelling leave request:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi hủy đơn xin nghỉ phép', 500)
  }
}
