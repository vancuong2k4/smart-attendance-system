import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkInSchema } from '@/lib/validations'
import { validateGpsLocation } from '@/lib/gps'
import {
  getVietnamDateString,
  parseDateOnly,
  formatVietnamTime,
  calculateAttendanceCheckIn,
} from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employee?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Vui lòng đăng nhập bằng tài khoản nhân viên để thực hiện',
        401
      )
    }

    const body = await req.json()
    const parsed = checkInSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { latitude, longitude, accuracy, deviceInfo } = parsed.data

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employee.id },
      include: {
        branch: {
          include: {
            schedules: {
              where: { isActive: true },
              orderBy: { isDefault: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!employee || !employee.branch) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        'Không tìm thấy thông tin chi nhánh của nhân viên',
        404
      )
    }

    const branch = employee.branch
    const gpsResult = validateGpsLocation(
      latitude,
      longitude,
      branch.latitude,
      branch.longitude,
      branch.gpsRadius,
      accuracy
    )

    if (!gpsResult.isValid) {
      return errorResponse(
        gpsResult.errorCode || ErrorCodes.OUTSIDE_GEOFENCE,
        gpsResult.message || 'Vị trí không hợp lệ',
        400,
        {
          distance: gpsResult.distance,
          allowedRadius: gpsResult.allowedRadius,
        }
      )
    }

    const now = new Date()
    const todayStr = getVietnamDateString(now)
    const todayDate = parseDateOnly(todayStr)

    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate,
        },
      },
    })

    if (existingRecord?.checkInTime) {
      const timeFormatted = formatVietnamTime(existingRecord.checkInTime)
      return errorResponse(
        ErrorCodes.ALREADY_CHECKED_IN,
        `Bạn đã check-in lúc ${timeFormatted} hôm nay.`,
        400,
        {
          checkInTime: existingRecord.checkInTime,
        }
      )
    }

    const schedule = branch.schedules[0] || {
      startTime: '08:00',
      lateThreshold: 15,
    }

    const { lateMinutes, isLate } = calculateAttendanceCheckIn(now, schedule)

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate,
        },
      },
      create: {
        employeeId: employee.id,
        date: todayDate,
        checkInTime: now,
        checkInLat: latitude,
        checkInLon: longitude,
        checkInAccuracy: accuracy,
        checkInDevice: deviceInfo,
        checkInMethod: 'GPS',
        isLate,
        lateMinutes,
        status: 'PRESENT',
      },
      update: {
        checkInTime: now,
        checkInLat: latitude,
        checkInLon: longitude,
        checkInAccuracy: accuracy,
        checkInDevice: deviceInfo,
        checkInMethod: 'GPS',
        isLate,
        lateMinutes,
        status: 'PRESENT',
      },
    })

    const timeFormatted = formatVietnamTime(record.checkInTime)

    return successResponse({
      id: record.id,
      checkInTime: record.checkInTime,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      distanceFromBranch: gpsResult.distance,
      message: `Check-in thành công lúc ${timeFormatted}`,
    })
  } catch (error: any) {
    console.error('Error in check-in API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi hệ thống khi check-in', 500)
  }
}
