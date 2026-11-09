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
    const ot = await prisma.overtimeRequest.findUnique({
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

    if (!ot) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy yêu cầu OT', 404)
    }

    if (session.user.role === UserRole.EMPLOYEE) {
      if (ot.employeeId !== session.user.employee?.id) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem yêu cầu này', 403)
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      if (ot.employee.branchId !== session.user.employee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn chỉ được xem yêu cầu thuộc chi nhánh mình', 403)
      }
    }

    return successResponse(ot)
  } catch (error: any) {
    console.error('Error getting overtime detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi tải chi tiết yêu cầu làm thêm giờ', 500)
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
    const ot = await prisma.overtimeRequest.findUnique({
      where: { id },
      include: { employee: true },
    })

    if (!ot) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy yêu cầu làm thêm giờ', 404)
    }

    // Chỉ người nộp đơn (hoặc SUPER_ADMIN) mới có quyền hủy yêu cầu
    const isOwner = session.user.employee?.id === ot.employeeId
    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    if (!isOwner && !isSuperAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn chỉ có thể hủy yêu cầu OT do chính mình tạo',
        403
      )
    }

    if (ot.status !== LeaveStatus.PENDING) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Chỉ có thể hủy yêu cầu khi đang ở trạng thái chờ duyệt (trạng thái hiện tại: ${ot.status})`,
        400
      )
    }

    const cancelledOt = await prisma.overtimeRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
    })

    return successResponse({
      id: cancelledOt.id,
      status: cancelledOt.status,
      message: 'Hủy yêu cầu làm thêm giờ thành công',
    })
  } catch (error: any) {
    console.error('Error cancelling overtime request:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi hủy yêu cầu làm thêm giờ', 500)
  }
}
