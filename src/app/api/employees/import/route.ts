import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { canManageEmployees } from '@/lib/rbac'
import {
  parseExcelWorkbook,
  getFieldValue,
  parseExcelDate,
  normalizeEmploymentType,
  normalizeRole,
  ImportErrorItem,
} from '@/lib/employee-excel'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền import nhân viên', 403)
    }

    let rows: Record<string, any>[] = []

    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Vui lòng chọn file Excel để tải lên', 400)
      }
      if (file.size === 0) {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'File tải lên không có dữ liệu (0 bytes)', 400)
      }
      const lowerName = file.name.toLowerCase()
      if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Định dạng file không được hỗ trợ (chỉ chấp nhận .xlsx, .xls, .csv)',
          400
        )
      }
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Kiểm tra magic header của file .xlsx (phải là PK zip format)
        if (lowerName.endsWith('.xlsx')) {
          const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
          if (!isZip) {
            return errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              'Không thể đọc nội dung file Excel. File có thể bị hỏng hoặc sai định dạng.',
              400
            )
          }
        }

        rows = parseExcelWorkbook(buffer)
      } catch (parseErr: any) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Không thể đọc nội dung file Excel. File có thể bị hỏng hoặc sai định dạng.',
          400
        )
      }
    } else {
      let body: any
      try {
        body = await req.json()
      } catch {
        return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
      }
      if (Array.isArray(body)) {
        rows = body
      } else if (Array.isArray(body.rows)) {
        rows = body.rows
      } else if (Array.isArray(body.employees)) {
        rows = body.employees
      } else {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Dữ liệu payload phải là mảng bản ghi nhân viên hoặc danh sách rows',
          400
        )
      }
    }

    if (!rows || rows.length === 0) {
      return successResponse({
        total: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: [],
      })
    }

    // Tải danh mục chi nhánh & phòng ban
    const [allBranches, allDepartments] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
      prisma.department.findMany({
        select: { id: true, name: true, code: true, branchId: true },
      }),
    ])

    const errors: ImportErrorItem[] = []
    const seenEmailsInFile = new Set<string>()
    const seenCodesInFile = new Set<string>()

    // Thu thập email & code hợp lệ sơ bộ để kiểm tra trùng trong DB một lần (bulk query)
    const candidateEmails: string[] = []
    const candidateCodes: string[] = []

    for (const row of rows) {
      const email = getFieldValue(row, 'Email', 'email')
      const code = getFieldValue(row, 'Mã nhân viên', 'Mã NV', 'employeeCode', 'Ma NV', 'code')
      if (email && typeof email === 'string') candidateEmails.push(email.trim().toLowerCase())
      if (code && (typeof code === 'string' || typeof code === 'number')) candidateCodes.push(String(code).trim())
    }

    const [existingUsers, existingEmps] = await Promise.all([
      prisma.user.findMany({
        where: { email: { in: candidateEmails } },
        select: { email: true },
      }),
      prisma.employee.findMany({
        where: { employeeCode: { in: candidateCodes } },
        select: { employeeCode: true },
      }),
    ])

    const existingEmailsInDb = new Set(existingUsers.map((u) => u.email.toLowerCase()))
    const existingCodesInDb = new Set(existingEmps.map((e) => e.employeeCode))

    // Hash mật khẩu mặc định sẵn 1 lần
    const defaultPasswordHash = await bcrypt.hash('Nv@123456', 10)

    const validRowsToCreate: Array<{
      rowNumber: number
      email: string
      employeeCode: string
      fullName: string
      phoneNumber: string | null
      position: string | null
      branchId: string
      departmentId: string
      employmentType: any
      startDate: Date
      role: UserRole
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // Dòng 1 là tiêu đề cột

      // Bỏ qua dòng hoàn toàn trống
      const isRowEmpty = Object.values(row).every(
        (val) => val === undefined || val === null || String(val).trim() === ''
      )
      if (isRowEmpty) {
        continue
      }

      const employeeCodeRaw = getFieldValue(
        row,
        'Mã nhân viên',
        'Mã NV',
        'employeeCode',
        'Ma NV',
        'Mã số',
        'code'
      )
      const fullNameRaw = getFieldValue(row, 'Họ và tên', 'Họ tên', 'fullName', 'Ho ten', 'name')
      const emailRaw = getFieldValue(row, 'Email', 'email', 'Địa chỉ email')
      const phoneNumberRaw = getFieldValue(row, 'Số điện thoại', 'SĐT', 'SDT', 'phoneNumber', 'phone')
      const positionRaw = getFieldValue(row, 'Chức danh', 'Chức vụ', 'Vị trí', 'position')
      const branchRaw = getFieldValue(
        row,
        'Mã chi nhánh',
        'Chi nhánh',
        'Tên chi nhánh',
        'branchCode',
        'branchName',
        'branchId'
      )
      const departmentRaw = getFieldValue(
        row,
        'Mã phòng ban',
        'Phòng ban',
        'Tên phòng ban',
        'departmentCode',
        'departmentName',
        'departmentId'
      )
      const employmentTypeRaw = getFieldValue(row, 'Loại hợp đồng', 'Loại HĐ', 'employmentType')
      const startDateRaw = getFieldValue(row, 'Ngày vào làm', 'startDate')
      const roleRaw = getFieldValue(row, 'Vai trò', 'role')

      // Kiểm tra các trường bắt buộc
      if (!employeeCodeRaw || String(employeeCodeRaw).trim() === '') {
        errors.push({ row: rowNumber, error: 'Thiếu mã nhân viên' })
        continue
      }
      if (!fullNameRaw || String(fullNameRaw).trim() === '') {
        errors.push({ row: rowNumber, error: 'Thiếu họ và tên nhân viên' })
        continue
      }
      if (!emailRaw || String(emailRaw).trim() === '') {
        errors.push({ row: rowNumber, error: 'Thiếu địa chỉ email' })
        continue
      }

      const email = String(emailRaw).trim().toLowerCase()
      const employeeCode = String(employeeCodeRaw).trim()
      const fullName = String(fullNameRaw).trim()

      // Kiểm tra định dạng email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        errors.push({ row: rowNumber, error: `Định dạng email không hợp lệ: "${email}"` })
        continue
      }

      // Kiểm tra độ dài mã nhân viên
      if (employeeCode.length < 2 || employeeCode.length > 20) {
        errors.push({ row: rowNumber, error: 'Mã nhân viên phải từ 2 đến 20 ký tự' })
        continue
      }

      // Kiểm tra trùng trong nội bộ file
      if (seenEmailsInFile.has(email)) {
        errors.push({ row: rowNumber, error: `Email "${email}" bị trùng lặp trong file` })
        continue
      }
      if (seenCodesInFile.has(employeeCode)) {
        errors.push({ row: rowNumber, error: `Mã nhân viên "${employeeCode}" bị trùng lặp trong file` })
        continue
      }

      // Kiểm tra trùng với DB
      if (existingEmailsInDb.has(email)) {
        errors.push({ row: rowNumber, error: `Email "${email}" đã tồn tại trong hệ thống` })
        continue
      }
      if (existingCodesInDb.has(employeeCode)) {
        errors.push({ row: rowNumber, error: `Mã nhân viên "${employeeCode}" đã tồn tại trong hệ thống` })
        continue
      }

      // Xác định chi nhánh
      let targetBranch = null
      if (session.user.role === UserRole.BRANCH_ADMIN) {
        const userBranchId = session.user.employee?.branchId
        targetBranch = allBranches.find((b) => b.id === userBranchId)
        if (!targetBranch) {
          errors.push({ row: rowNumber, error: 'Không xác định được chi nhánh của tài khoản quản trị' })
          continue
        }
        if (branchRaw) {
          const rawStr = String(branchRaw).trim().toLowerCase()
          if (
            targetBranch.id.toLowerCase() !== rawStr &&
            targetBranch.code.toLowerCase() !== rawStr &&
            targetBranch.name.toLowerCase() !== rawStr
          ) {
            errors.push({
              row: rowNumber,
              error: `Bạn chỉ có quyền import nhân viên vào chi nhánh "${targetBranch.name}"`,
            })
            continue
          }
        }
      } else {
        if (!branchRaw || String(branchRaw).trim() === '') {
          errors.push({ row: rowNumber, error: 'Thiếu thông tin chi nhánh' })
          continue
        }
        const bStr = String(branchRaw).trim().toLowerCase()
        targetBranch = allBranches.find(
          (b) =>
            b.id.toLowerCase() === bStr ||
            b.code.toLowerCase() === bStr ||
            b.name.toLowerCase() === bStr
        )
        if (!targetBranch) {
          errors.push({ row: rowNumber, error: `Không tìm thấy chi nhánh: "${branchRaw}"` })
          continue
        }
      }

      // Xác định phòng ban
      if (!departmentRaw || String(departmentRaw).trim() === '') {
        errors.push({ row: rowNumber, error: 'Thiếu thông tin phòng ban' })
        continue
      }
      const dStr = String(departmentRaw).trim().toLowerCase()
      const targetDepartment = allDepartments.find(
        (d) =>
          d.branchId === targetBranch.id &&
          (d.id.toLowerCase() === dStr ||
            (d.code && d.code.toLowerCase() === dStr) ||
            d.name.toLowerCase() === dStr)
      )
      if (!targetDepartment) {
        errors.push({
          row: rowNumber,
          error: `Không tìm thấy phòng ban "${departmentRaw}" thuộc chi nhánh "${targetBranch.name}"`,
        })
        continue
      }

      // Parse ngày vào làm
      const startDate = parseExcelDate(startDateRaw) || new Date()
      const employmentType = normalizeEmploymentType(employmentTypeRaw)
      let role = normalizeRole(roleRaw)

      // Ràng buộc vai trò cho Branch Admin: không được nâng cấp thành SUPER_ADMIN hoặc HR_MANAGER
      if (session.user.role === UserRole.BRANCH_ADMIN && (role === UserRole.SUPER_ADMIN || role === UserRole.HR_MANAGER)) {
        role = UserRole.EMPLOYEE
      }

      seenEmailsInFile.add(email)
      seenCodesInFile.add(employeeCode)

      // Chuẩn hoá số điện thoại nếu bị Excel tự chuyển thành số (mất số 0 đầu)
      let phoneNumber: string | null = null
      if (phoneNumberRaw !== undefined && phoneNumberRaw !== null) {
        const phoneStr = String(phoneNumberRaw).trim()
        if (phoneStr) {
          if (/^[35789]\d{8}$/.test(phoneStr)) {
            phoneNumber = '0' + phoneStr
          } else {
            phoneNumber = phoneStr
          }
        }
      }

      validRowsToCreate.push({
        rowNumber,
        email,
        employeeCode,
        fullName,
        phoneNumber,
        position: positionRaw ? String(positionRaw).trim() : null,
        branchId: targetBranch.id,
        departmentId: targetDepartment.id,
        employmentType,
        startDate,
        role,
      })
    }

    let importedCount = 0

    // Thực hiện thêm từng nhân viên vào cơ sở dữ liệu
    for (const item of validRowsToCreate) {
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: item.email,
              passwordHash: defaultPasswordHash,
              role: item.role,
              isActive: true,
            },
          })

          await tx.employee.create({
            data: {
              userId: user.id,
              employeeCode: item.employeeCode,
              fullName: item.fullName,
              phoneNumber: item.phoneNumber,
              position: item.position,
              branchId: item.branchId,
              departmentId: item.departmentId,
              employmentType: item.employmentType,
              startDate: item.startDate,
              annualLeaveBalance: 12,
              sickLeaveBalance: 10,
            },
          })
        })
        importedCount++
      } catch (err: any) {
        console.error(`Failed to import employee row ${item.rowNumber}:`, err)
        errors.push({
          row: item.rowNumber,
          error: `Lỗi khi lưu vào cơ sở dữ liệu: ${err?.message || 'Lỗi không xác định'}`,
        })
      }
    }

    return successResponse({
      total: rows.length,
      importedCount,
      skippedCount: rows.length - importedCount,
      errors,
    })
  } catch (error: any) {
    console.error('Error importing employees:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể thực hiện nhập nhân viên hàng loạt', 500)
  }
}
