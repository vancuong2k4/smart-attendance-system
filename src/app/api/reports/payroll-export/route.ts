import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, ErrorCodes } from '@/lib/api-response'
import {
  calculateEmployeePayroll,
  generatePayrollCsv,
  generatePayrollExcelBuffer,
  getMonthDateRange,
} from '@/lib/payroll'
import { canExportPayroll } from '@/lib/rbac'
import { LeaveStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canExportPayroll(session.user.role)) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền xuất dữ liệu tính lương',
        403
      )
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10)
    const branchId = searchParams.get('branchId')
    const format = (searchParams.get('format') || 'xlsx').toLowerCase()

    if (isNaN(year) || year < 2000 || year > 2100) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Năm không hợp lệ', 400)
    }
    if (isNaN(month) || month < 1 || month > 12) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tháng không hợp lệ (1-12)', 400)
    }
    if (!['xlsx', 'csv', 'json'].includes(format)) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Định dạng không được hỗ trợ (chỉ hỗ trợ xlsx, csv, json)',
        400
      )
    }

    const { startDate, endDate } = getMonthDateRange(year, month)

    // Lọc theo chi nhánh nếu có
    const employeeWhere: any = {
      startDate: { lte: endDate },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    }
    if (branchId) {
      employeeWhere.branchId = branchId
    }

    // 1. Lấy danh sách nhân viên cùng phòng ban, chi nhánh
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        startDate: true,
        endDate: true,
        department: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
      orderBy: [{ employeeCode: 'asc' }],
    })

    const employeeIds = employees.map((e) => e.id)

    // 2. Lấy toàn bộ AttendanceRecord trong tháng
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        employeeId: true,
        date: true,
        workDays: true,
        isLate: true,
        status: true,
      },
    })

    // 3. Lấy toàn bộ LeaveRequest được duyệt trong tháng
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        totalDays: true,
        status: true,
        leaveType: {
          select: {
            code: true,
            name: true,
            isPaid: true,
          },
        },
      },
    })

    // 4. Lấy toàn bộ OvertimeRequest được duyệt trong tháng
    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveStatus.APPROVED,
        date: { gte: startDate, lte: endDate },
      },
      select: {
        employeeId: true,
        date: true,
        hours: true,
        status: true,
      },
    })

    // 5. Tính toán dữ liệu bảng lương cho từng nhân viên
    const payrollData = employees.map((emp) => {
      const empAttendance = attendanceRecords.filter((a) => a.employeeId === emp.id)
      const empLeaves = leaveRequests.filter((l) => l.employeeId === emp.id)
      const empOT = overtimeRequests.filter((o) => o.employeeId === emp.id)

      return calculateEmployeePayroll({
        employee: emp,
        attendanceRecords: empAttendance,
        leaveRequests: empLeaves,
        overtimeRequests: empOT,
        year,
        month,
      })
    })

    const monthStr = String(month).padStart(2, '0')

    // Trả về theo định dạng yêu cầu
    if (format === 'json') {
      return NextResponse.json(payrollData)
    }

    if (format === 'csv') {
      const csvString = generatePayrollCsv(payrollData)
      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payroll-${year}-${monthStr}.csv"`,
        },
      })
    }

    // Format Excel (.xlsx)
    const excelBuffer = generatePayrollExcelBuffer(payrollData)
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="payroll-${year}-${monthStr}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Error in payroll export API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi khi xuất dữ liệu tính lương', 500)
  }
}
