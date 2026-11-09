import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { getMonthDateRange, getStandardWorkDaysInMonth } from '@/lib/payroll'
import { UserRole, LeaveStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
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
    if (!allowedRoles.includes(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem báo cáo', 403)
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10)
    let branchId = searchParams.get('branchId')

    if (isNaN(year) || year < 2000 || year > 2100) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Năm không hợp lệ', 400)
    }
    if (isNaN(month) || month < 1 || month > 12) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tháng không hợp lệ (1-12)', 400)
    }

    // Branch Admin chỉ được xem chi nhánh của mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      branchId = session.user.employee?.branchId || null
      if (!branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Tài khoản chưa được gán chi nhánh', 403)
      }
    }

    const totalWorkdays = getStandardWorkDaysInMonth(year, month)
    const { startDate, endDate } = getMonthDateRange(year, month)

    // Lấy danh sách các chi nhánh cần thống kê
    const branchWhere: any = { isActive: true }
    if (branchId) {
      branchWhere.id = branchId
    }

    const branches = await prisma.branch.findMany({
      where: branchWhere,
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    })

    const branchIds = branches.map((b) => b.id)

    // 1. Lấy tất cả nhân viên còn hiệu lực trong kỳ của các chi nhánh
    const employees = await prisma.employee.findMany({
      where: {
        branchId: { in: branchIds },
        startDate: { lte: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
      select: {
        id: true,
        branchId: true,
      },
    })

    const employeeIds = employees.map((e) => e.id)

    // 2. Lấy dữ liệu chấm công trong kỳ
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
      },
      select: {
        employeeId: true,
        workDays: true,
        isLate: true,
        status: true,
      },
    })

    // 3. Lấy dữ liệu đơn OT đã duyệt trong kỳ
    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate, lte: endDate },
        status: LeaveStatus.APPROVED,
      },
      select: {
        employeeId: true,
        hours: true,
      },
    })

    // Nhóm theo chi nhánh
    const empBranchMap = new Map<string, string>()
    employees.forEach((emp) => empBranchMap.set(emp.id, emp.branchId))

    const byBranch = branches.map((b) => {
      const branchEmps = employees.filter((e) => e.branchId === b.id)
      const branchEmpIds = new Set(branchEmps.map((e) => e.id))

      const branchAttendance = attendanceRecords.filter((a) => branchEmpIds.has(a.employeeId))
      const branchOT = overtimeRequests.filter((o) => branchEmpIds.has(o.employeeId))

      let totalWorkDaysSum = 0
      let totalAbsences = 0
      let totalLate = 0

      branchAttendance.forEach((rec) => {
        if (rec.workDays) totalWorkDaysSum += rec.workDays
        if (rec.isLate) totalLate++
        if (rec.status === 'ABSENT' || (rec.status === 'LEAVE' && (!rec.workDays || rec.workDays === 0))) {
          totalAbsences++
        }
      })

      const totalOTHours = branchOT.reduce((acc, curr) => acc + curr.hours, 0)
      const empCount = branchEmps.length

      const maxPossibleWorkdays = empCount * totalWorkdays
      const averageAttendanceRate =
        maxPossibleWorkdays > 0
          ? Math.min(100, Math.round((totalWorkDaysSum / maxPossibleWorkdays) * 1000) / 10)
          : 100

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        totalEmployees: empCount,
        averageAttendanceRate,
        totalAbsences,
        totalLate,
        totalOTHours: Math.round(totalOTHours * 10) / 10,
      }
    })

    // Thống kê tổng hợp toàn bộ
    const totalEmployees = employees.length
    let totalWorkDaysSumAll = 0
    let totalAbsencesAll = 0
    let totalLateAll = 0

    attendanceRecords.forEach((rec) => {
      if (rec.workDays) totalWorkDaysSumAll += rec.workDays
      if (rec.isLate) totalLateAll++
      if (rec.status === 'ABSENT' || (rec.status === 'LEAVE' && (!rec.workDays || rec.workDays === 0))) {
        totalAbsencesAll++
      }
    })

    const totalOTHoursAll = overtimeRequests.reduce((acc, curr) => acc + curr.hours, 0)
    const maxPossibleAll = totalEmployees * totalWorkdays
    const averageAttendanceRateAll =
      maxPossibleAll > 0
        ? Math.min(100, Math.round((totalWorkDaysSumAll / maxPossibleAll) * 1000) / 10)
        : 100

    return successResponse({
      period: { year, month },
      summary: {
        totalWorkdays,
        totalEmployees,
        averageAttendanceRate: averageAttendanceRateAll,
        totalAbsences: totalAbsencesAll,
        totalLate: totalLateAll,
        totalOTHours: Math.round(totalOTHoursAll * 10) / 10,
      },
      byBranch,
    })
  } catch (error: any) {
    console.error('Error getting reports summary:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi tính toán báo cáo tổng quan', 500)
  }
}
