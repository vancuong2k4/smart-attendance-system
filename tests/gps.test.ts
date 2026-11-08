import { describe, it, expect } from 'vitest'
import {
  calculateDistance,
  isWithinRadius,
  validateGpsLocation,
  calculateLateMinutes,
  calculateEarlyLeaveMinutes,
  calculateWorkDays,
} from '../src/lib/gps'

describe('GPS Utilities — Haversine Distance', () => {
  // Tọa độ Chi nhánh Hà Nội
  const branchLat = 21.028511
  const branchLon = 105.834160

  it('tính khoảng cách 0m khi cùng tọa độ', () => {
    const distance = calculateDistance(branchLat, branchLon, branchLat, branchLon)
    expect(Math.round(distance)).toBe(0)
  })

  it('xác nhận nhân viên nằm trong bán kính 100m', () => {
    // Vị trí cách khoảng 30m
    const empLat = 21.0287
    const empLon = 105.8342
    const inside = isWithinRadius(empLat, empLon, branchLat, branchLon, 100)
    expect(inside).toBe(true)
  })

  it('từ chối khi nhân viên ở xa hơn 100m', () => {
    // Vị trí cách hơn 1km
    const empLat = 21.0385
    const empLon = 105.8441
    const validation = validateGpsLocation(empLat, empLon, branchLat, branchLon, 100)
    expect(validation.isValid).toBe(false)
    expect(validation.errorCode).toBe('OUTSIDE_GEOFENCE')
    expect(validation.distance).toBeGreaterThan(100)
  })

  it('từ chối khi độ chính xác GPS quá thấp (> 50m)', () => {
    const validation = validateGpsLocation(branchLat, branchLon, branchLat, branchLon, 100, 75)
    expect(validation.isValid).toBe(false)
    expect(validation.errorCode).toBe('GPS_ACCURACY_LOW')
  })
})

describe('Attendance Rules — Giờ công & Muộn/Sớm', () => {
  it('tính đúng số phút đi muộn', () => {
    const checkIn = new Date('2024-01-15T08:18:00+07:00')
    const lateMin = calculateLateMinutes(checkIn, '08:00')
    expect(lateMin).toBe(18)
  })

  it('không tính muộn khi check-in đúng giờ hoặc sớm hơn', () => {
    const checkIn = new Date('2024-01-15T07:55:00+07:00')
    const lateMin = calculateLateMinutes(checkIn, '08:00')
    expect(lateMin).toBe(0)
  })

  it('tính đúng số phút về sớm', () => {
    const checkOut = new Date('2024-01-15T16:30:00+07:00')
    const earlyMin = calculateEarlyLeaveMinutes(checkOut, '17:00')
    expect(earlyMin).toBe(30)
  })

  it('tính công theo chuẩn: >= 7h = 1 công, >= 4h = 0.5 công, < 4h = 0 công', () => {
    expect(calculateWorkDays(8)).toBe(1)
    expect(calculateWorkDays(7)).toBe(1)
    expect(calculateWorkDays(6.5)).toBe(0.5)
    expect(calculateWorkDays(4)).toBe(0.5)
    expect(calculateWorkDays(3.9)).toBe(0)
  })
})
