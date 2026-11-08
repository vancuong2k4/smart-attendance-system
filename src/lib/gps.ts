/**
 * GPS Utilities — Tính toán khoảng cách và xác thực vị trí
 * Thuật toán Haversine Formula
 */

/**
 * Tính khoảng cách (mét) giữa 2 tọa độ GPS
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Bán kính Trái Đất (mét)
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Kiểm tra vị trí nhân viên có trong bán kính chi nhánh không
 */
export function isWithinRadius(
  employeeLat: number,
  employeeLon: number,
  branchLat: number,
  branchLon: number,
  radiusMeters: number = 100
): boolean {
  const distance = calculateDistance(employeeLat, employeeLon, branchLat, branchLon)
  return distance <= radiusMeters
}

/**
 * Kết quả kiểm tra GPS đầy đủ
 */
export interface GpsValidationResult {
  isValid: boolean
  distance: number
  allowedRadius: number
  errorCode?: 'OUTSIDE_GEOFENCE' | 'GPS_ACCURACY_LOW'
  message?: string
}

export function validateGpsLocation(
  employeeLat: number,
  employeeLon: number,
  branchLat: number,
  branchLon: number,
  radiusMeters: number = 100,
  accuracyMeters?: number
): GpsValidationResult {
  // Kiểm tra độ chính xác GPS (nếu accuracy > 50m thì không đủ chính xác)
  if (accuracyMeters !== undefined && accuracyMeters > 50) {
    return {
      isValid: false,
      distance: 0,
      allowedRadius: radiusMeters,
      errorCode: 'GPS_ACCURACY_LOW',
      message: `Độ chính xác GPS thấp (${Math.round(accuracyMeters)}m). Vui lòng thử lại ngoài trời.`,
    }
  }

  const distance = calculateDistance(employeeLat, employeeLon, branchLat, branchLon)
  const roundedDistance = Math.round(distance)

  if (distance > radiusMeters) {
    return {
      isValid: false,
      distance: roundedDistance,
      allowedRadius: radiusMeters,
      errorCode: 'OUTSIDE_GEOFENCE',
      message: `Bạn đang cách văn phòng ${roundedDistance}m. Vui lòng di chuyển vào khu vực cho phép (${radiusMeters}m).`,
    }
  }

  return {
    isValid: true,
    distance: roundedDistance,
    allowedRadius: radiusMeters,
  }
}

/**
 * Chuyển đổi timestamp sang Date biểu diễn thời gian Việt Nam (UTC+7)
 */
function toVietnamDateParts(date: Date) {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000)
  return {
    hours: vn.getUTCHours(),
    minutes: vn.getUTCMinutes(),
    seconds: vn.getUTCSeconds(),
  }
}

/**
 * Kiểm tra thời gian có hợp lệ để check-in không (06:00 - 10:00) theo giờ Việt Nam
 */
export function isWithinCheckInWindow(now: Date = new Date()): boolean {
  const { hours, minutes } = toVietnamDateParts(now)
  const totalMinutes = hours * 60 + minutes
  return totalMinutes >= 6 * 60 && totalMinutes <= 10 * 60 // 06:00 - 10:00 VN
}

/**
 * Kiểm tra thời gian có hợp lệ để check-out không (11:00 - 22:00) theo giờ Việt Nam
 */
export function isWithinCheckOutWindow(now: Date = new Date()): boolean {
  const { hours, minutes } = toVietnamDateParts(now)
  const totalMinutes = hours * 60 + minutes
  return totalMinutes >= 11 * 60 && totalMinutes <= 22 * 60 // 11:00 - 22:00 VN
}

/**
 * Tính số phút đi muộn so với giờ bắt đầu theo giờ Việt Nam
 * @param checkInTime - Thời gian check-in thực tế
 * @param scheduleStart - Giờ bắt đầu dạng "08:00"
 * @returns Số phút muộn (0 nếu đúng giờ hoặc sớm)
 */
export function calculateLateMinutes(checkInTime: Date, scheduleStart: string): number {
  const [startHour, startMin] = scheduleStart.split(':').map(Number)
  const { hours, minutes } = toVietnamDateParts(checkInTime)
  const checkInMinutes = hours * 60 + minutes
  const startMinutes = startHour * 60 + startMin
  return Math.max(0, checkInMinutes - startMinutes)
}

/**
 * Tính số phút về sớm so với giờ kết thúc theo giờ Việt Nam
 * @param checkOutTime - Thời gian check-out thực tế
 * @param scheduleEnd - Giờ kết thúc dạng "17:00"
 * @returns Số phút về sớm (0 nếu đúng giờ hoặc muộn)
 */
export function calculateEarlyLeaveMinutes(checkOutTime: Date, scheduleEnd: string): number {
  const [endHour, endMin] = scheduleEnd.split(':').map(Number)
  const { hours, minutes } = toVietnamDateParts(checkOutTime)
  const checkOutMinutes = hours * 60 + minutes
  const endMinutes = endHour * 60 + endMin
  return Math.max(0, endMinutes - checkOutMinutes)
}

/**
 * Tính số ngày công từ số giờ làm việc
 * >= 7h → 1 công | >= 4h → 0.5 công | < 4h → 0 công
 */
export function calculateWorkDays(workHours: number): number {
  if (workHours >= 7) return 1
  if (workHours >= 4) return 0.5
  return 0
}
