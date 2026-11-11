import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { canManageEmployees } from '@/lib/rbac'
import { updateEmployeeSchema } from '@/lib/validations'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    if (!employee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy thông tin nhân viên', 404)
    }

    // RBAC
    if (session.user.role === UserRole.EMPLOYEE) {
      const currentEmpId = session.user.employee?.id
      if (currentEmpId !== id && session.user.id !== employee.userId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem hồ sơ nhân viên khác', 403)
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      if (employee.branchId !== session.user.employee?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền xem nhân viên thuộc chi nhánh mình quản lý',
          403
        )
      }
    }

    return successResponse(employee)
  } catch (error: any) {
    console.error('Error getting employee detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể lấy thông tin nhân viên', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền cập nhật nhân viên', 403)
    }

    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!employee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy thông tin nhân viên', 404)
    }

    // Branch Admin chỉ được chỉnh sửa nhân viên thuộc chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (employee.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền cập nhật nhân viên thuộc chi nhánh mình quản lý',
          403
        )
      }
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu JSON không hợp lệ', 400)
    }

    const parsed = updateEmployeeSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.issues
      )
    }

    const data = parsed.data

    // Kiểm tra ràng buộc chuyển chi nhánh / role đối với Branch Admin
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (data.branchId && data.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Không được chuyển nhân viên sang chi nhánh khác ngoài quyền hạn',
          403
        )
      }
      if (data.role === UserRole.SUPER_ADMIN || data.role === UserRole.HR_MANAGER) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn không có quyền nâng vai trò lên Quản trị viên cấp cao hoặc Quản lý nhân sự',
          403
        )
      }
    }

    // Kiểm tra trùng email
    if (data.email && data.email.toLowerCase().trim() !== employee.user.email.toLowerCase()) {
      const emailClean = data.email.toLowerCase().trim()
      const existingUser = await prisma.user.findUnique({
        where: { email: emailClean },
      })
      if (existingUser && existingUser.id !== employee.userId) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Email đã tồn tại trong hệ thống',
          409
        )
      }
    }

    // Kiểm tra trùng mã nhân viên
    if (data.employeeCode && data.employeeCode.trim() !== employee.employeeCode) {
      const codeClean = data.employeeCode.trim()
      const existingEmp = await prisma.employee.findUnique({
        where: { employeeCode: codeClean },
      })
      if (existingEmp && existingEmp.id !== id) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Mã nhân viên đã tồn tại trong hệ thống',
          409
        )
      }
    }

    // Kiểm tra branchId & departmentId nếu có thay đổi
    const targetBranchId = data.branchId || employee.branchId
    const targetDeptId = data.departmentId || employee.departmentId

    if (data.branchId && data.branchId !== employee.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: data.branchId } })
      if (!branch) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh chỉ định', 404)
      }
    }

    if (data.departmentId && data.departmentId !== employee.departmentId) {
      const department = await prisma.department.findUnique({ where: { id: data.departmentId } })
      if (!department) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy phòng ban chỉ định', 404)
      }
    }

    // Đảm bảo phòng ban thuộc đúng chi nhánh mục tiêu
    if (data.branchId || data.departmentId) {
      const deptCheck = await prisma.department.findUnique({ where: { id: targetDeptId } })
      if (deptCheck && deptCheck.branchId !== targetBranchId) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Phòng ban đã chọn không thuộc chi nhánh này',
          422
        )
      }
    }

    // Xử lý mật khẩu mới nếu có
    let passwordHash: string | undefined
    if (data.password && data.password.trim()) {
      passwordHash = await bcrypt.hash(data.password.trim(), 10)
    }

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      // Cập nhật User
      const userDataToUpdate: any = {}
      if (data.email) userDataToUpdate.email = data.email.toLowerCase().trim()
      if (data.role) userDataToUpdate.role = data.role
      if (data.isActive !== undefined) userDataToUpdate.isActive = data.isActive
      if (passwordHash) userDataToUpdate.passwordHash = passwordHash

      if (Object.keys(userDataToUpdate).length > 0) {
        await tx.user.update({
          where: { id: employee.userId },
          data: userDataToUpdate,
        })
      }

      // Cập nhật Employee
      const empDataToUpdate: any = {}
      if (data.fullName !== undefined) empDataToUpdate.fullName = data.fullName.trim()
      if (data.employeeCode !== undefined) empDataToUpdate.employeeCode = data.employeeCode.trim()
      if (data.branchId !== undefined) empDataToUpdate.branchId = data.branchId
      if (data.departmentId !== undefined) empDataToUpdate.departmentId = data.departmentId
      if (data.position !== undefined) empDataToUpdate.position = data.position ? data.position.trim() : null
      if (data.phoneNumber !== undefined) empDataToUpdate.phoneNumber = data.phoneNumber ? data.phoneNumber.trim() : null
      if (data.address !== undefined) empDataToUpdate.address = data.address ? data.address.trim() : null
      if (data.gender !== undefined) empDataToUpdate.gender = data.gender
      if (data.employmentType !== undefined) empDataToUpdate.employmentType = data.employmentType
      if (data.annualLeaveBalance !== undefined) empDataToUpdate.annualLeaveBalance = data.annualLeaveBalance
      if (data.sickLeaveBalance !== undefined) empDataToUpdate.sickLeaveBalance = data.sickLeaveBalance

      if (data.dateOfBirth !== undefined) {
        empDataToUpdate.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null
      }
      if (data.startDate !== undefined) {
        empDataToUpdate.startDate = data.startDate ? new Date(data.startDate) : undefined
      }
      if (data.endDate !== undefined) {
        empDataToUpdate.endDate = data.endDate ? new Date(data.endDate) : null
      }

      const res = await tx.employee.update({
        where: { id },
        data: empDataToUpdate,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })

      return res
    })

    return successResponse(updatedEmployee)
  } catch (error: any) {
    console.error('Error updating employee:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật hồ sơ nhân viên', 500)
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

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền thực hiện thao tác này', 403)
    }

    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!employee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy thông tin nhân viên', 404)
    }

    // Không được tự khóa hoặc cho chính mình thôi việc
    if (session.user.id === employee.userId) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Không thể tự khóa hoặc thôi việc tài khoản của chính mình',
        400
      )
    }

    // Branch Admin chỉ được thao tác với nhân viên thuộc chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (employee.branchId !== userBranchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền thao tác với nhân viên thuộc chi nhánh mình',
          403
        )
      }
    }

    // Soft delete: Vô hiệu hóa tài khoản và cập nhật ngày kết thúc
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: false },
      })

      await tx.employee.update({
        where: { id },
        data: { endDate: new Date() },
      })
    })

    return successResponse({
      id: employee.id,
      message: 'Đã cho nhân viên thôi việc và khóa tài khoản thành công',
    })
  } catch (error: any) {
    console.error('Error deleting employee:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể thực hiện thao tác thôi việc', 500)
  }
}
