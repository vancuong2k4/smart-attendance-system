import { describe, it, expect } from 'vitest'
import {
  getVietnamDateString,
  parseDateOnly,
  formatVietnamTime,
  calculateAttendanceCheckIn,
  calculateWorkDuration,
  calculateAttendanceCheckOut,
  formatDuration,
  isValidDateString,
  toVietnamDate,
} from '../src/lib/attendance'
import { isWithinCheckInWindow, isWithinCheckOutWindow } from '../src/lib/gps'

describe('Attendance Utilities — Date & Formatting', () => {
  it('tạo chuỗi ngày YYYY-MM-DD theo giờ Việt Nam', () => {
    const fixedDate = new Date('2024-01-15T01:30:00Z') // 08:30 VN
    const dateStr = getVietnamDateString(fixedDate)
    expect(dateStr).toBe('2024-01-15')
  })

  it('parseDateOnly tạo Date UTC 00:00:00', () => {
    const dateObj = parseDateOnly('2024-01-15')
    expect(dateObj.toISOString()).toBe('2024-01-15T00:00:00.000Z')
  })

  it('formatVietnamTime format đúng giờ phút Việt Nam', () => {
    const date = new Date('2024-01-15T01:05:00Z') // 08:05 VN
    const formatted = formatVietnamTime(date)
    expect(formatted).toBe('08:05')
  })

  it('formatDuration định dạng số giờ và phút', () => {
    expect(formatDuration(8.08)).toBe('8 giờ 5 phút')
    expect(formatDuration(4)).toBe('4 giờ')
    expect(formatDuration(0.5)).toBe('30 phút')
  })

  it('isValidDateString kiểm tra đúng định dạng YYYY-MM-DD hợp lệ', () => {
    expect(isValidDateString('2024-01-15')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true) // 2024 là năm nhuận
    expect(isValidDateString('2023-02-29')).toBe(false) // 2023 không nhuận
    expect(isValidDateString('invalid')).toBe(false)
    expect(isValidDateString('15-01-2024')).toBe(false)
    expect(isValidDateString('')).toBe(false)
    expect(isValidDateString(null as any)).toBe(false)
  })

  it('parseDateOnly loại bỏ phần time nếu có', () => {
    const d1 = parseDateOnly('2024-01-15')
    const d2 = parseDateOnly('2024-01-15T08:30:00.000Z')
    expect(d1.toISOString()).toBe('2024-01-15T00:00:00.000Z')
    expect(d2.toISOString()).toBe('2024-01-15T00:00:00.000Z')
  })

  it('toVietnamDate chuyển đổi timestamp sang giờ VN (+7h)', () => {
    const utcDate = new Date('2024-01-15T01:30:00.000Z')
    const vn = toVietnamDate(utcDate)
    expect(vn.getUTCHours()).toBe(8)
    expect(vn.getUTCMinutes()).toBe(30)
    expect(vn.getUTCDate()).toBe(15)
  })
})

describe('Attendance Logic — Check-In', () => {
  const schedule = { startTime: '08:00', lateThreshold: 15 }

  it('check-in trước 08:00 thì không muộn', () => {
    const checkIn = new Date('2024-01-15T07:55:00+07:00')
    const result = calculateAttendanceCheckIn(checkIn, schedule)
    expect(result.lateMinutes).toBe(0)
    expect(result.isLate).toBe(false)
  })

  it('check-in trong buffer 15 phút (08:10) thì ghi nhận số phút nhưng chưa tính là vi phạm trễ', () => {
    const checkIn = new Date('2024-01-15T08:10:00+07:00')
    const result = calculateAttendanceCheckIn(checkIn, schedule)
    expect(result.lateMinutes).toBe(10)
    expect(result.isLate).toBe(false)
  })

  it('check-in sau buffer 15 phút (08:20) thì tính là đi muộn', () => {
    const checkIn = new Date('2024-01-15T08:20:00+07:00')
    const result = calculateAttendanceCheckIn(checkIn, schedule)
    expect(result.lateMinutes).toBe(20)
    expect(result.isLate).toBe(true)
  })
})

describe('Attendance Logic — Check-Out & Work Duration', () => {
  const schedule = {
    startTime: '08:00',
    endTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    lateThreshold: 15,
    earlyThreshold: 15,
  }

  it('tính đúng thời gian làm việc có trừ 1 tiếng nghỉ trưa (8h - 17h = 8h làm việc)', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T17:00:00+07:00')
    const duration = calculateWorkDuration(checkIn, checkOut, '12:00', '13:00')
    expect(duration).toBe(8)
  })

  it('tính đúng thời gian làm việc cho ca check-in 08:02 và check-out 17:07 (~8.08h)', () => {
    const checkIn = new Date('2024-01-15T08:02:00+07:00')
    const checkOut = new Date('2024-01-15T17:07:00+07:00')
    const duration = calculateWorkDuration(checkIn, checkOut, '12:00', '13:00')
    expect(duration).toBe(8.08)
  })

  it('ca làm buổi sáng không bị trừ giờ trưa (08:00 - 12:00 = 4h)', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T12:00:00+07:00')
    const duration = calculateWorkDuration(checkIn, checkOut, '12:00', '13:00')
    expect(duration).toBe(4)
  })

  it('check-out đủ giờ tính 1 công, không về sớm', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T17:00:00+07:00')
    const result = calculateAttendanceCheckOut(checkIn, checkOut, schedule)
    expect(result.workDuration).toBe(8)
    expect(result.workDays).toBe(1)
    expect(result.earlyMinutes).toBe(0)
    expect(result.isEarlyLeave).toBe(false)
  })

  it('check-out lúc 16:50 nằm trong earlyThreshold 15 phút thì không tính về sớm', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T16:50:00+07:00')
    const result = calculateAttendanceCheckOut(checkIn, checkOut, schedule)
    expect(result.earlyMinutes).toBe(10)
    expect(result.isEarlyLeave).toBe(false)
    expect(result.workDays).toBe(1) // 7.83h >= 7h
  })

  it('check-out lúc 16:30 vượt earlyThreshold 15 phút thì tính là về sớm', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T16:30:00+07:00')
    const result = calculateAttendanceCheckOut(checkIn, checkOut, schedule)
    expect(result.earlyMinutes).toBe(30)
    expect(result.isEarlyLeave).toBe(true)
  })

  it('làm 4 giờ tính 0.5 công', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T12:00:00+07:00')
    const result = calculateAttendanceCheckOut(checkIn, checkOut, schedule)
    expect(result.workDuration).toBe(4)
    expect(result.workDays).toBe(0.5)
  })

  it('thời gian check-out nhỏ hơn hoặc bằng check-in trả về duration 0', () => {
    const checkIn = new Date('2024-01-15T08:00:00+07:00')
    const checkOut = new Date('2024-01-15T07:59:00+07:00')
    const duration = calculateWorkDuration(checkIn, checkOut, '12:00', '13:00')
    expect(duration).toBe(0)
  })
})

describe('Attendance Windows — Timezone & Boundary Checks', () => {
  it('isWithinCheckInWindow chấp nhận 06:00 đến 10:00 giờ VN', () => {
    const at6AM_VN = new Date('2024-01-15T06:00:00+07:00')
    const at9AM_VN = new Date('2024-01-15T09:00:00+07:00')
    const at10AM_VN = new Date('2024-01-15T10:00:00+07:00')
    const at559AM_VN = new Date('2024-01-15T05:59:00+07:00')
    const at1001AM_VN = new Date('2024-01-15T10:01:00+07:00')

    expect(isWithinCheckInWindow(at6AM_VN)).toBe(true)
    expect(isWithinCheckInWindow(at9AM_VN)).toBe(true)
    expect(isWithinCheckInWindow(at10AM_VN)).toBe(true)
    expect(isWithinCheckInWindow(at559AM_VN)).toBe(false)
    expect(isWithinCheckInWindow(at1001AM_VN)).toBe(false)
  })

  it('isWithinCheckOutWindow chấp nhận 11:00 đến 22:00 giờ VN', () => {
    const at11AM_VN = new Date('2024-01-15T11:00:00+07:00')
    const at5PM_VN = new Date('2024-01-15T17:00:00+07:00')
    const at10PM_VN = new Date('2024-01-15T22:00:00+07:00')
    const at1059AM_VN = new Date('2024-01-15T10:59:00+07:00')
    const at1001PM_VN = new Date('2024-01-15T22:01:00+07:00')

    expect(isWithinCheckOutWindow(at11AM_VN)).toBe(true)
    expect(isWithinCheckOutWindow(at5PM_VN)).toBe(true)
    expect(isWithinCheckOutWindow(at10PM_VN)).toBe(true)
    expect(isWithinCheckOutWindow(at1059AM_VN)).toBe(false)
    expect(isWithinCheckOutWindow(at1001PM_VN)).toBe(false)
  })
})
