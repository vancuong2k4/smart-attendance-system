import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { calculateActualWorkingDaysInMonth } from '@/lib/holidays'
import { HolidayType } from '@prisma/client'

/**
 * GET /api/holidays/summary?year=YYYY&month=MM&branchId=...
 * Thống kê tổng hợp số ngày lễ, ngày nghỉ công ty, làm bù và ngày công chuẩn của tháng
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10)
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10)
    const branchId = searchParams.get('branchId')

    const where: any = { year }
    if (branchId) {
      where.OR = [{ branchId: null }, { branchId }]
    }

    const holidays = await prisma.companyHoliday.findMany({
      where,
      orderBy: { date: 'asc' },
    })

    // Đếm theo từng loại trong năm
    let nationalCount = 0
    let companyCount = 0
    let compensatoryCount = 0
    let specialOffCount = 0

    holidays.forEach((h) => {
      if (h.type === HolidayType.NATIONAL) nationalCount++
      else if (h.type === HolidayType.COMPANY) companyCount++
      else if (h.type === HolidayType.COMPENSATORY_WORK) compensatoryCount++
      else if (h.type === HolidayType.SPECIAL_OFF) specialOffCount++
    })

    // Tính toán ngày công làm việc chuẩn và thực tế của tháng được chọn
    const workingDaysMonth = calculateActualWorkingDaysInMonth(
      year,
      month,
      holidays,
      branchId
    )

    return successResponse({
      year,
      month,
      totalHolidaysInYear: holidays.length,
      nationalCount,
      companyCount,
      compensatoryCount,
      specialOffCount,
      workingDaysMonth,
    })
  } catch (error: any) {
    console.error('Error fetching holiday summary:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải thống kê ngày lễ', 500)
  }
}
