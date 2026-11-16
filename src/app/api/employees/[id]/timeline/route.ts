import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { UserRole } from '@prisma/client'

/**
 * GET /api/employees/[id]/timeline
 * Lấy danh sách dòng thời gian sự kiện vòng đời (LifecycleEvent) của nhân viên
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

    const { id: employeeId } = await params

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        branchId: true,
        userId: true,
        department: { select: { id: true, name: true } },
        position: true,
        joinedAt: true,
      },
    })

    if (!targetEmployee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy nhân viên', 404)
    }

    // Phân quyền RBAC
    if (session.user.role === UserRole.EMPLOYEE) {
      const currentEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (currentEmp?.id !== targetEmployee.id) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền xem dòng thời gian của nhân viên khác',
          403
        )
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId !== targetEmployee.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền xem dòng thời gian của nhân viên thuộc chi nhánh khác',
          403
        )
      }
    }

    const events = await prisma.lifecycleEvent.findMany({
      where: { employeeId },
      orderBy: { eventDate: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return successResponse({
      employee: targetEmployee,
      events,
    })
  } catch (error) {
    console.error('Error fetching employee lifecycle timeline:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi tải dòng thời gian nhân sự', 500)
  }
}
