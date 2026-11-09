import * as XLSX from 'xlsx'

export interface PayrollExportRecord {
  employee_code: string
  employee_name: string
  department: string
  branch: string
  work_days: number
  absent_days: number
  paid_leave_days: number
  late_count: number
  ot_hours: number
  period_start: string
  period_end: string
}

/**
 * Đếm số ngày làm việc hành chính (Thứ 2 đến Thứ 6) trong một tháng
 */
export function getStandardWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let count = 0

  for (let day = 1; day <= daysInMonth; day++) {
    // 0 = Sunday, 6 = Saturday
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++
    }
  }

  return count
}

/**
 * Lấy ngày bắt đầu và kết thúc dạng YYYY-MM-DD của tháng
 */
export function getMonthDateRange(year: number, month: number) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthStr = String(month).padStart(2, '0')
  const period_start = `${year}-${monthStr}-01`
  const period_end = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`

  return {
    period_start,
    period_end,
    startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    endDate: new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999)),
    daysInMonth,
  }
}

/**
 * Đếm số ngày nghỉ thuộc về một tháng cụ thể (chỉ tính các ngày làm việc T2-T6)
 */
export function getLeaveDaysInMonth(
  startDateStrOrDate: Date | string,
  endDateStrOrDate: Date | string,
  totalDays: number,
  year: number,
  month: number
): number {
  const { startDate: monthStart, endDate: monthEnd } = getMonthDateRange(year, month)

  const toUtcDate = (val: Date | string): Date => {
    if (typeof val === 'string') {
      const clean = val.includes('T') ? val.split('T')[0] : val
      return new Date(`${clean}T00:00:00.000Z`)
    }
    return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate()))
  }

  const leaveStart = toUtcDate(startDateStrOrDate)
  const leaveEnd = toUtcDate(endDateStrOrDate)

  // Không giao nhau với tháng
  if (leaveStart > monthEnd || leaveEnd < monthStart) {
    return 0
  }

  // Toàn bộ đơn nằm gọn trong tháng
  if (leaveStart >= monthStart && leaveEnd <= monthEnd) {
    return totalDays
  }

  // Đơn vắt qua ranh giới tháng: tính số ngày làm việc trong toàn bộ đơn và số ngày giao với tháng
  const overlapStart = leaveStart < monthStart ? monthStart : leaveStart
  const overlapEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd

  let totalWorkDaysInLeave = 0
  const cur = new Date(leaveStart.getTime())
  while (cur <= leaveEnd) {
    const day = cur.getUTCDay()
    if (day >= 1 && day <= 5) {
      totalWorkDaysInLeave++
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  let overlapWorkDays = 0
  const curOverlap = new Date(overlapStart.getTime())
  while (curOverlap <= overlapEnd) {
    const day = curOverlap.getUTCDay()
    if (day >= 1 && day <= 5) {
      overlapWorkDays++
    }
    curOverlap.setUTCDate(curOverlap.getUTCDate() + 1)
  }

  if (totalWorkDaysInLeave === 0) {
    return 0
  }

  const ratio = overlapWorkDays / totalWorkDaysInLeave
  return Math.round(totalDays * ratio * 10) / 10
}

/**
 * Tính toán số ngày công, vắng mặt, nghỉ phép, đi muộn, giờ OT cho một nhân viên
 */
export function calculateEmployeePayroll({
  employee,
  attendanceRecords,
  leaveRequests,
  overtimeRequests,
  year,
  month,
}: {
  employee: {
    id: string
    employeeCode: string
    fullName: string
    department?: { name: string } | null
    branch?: { name: string } | null
    startDate?: Date | string | null
    endDate?: Date | string | null
  }
  attendanceRecords: Array<{
    date: Date | string
    workDays?: number | null
    isLate?: boolean | null
    status: string
  }>
  leaveRequests: Array<{
    startDate: Date | string
    endDate: Date | string
    totalDays: number
    status: string
    leaveType?: {
      code: string
      name: string
      isPaid: boolean
    } | null
  }>
  overtimeRequests: Array<{
    date: Date | string
    hours: number
    status: string
  }>
  year: number
  month: number
}): PayrollExportRecord {
  const { period_start, period_end } = getMonthDateRange(year, month)

  // 1. Tính tổng ngày công từ AttendanceRecord (chỉ tính công làm việc thực tế, bỏ qua status LEAVE)
  let work_days = 0
  let late_count = 0
  let absent_records_count = 0

  for (const record of attendanceRecords) {
    if (record.status !== 'LEAVE' && record.workDays && record.workDays > 0) {
      work_days += record.workDays
    }
    if (record.isLate) {
      late_count++
    }
    if (record.status === 'ABSENT') {
      absent_records_count++
    }
  }

  // 2. Tính số ngày nghỉ có lương và không lương từ LeaveRequests đã duyệt (chỉ tính phần ngày trong tháng)
  let paid_leave_days = 0
  let unpaid_leave_days = 0

  for (const leave of leaveRequests) {
    if (leave.status === 'APPROVED') {
      const daysInThisMonth = getLeaveDaysInMonth(
        leave.startDate,
        leave.endDate,
        leave.totalDays,
        year,
        month
      )

      if (leave.leaveType?.isPaid) {
        paid_leave_days += daysInThisMonth
      } else {
        unpaid_leave_days += daysInThisMonth
      }
    }
  }

  // 3. Tính số ngày vắng
  const absent_days = absent_records_count + unpaid_leave_days

  // 4. Tính tổng số giờ làm thêm từ OvertimeRequests đã duyệt
  let ot_hours = 0
  for (const ot of overtimeRequests) {
    if (ot.status === 'APPROVED') {
      ot_hours += ot.hours
    }
  }

  return {
    employee_code: employee.employeeCode,
    employee_name: employee.fullName,
    department: employee.department?.name || 'Chưa phân bổ',
    branch: employee.branch?.name || 'Chưa phân bổ',
    work_days: Math.round(work_days * 10) / 10,
    absent_days: Math.round(absent_days * 10) / 10,
    paid_leave_days: Math.round(paid_leave_days * 10) / 10,
    late_count,
    ot_hours: Math.round(ot_hours * 10) / 10,
    period_start,
    period_end,
  }
}

/**
 * Xuất dữ liệu bảng công sang file Excel Buffer
 */
export function generatePayrollExcelBuffer(data: PayrollExportRecord[]): Buffer {
  const worksheetData = data.map((item) => ({
    'Mã nhân viên': item.employee_code,
    'Họ và tên': item.employee_name,
    'Phòng ban': item.department,
    'Chi nhánh': item.branch,
    'Số ngày công': item.work_days,
    'Số ngày vắng': item.absent_days,
    'Nghỉ phép có lương': item.paid_leave_days,
    'Số lần đi muộn': item.late_count,
    'Giờ làm thêm (OT)': item.ot_hours,
    'Từ ngày': item.period_start,
    'Đến ngày': item.period_end,
  }))

  const worksheet = XLSX.utils.json_to_sheet(worksheetData)

  // Đặt độ rộng cho các cột
  worksheet['!cols'] = [
    { wch: 15 }, // Mã nhân viên
    { wch: 25 }, // Họ và tên
    { wch: 20 }, // Phòng ban
    { wch: 22 }, // Chi nhánh
    { wch: 14 }, // Số ngày công
    { wch: 14 }, // Số ngày vắng
    { wch: 18 }, // Nghỉ phép có lương
    { wch: 15 }, // Số lần đi muộn
    { wch: 18 }, // Giờ làm thêm (OT)
    { wch: 14 }, // Từ ngày
    { wch: 14 }, // Đến ngày
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng tính lương')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * Xuất dữ liệu bảng công sang định dạng CSV có UTF-8 BOM
 */
export function generatePayrollCsv(data: PayrollExportRecord[]): string {
  const headers = [
    'Mã nhân viên',
    'Họ và tên',
    'Phòng ban',
    'Chi nhánh',
    'Số ngày công',
    'Số ngày vắng',
    'Nghỉ phép có lương',
    'Số lần đi muộn',
    'Giờ làm thêm (OT)',
    'Từ ngày',
    'Đến ngày',
  ]

  const rows = data.map((item) => [
    `"${item.employee_code}"`,
    `"${item.employee_name.replace(/"/g, '""')}"`,
    `"${item.department.replace(/"/g, '""')}"`,
    `"${item.branch.replace(/"/g, '""')}"`,
    item.work_days,
    item.absent_days,
    item.paid_leave_days,
    item.late_count,
    item.ot_hours,
    `"${item.period_start}"`,
    `"${item.period_end}"`,
  ])

  // \uFEFF là UTF-8 BOM giúp Excel trên Windows tự nhận diện Unicode không bị lỗi font tiếng Việt
  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
}
