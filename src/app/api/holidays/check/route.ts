import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { calculateDatePayMultiplier, HOLIDAY_TYPE_MAP } from '@/lib/holidays'

/**
 * GET /api/holidays/check?date=YYYY-MM-DD&branchId=...
 * Kiểm tra một ngày cụ thể có phải là ngày lễ / ngày nghỉ / làm bù không và trả về hệ số lương
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')
    const branchId = searchParams.get('branchId')

    if (!dateParam || isNaN(Date.parse(dateParam))) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Tham số date (YYYY-MM-DD) là bắt buộc và phải hợp lệ',
        400
      )
    }

    const targetDate = new Date(dateParam)
    const year = targetDate.getFullYear()

    // Lấy các ngày lễ trong năm đó
    const holidays = await prisma.companyHoliday.findMany({
      where: {
        year,
        OR: [{ branchId: null }, ...(branchId ? [{ branchId }] : [])],
      },
    })

    const evaluation = calculateDatePayMultiplier(targetDate, holidays, branchId)

    return successResponse({
      date: dateParam,
      ...evaluation,
      typeMeta: evaluation.holiday?.type
        ? HOLIDAY_TYPE_MAP[evaluation.holiday.type as keyof typeof HOLIDAY_TYPE_MAP]
        : null,
    })
  } catch (error: any) {
    console.error('Error checking holiday date:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể kiểm tra ngày lễ', 500)
  }
}
