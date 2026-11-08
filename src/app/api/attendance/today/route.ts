import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getVietnamDateString, parseDateOnly } from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employee?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Vui lòng đăng nhập để xem trạng thái chấm công',
        401
      )
    }

    const employeeId = session.user.employee.id
    const now = new Date()
    const todayStr = getVietnamDateString(now)
    const todayDate = parseDateOnly(todayStr)

    const record = await prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: todayDate,
        },
      },
    })

    let status: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT' = 'NOT_CHECKED_IN'
    if (record?.checkInTime && !record.checkOutTime) {
      status = 'CHECKED_IN'
    } else if (record?.checkInTime && record.checkOutTime) {
      status = 'CHECKED_OUT'
    }

    return successResponse({
      date: todayStr,
      status,
      checkInTime: record?.checkInTime ?? null,
      checkOutTime: record?.checkOutTime ?? null,
      isLate: record?.isLate ?? false,
      lateMinutes: record?.lateMinutes ?? 0,
      isEarlyLeave: record?.isEarlyLeave ?? false,
      earlyMinutes: record?.earlyMinutes ?? 0,
      workDuration: record?.workDuration ?? null,
      workDays: record?.workDays ?? null,
      attendanceStatus: record?.status ?? null,
      record: record ?? null,
    })
  } catch (error: any) {
    console.error('Error in today attendance API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi khi lấy thông tin chấm công hôm nay', 500)
  }
}
