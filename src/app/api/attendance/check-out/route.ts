import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkOutSchema } from '@/lib/validations'
import { validateGpsLocation } from '@/lib/gps'
import {
  getVietnamDateString,
  parseDateOnly,
  calculateAttendanceCheckOut,
  formatDuration,
} from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { saveAttendancePhoto } from '@/lib/storage'
import { dispatchWebhookEvent, WebhookEvents } from '@/lib/webhooks'

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
    const parsed = checkOutSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { latitude, longitude, accuracy, deviceInfo, photo, checkOutPhoto } = parsed.data

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

    const record = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate,
        },
      },
    })

    if (!record || !record.checkInTime) {
      return errorResponse(
        ErrorCodes.NOT_CHECKED_IN,
        'Bạn chưa thực hiện check-in hôm nay.',
        400
      )
    }

    if (now.getTime() <= record.checkInTime.getTime()) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Thời gian check-out phải sau thời gian check-in.',
        400
      )
    }

    if (record.checkOutTime) {
      return errorResponse(
        ErrorCodes.ALREADY_CHECKED_OUT,
        'Bạn đã check-out hôm nay rồi.',
        400,
        {
          checkOutTime: record.checkOutTime,
        }
      )
    }

    const schedule = branch.schedules[0] || {
      startTime: '08:00',
      endTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      lateThreshold: 15,
      earlyThreshold: 15,
    }

    const { workDuration, workDays, earlyMinutes, isEarlyLeave } =
      calculateAttendanceCheckOut(record.checkInTime, now, schedule)

    let attendanceStatus = record.status
    if (workDays === 0.5) {
      attendanceStatus = 'HALF_DAY'
    } else if (workDays >= 1) {
      attendanceStatus = 'PRESENT'
    } else {
      attendanceStatus = 'ABSENT'
    }

    let savedPhotoUrl = checkOutPhoto || photo || null
    if (savedPhotoUrl && typeof savedPhotoUrl === 'string' && savedPhotoUrl.trim()) {
      try {
        savedPhotoUrl = await saveAttendancePhoto(savedPhotoUrl.trim(), employee.id)
      } catch (err: any) {
        console.error('Failed to save check-out selfie:', err)
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          err.message || 'Lỗi khi xử lý ảnh selfie check-out',
          422
        )
      }
    } else {
      savedPhotoUrl = null
    }

    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        checkOutLat: latitude,
        checkOutLon: longitude,
        checkOutAccuracy: accuracy,
        checkOutDevice: deviceInfo,
        checkOutPhoto: savedPhotoUrl,
        checkOutMethod: 'GPS',
        workDuration,
        workDays,
        isEarlyLeave,
        earlyMinutes,
        status: attendanceStatus,
      },
    })

    // Kích hoạt Webhook thông báo Check-out (Non-blocking)
    dispatchWebhookEvent(
      WebhookEvents.ATTENDANCE_CHECK_OUT,
      {
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        branchName: employee.branch?.name,
        time: new Date(updatedRecord.checkOutTime!).toLocaleTimeString('vi-VN'),
        workHours: (updatedRecord.workDuration / 60).toFixed(1),
        isEarlyLeave: updatedRecord.isEarlyLeave,
        earlyMinutes: updatedRecord.earlyMinutes,
      },
      employee.branch?.id
    ).catch(() => {})

    return successResponse({
      id: updatedRecord.id,
      checkOutTime: updatedRecord.checkOutTime,
      checkOutPhoto: updatedRecord.checkOutPhoto,
      workDuration: updatedRecord.workDuration,
      workDays: updatedRecord.workDays,
      isEarlyLeave: updatedRecord.isEarlyLeave,
      earlyMinutes: updatedRecord.earlyMinutes,
      message: `Check-out thành công. Thời gian làm việc: ${formatDuration(workDuration)}`,
    })
  } catch (error: any) {
    console.error('Error in check-out API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi hệ thống khi check-out', 500)
  }
}
