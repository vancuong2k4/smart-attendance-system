import { describe, it, expect } from 'vitest'
import {
  getStandardWorkDaysInMonth,
  getMonthDateRange,
  calculateEmployeePayroll,
  generatePayrollExcelBuffer,
  generatePayrollCsv,
} from '../src/lib/payroll'

describe('Payroll Calculations & Export Utilities', () => {
  describe('getStandardWorkDaysInMonth', () => {
    it('tính đúng số ngày làm việc hành chính (T2-T6) cho tháng 1/2024', () => {
      // Tháng 1/2024: 31 ngày, bắt đầu từ Thứ 2 (1/1) -> 23 ngày làm việc (T2-T6)
      const workdays = getStandardWorkDaysInMonth(2024, 1)
      expect(workdays).toBe(23)
    })

    it('tính đúng số ngày làm việc cho tháng 2/2024 (năm nhuận 29 ngày)', () => {
      // Tháng 2/2024: 29 ngày, bắt đầu Thứ 5 (1/2) -> 21 ngày làm việc
      const workdays = getStandardWorkDaysInMonth(2024, 2)
      expect(workdays).toBe(21)
    })

    it('tính đúng số ngày làm việc cho tháng 4/2024 (30 ngày)', () => {
      // Tháng 4/2024: 30 ngày, bắt đầu Thứ 2 -> 22 ngày làm việc
      const workdays = getStandardWorkDaysInMonth(2024, 4)
      expect(workdays).toBe(22)
    })
  })

  describe('getMonthDateRange', () => {
    it('trả về đúng định dạng YYYY-MM-DD cho đầu tháng và cuối tháng', () => {
      const range = getMonthDateRange(2024, 2)
      expect(range.period_start).toBe('2024-02-01')
      expect(range.period_end).toBe('2024-02-29')
      expect(range.daysInMonth).toBe(29)
    })

    it('hoạt động chính xác cho tháng 12', () => {
      const range = getMonthDateRange(2024, 12)
      expect(range.period_start).toBe('2024-12-01')
      expect(range.period_end).toBe('2024-12-31')
      expect(range.daysInMonth).toBe(31)
    })
  })

  describe('calculateEmployeePayroll', () => {
    const employee = {
      id: 'emp_01',
      employeeCode: 'NV001',
      fullName: 'Nguyễn Văn A',
      department: { name: 'Kỹ thuật' },
      branch: { name: 'Chi nhánh Hà Nội' },
    }

    it('tổng hợp chính xác ngày công, vắng mặt, nghỉ phép, đi muộn và giờ OT', () => {
      const attendanceRecords = [
        { date: '2024-01-02', workDays: 1, isLate: false, status: 'PRESENT' },
        { date: '2024-01-03', workDays: 1, isLate: true, status: 'PRESENT' },
        { date: '2024-01-04', workDays: 0.5, isLate: false, status: 'HALF_DAY' },
        { date: '2024-01-05', workDays: 0, isLate: false, status: 'ABSENT' },
      ]

      const leaveRequests = [
        {
          startDate: '2024-01-10',
          endDate: '2024-01-10',
          totalDays: 1,
          status: 'APPROVED',
          leaveType: { code: 'AL', name: 'Nghỉ phép năm', isPaid: true },
        },
        {
          startDate: '2024-01-15',
          endDate: '2024-01-15',
          totalDays: 1,
          status: 'APPROVED',
          leaveType: { code: 'UL', name: 'Nghỉ không lương', isPaid: false },
        },
        {
          startDate: '2024-01-20',
          endDate: '2024-01-20',
          totalDays: 1,
          status: 'REJECTED', // Không được tính vì bị từ chối
          leaveType: { code: 'AL', name: 'Nghỉ phép năm', isPaid: true },
        },
      ]

      const overtimeRequests = [
        { date: '2024-01-02', hours: 2.5, status: 'APPROVED' },
        { date: '2024-01-03', hours: 1.5, status: 'APPROVED' },
        { date: '2024-01-04', hours: 3.0, status: 'PENDING' }, // Chưa duyệt không tính
      ]

      const result = calculateEmployeePayroll({
        employee,
        attendanceRecords,
        leaveRequests,
        overtimeRequests,
        year: 2024,
        month: 1,
      })

      expect(result.employee_code).toBe('NV001')
      expect(result.employee_name).toBe('Nguyễn Văn A')
      expect(result.department).toBe('Kỹ thuật')
      expect(result.branch).toBe('Chi nhánh Hà Nội')
      expect(result.work_days).toBe(2.5) // 1 + 1 + 0.5
      expect(result.late_count).toBe(1)
      expect(result.paid_leave_days).toBe(1) // 1 ngày AL approved
      expect(result.absent_days).toBe(2) // 1 absent record + 1 ngày UL approved
      expect(result.ot_hours).toBe(4) // 2.5 + 1.5
      expect(result.period_start).toBe('2024-01-01')
      expect(result.period_end).toBe('2024-01-31')
    })

    it('không tính trùng ngày công khi bản ghi chấm công có status LEAVE', () => {
      // Khi đơn nghỉ được duyệt, hệ thống có thể tạo AttendanceRecord với status: LEAVE
      const attendanceRecords = [
        { date: '2024-01-02', workDays: 1, isLate: false, status: 'PRESENT' },
        { date: '2024-01-03', workDays: 1, isLate: false, status: 'PRESENT' },
        { date: '2024-01-04', workDays: 1, isLate: false, status: 'LEAVE' }, // Bản ghi nghỉ phép có lương
      ]

      const leaveRequests = [
        {
          startDate: '2024-01-04',
          endDate: '2024-01-04',
          totalDays: 1,
          status: 'APPROVED',
          leaveType: { code: 'AL', name: 'Nghỉ phép năm', isPaid: true },
        },
      ]

      const result = calculateEmployeePayroll({
        employee,
        attendanceRecords,
        leaveRequests,
        overtimeRequests: [],
        year: 2024,
        month: 1,
      })

      // work_days chỉ tính ngày đi làm thực tế (2 ngày), KHÔNG được cộng thêm ngày LEAVE thành 3!
      expect(result.work_days).toBe(2)
      expect(result.paid_leave_days).toBe(1)
    })

    it('tách chính xác số ngày nghỉ khi đơn xin nghỉ vắt ngang 2 tháng', () => {
      // Đơn nghỉ từ Thứ Hai 29/01/2024 đến Thứ Sáu 02/02/2024:
      // Tháng 1/2024 có 3 ngày làm việc: 29/1, 30/1, 31/1 (T2, T3, T4)
      // Tháng 2/2024 có 2 ngày làm việc: 01/2, 02/2 (T5, T6)
      const crossMonthLeave = [
        {
          startDate: '2024-01-29',
          endDate: '2024-02-02',
          totalDays: 5,
          status: 'APPROVED',
          leaveType: { code: 'AL', name: 'Nghỉ phép năm', isPaid: true },
        },
      ]

      // Tính lương tháng 1/2024: chỉ được tính 3 ngày phép
      const janResult = calculateEmployeePayroll({
        employee,
        attendanceRecords: [],
        leaveRequests: crossMonthLeave,
        overtimeRequests: [],
        year: 2024,
        month: 1,
      })
      expect(janResult.paid_leave_days).toBe(3)

      // Tính lương tháng 2/2024: chỉ được tính 2 ngày phép
      const febResult = calculateEmployeePayroll({
        employee,
        attendanceRecords: [],
        leaveRequests: crossMonthLeave,
        overtimeRequests: [],
        year: 2024,
        month: 2,
      })
      expect(febResult.paid_leave_days).toBe(2)
    })

    it('xử lý chính xác nhân viên đi làm nửa ngày kết hợp nghỉ phép nửa ngày', () => {
      const attendanceRecords = [
        { date: '2024-01-10', workDays: 0.5, isLate: false, status: 'HALF_DAY' },
      ]

      const leaveRequests = [
        {
          startDate: '2024-01-10',
          endDate: '2024-01-10',
          totalDays: 0.5,
          status: 'APPROVED',
          leaveType: { code: 'AL', name: 'Nghỉ phép năm', isPaid: true },
        },
      ]

      const result = calculateEmployeePayroll({
        employee,
        attendanceRecords,
        leaveRequests,
        overtimeRequests: [],
        year: 2024,
        month: 1,
      })

      expect(result.work_days).toBe(0.5)
      expect(result.paid_leave_days).toBe(0.5)
      // Tổng công hưởng lương: 0.5 + 0.5 = 1.0 công
      expect(result.work_days + result.paid_leave_days).toBe(1.0)
    })
  })

  describe('generatePayrollCsv', () => {
    it('tạo chuỗi CSV có BOM UTF-8 và đầy đủ header tiêu chuẩn', () => {
      const sampleData = [
        {
          employee_code: 'NV001',
          employee_name: 'Nguyễn Văn A',
          department: 'Kỹ thuật',
          branch: 'Chi nhánh Hà Nội',
          work_days: 22,
          absent_days: 0,
          paid_leave_days: 1,
          late_count: 0,
          ot_hours: 5,
          period_start: '2024-01-01',
          period_end: '2024-01-31',
        },
      ]

      const csv = generatePayrollCsv(sampleData)
      expect(csv.startsWith('\uFEFF')).toBe(true) // UTF-8 BOM
      expect(csv).toContain('Mã nhân viên')
      expect(csv).toContain('"NV001"')
      expect(csv).toContain('"Nguyễn Văn A"')
      expect(csv).toContain('"Kỹ thuật"')
    })
  })

  describe('generatePayrollExcelBuffer', () => {
    it('tạo file Excel binary buffer hợp lệ', () => {
      const sampleData = [
        {
          employee_code: 'NV001',
          employee_name: 'Nguyễn Văn A',
          department: 'Kỹ thuật',
          branch: 'Chi nhánh Hà Nội',
          work_days: 22,
          absent_days: 0,
          paid_leave_days: 1,
          late_count: 0,
          ot_hours: 5,
          period_start: '2024-01-01',
          period_end: '2024-01-31',
        },
      ]

      const buffer = generatePayrollExcelBuffer(sampleData)
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })
})
