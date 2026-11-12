import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { updateEmployeeGamification } from '@/lib/gamification'
import { UserRole } from '@prisma/client'

/**
 * POST /api/gamification/recalculate
 * Kích hoạt quét và tính toán lại điểm số, chuỗi streak và cấp huy hiệu cho nhân viên
 * Phân quyền: SUPER_ADMIN, BRANCH_ADMIN, HR_MANAGER
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.BRANCH_ADMIN,
      UserRole.HR_MANAGER,
    ]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền thực hiện tính toán điểm chuyên cần',
        403
      )
    }

    const body = await req.json().catch(() => ({}))
    const now = new Date()
    const month = body.month ? parseInt(body.month, 10) : now.getMonth() + 1
    const year = body.year ? parseInt(body.year, 10) : now.getFullYear()
    const branchId = body.branchId || undefined

    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tháng hoặc năm không hợp lệ', 422)
    }

    // Xây dựng điều kiện tìm nhân viên
    const employeeWhere: any = {}
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      // BRANCH_ADMIN chỉ được tính cho chi nhánh mình quản lý
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp) {
        employeeWhere.branchId = adminEmp.branchId
      }
    } else if (branchId && branchId !== 'all') {
      employeeWhere.branchId = branchId
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, fullName: true },
    })

    let totalProcessed = 0
    let totalNewBadges = 0

    for (const emp of employees) {
      try {
        const result = await updateEmployeeGamification(emp.id, month, year)
        totalProcessed++
        totalNewBadges += result.newBadges.length
      } catch (err) {
        console.error(`Failed to update gamification for employee ${emp.id}:`, err)
      }
    }

    // Ghi AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GAMIFICATION_RECALCULATED',
        entity: 'AttendanceStreak',
        entityId: `${month}-${year}`,
        newData: {
          month,
          year,
          branchId: branchId || 'all',
          totalProcessed,
          totalNewBadges,
        },
      },
    })

    return successResponse({
      message: `Đã tính toán thành công cho ${totalProcessed} nhân viên`,
      totalProcessed,
      totalNewBadges,
      month,
      year,
    })
  } catch (error: any) {
    console.error('Error in POST /api/gamification/recalculate:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tính toán điểm chuyên cần', 500)
  }
}
