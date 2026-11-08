import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseDateOnly, isValidDateString } from '@/lib/attendance'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employee?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Vui lòng đăng nhập để xem lịch sử chấm công',
        401
      )
    }

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: Prisma.AttendanceRecordWhereInput = {
      employeeId: session.user.employee.id,
    }

    if (from || to) {
      where.date = {}
      if (from) {
        if (!isValidDateString(from)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số from không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date.gte = parseDateOnly(from)
      }
      if (to) {
        if (!isValidDateString(to)) {
          return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Tham số to không hợp lệ (YYYY-MM-DD)', 422)
        }
        where.date.lte = parseDateOnly(to)
      }
    }

    const [total, records] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return successResponse({
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in attendance history API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi khi lấy lịch sử chấm công', 500)
  }
}
