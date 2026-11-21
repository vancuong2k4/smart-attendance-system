import { HolidayType } from '@prisma/client'

export interface HolidayTypeMeta {
  label: string
  color: string
  textColor: string
  bgLight: string
  borderColor: string
  defaultMultiplier: number
  isPaid: boolean
  description: string
}

export const HOLIDAY_TYPE_MAP: Record<HolidayType, HolidayTypeMeta> = {
  [HolidayType.NATIONAL]: {
    label: 'Nghỉ lễ Quốc gia',
    color: 'rose',
    textColor: 'text-rose-700 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
    defaultMultiplier: 3.0,
    isPaid: true,
    description: 'Nghỉ lễ theo Bộ luật Lao động, hưởng nguyên lương (đi làm nhân 300%)',
  },
  [HolidayType.COMPANY]: {
    label: 'Nghỉ riêng Công ty',
    color: 'purple',
    textColor: 'text-purple-700 dark:text-purple-400',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-200 dark:border-purple-800',
    defaultMultiplier: 2.0,
    isPaid: true,
    description: 'Ngày nghỉ do công ty quy định (Thành lập, Year-End Party, Teambuilding,...)',
  },
  [HolidayType.COMPENSATORY_WORK]: {
    label: 'Ngày làm việc bù',
    color: 'amber',
    textColor: 'text-amber-700 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    defaultMultiplier: 1.0,
    isPaid: false,
    description: 'Làm việc vào ngày nghỉ cuối tuần để bù cho ngày lễ hoán đổi',
  },
  [HolidayType.SPECIAL_OFF]: {
    label: 'Nghỉ sự cố đặc biệt',
    color: 'sky',
    textColor: 'text-sky-700 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/40',
    borderColor: 'border-sky-200 dark:border-sky-800',
    defaultMultiplier: 1.0,
    isPaid: true,
    description: 'Nghỉ do thiên tai, dịch bệnh hoặc các lý do bất khả kháng được công ty phê duyệt',
  },
}

export interface DefaultNationalHolidayPreset {
  name: string
  code: string
  dateStr: string // YYYY-MM-DD
  endDateStr?: string // YYYY-MM-DD
  type: HolidayType
  isPaid: boolean
  payMultiplier: number
  description: string
}

/**
 * Danh mục chuẩn các ngày lễ Quốc gia của Việt Nam theo năm
 */
export function getVietnameseNationalHolidays(year: number): DefaultNationalHolidayPreset[] {
  // Giỗ tổ Hùng Vương (10/3 Âm Lịch) quy đổi Dương Lịch
  const hungKingsDates: Record<number, string> = {
    2024: `${year}-04-18`,
    2025: `${year}-04-07`,
    2026: `${year}-04-26`,
    2027: `${year}-04-16`,
  }

  // Tết Nguyên Đán quy đổi Dương lịch (khoảng 5-7 ngày)
  const lunarNewYearDates: Record<number, { start: string; end: string }> = {
    2024: { start: `${year}-02-08`, end: `${year}-02-14` },
    2025: { start: `${year}-01-25`, end: `${year}-02-02` },
    2026: { start: `${year}-02-15`, end: `${year}-02-21` },
    2027: { start: `${year}-02-05`, end: `${year}-02-11` },
  }

  const hungKingsDate = hungKingsDates[year] || `${year}-04-15`
  const lunarNewYear = lunarNewYearDates[year] || {
    start: `${year}-02-10`,
    end: `${year}-02-15`,
  }

  return [
    {
      name: 'Tết Dương Lịch',
      code: `NEW_YEAR_${year}`,
      dateStr: `${year}-01-01`,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Nghỉ Tết Dương Lịch theo Bộ luật Lao động (1 ngày)',
    },
    {
      name: 'Tết Nguyên Đán',
      code: `LUNAR_NEW_YEAR_${year}`,
      dateStr: lunarNewYear.start,
      endDateStr: lunarNewYear.end,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Kỳ nghỉ Tết Âm lịch cổ truyền',
    },
    {
      name: 'Giỗ Tổ Hùng Vương',
      code: `HUNG_KINGS_${year}`,
      dateStr: hungKingsDate,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Ngày Giỗ Tổ Hùng Vương (10 tháng 3 Âm lịch)',
    },
    {
      name: 'Ngày Giải phóng miền Nam (30/4)',
      code: `VICTORY_DAY_${year}`,
      dateStr: `${year}-04-30`,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Kỷ niệm Ngày Giải phóng miền Nam, thống nhất đất nước',
    },
    {
      name: 'Ngày Quốc tế Lao động (1/5)',
      code: `LABOR_DAY_${year}`,
      dateStr: `${year}-05-01`,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Kỷ niệm Ngày Quốc tế Lao động',
    },
    {
      name: 'Quốc khánh nước CHXHCN Việt Nam',
      code: `NATIONAL_DAY_${year}`,
      dateStr: `${year}-09-02`,
      endDateStr: `${year}-09-03`,
      type: HolidayType.NATIONAL,
      isPaid: true,
      payMultiplier: 3.0,
      description: 'Kỳ nghỉ Quốc khánh (2 ngày theo quy định Bộ luật Lao động)',
    },
  ]
}

/**
 * Kiểm tra xem một ngày có nằm trong khoảng [startDate, endDate] hay không (tính theo ngày)
 */
export function isDateInRange(
  targetDate: Date | string,
  startDate: Date | string,
  endDate?: Date | string | null
): boolean {
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)

  if (!endDate) {
    return target.getTime() === start.getTime()
  }

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime()
}

/**
 * Tìm kiếm ngày lễ / ngày làm bù áp dụng cho một ngày và chi nhánh cụ thể
 */
export function findHolidayForDate(
  date: Date | string,
  holidays: any[],
  branchId?: string | null
): any | null {
  if (!Array.isArray(holidays) || holidays.length === 0) return null

  return (
    holidays.find((h) => {
      // Phạm vi chi nhánh: null = áp dụng toàn công ty, hoặc khớp branchId
      const matchesBranch = !h.branchId || !branchId || h.branchId === branchId
      if (!matchesBranch) return false

      return isDateInRange(date, h.date, h.endDate)
    }) || null
  )
}

export interface PayMultiplierEvaluation {
  multiplier: number
  isHoliday: boolean
  isCompensatory: boolean
  isWeekend: boolean
  holiday?: any | null
  holidayName?: string
  reason: string
}

/**
 * Đánh giá hệ số tính lương (Pay Multiplier) cho một ngày chấm công
 */
export function calculateDatePayMultiplier(
  date: Date | string,
  holidays: any[] = [],
  branchId?: string | null
): PayMultiplierEvaluation {
  const d = new Date(date)
  const dayOfWeek = d.getDay() // 0 = Chủ nhật, 6 = Thứ bảy
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  const holiday = findHolidayForDate(d, holidays, branchId)

  // 1. Nếu có cấu hình ngày nghỉ lễ / ngày làm bù
  if (holiday) {
    if (holiday.type === HolidayType.COMPENSATORY_WORK) {
      return {
        multiplier: 1.0,
        isHoliday: false,
        isCompensatory: true,
        isWeekend,
        holiday,
        holidayName: holiday.name,
        reason: `Ngày làm việc bù: ${holiday.name} (Hệ số 100%)`,
      }
    }

    const mult = typeof holiday.payMultiplier === 'number' ? holiday.payMultiplier : 3.0
    return {
      multiplier: mult,
      isHoliday: true,
      isCompensatory: false,
      isWeekend,
      holiday,
      holidayName: holiday.name,
      reason: `Nghỉ lễ: ${holiday.name} (Hệ số ${mult * 100}%)`,
    }
  }

  // 2. Nếu là ngày cuối tuần thông thường
  if (dayOfWeek === 0) {
    // Chủ nhật: Làm thêm giờ cuối tuần (theo Bộ luật Lao động hệ số 200%)
    return {
      multiplier: 2.0,
      isHoliday: false,
      isCompensatory: false,
      isWeekend: true,
      reason: 'Ngày nghỉ Chủ nhật (Hệ số 200%)',
    }
  }

  if (dayOfWeek === 6) {
    // Thứ 7: Hệ số 150%
    return {
      multiplier: 1.5,
      isHoliday: false,
      isCompensatory: false,
      isWeekend: true,
      reason: 'Ngày nghỉ Thứ bảy (Hệ số 150%)',
    }
  }

  // 3. Ngày làm việc hành chính bình thường
  return {
    multiplier: 1.0,
    isHoliday: false,
    isCompensatory: false,
    isWeekend: false,
    reason: 'Ngày làm việc tiêu chuẩn (Hệ số 100%)',
  }
}

export interface WorkingDaysSummary {
  standardWorkDays: number // Số ngày T2-T6 trong tháng
  actualWorkDays: number   // Số ngày làm việc thực tế sau khi trừ lễ và cộng bù
  holidayDays: number      // Số ngày lễ hưởng lương rơi vào ngày hành chính
  compensatoryDays: number // Số ngày làm bù rơi vào cuối tuần
}

/**
 * Tính toán số ngày làm việc chuẩn và thực tế trong tháng
 */
export function calculateActualWorkingDaysInMonth(
  year: number,
  month: number, // 1-12
  holidays: any[] = [],
  branchId?: string | null
): WorkingDaysSummary {
  const daysInMonth = new Date(year, month, 0).getDate()
  let standardWorkDays = 0
  let holidayDays = 0
  let compensatoryDays = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const current = new Date(year, month - 1, day)
    const dayOfWeek = current.getDay()
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

    if (isWeekday) {
      standardWorkDays++
    }

    const holiday = findHolidayForDate(current, holidays, branchId)
    if (holiday) {
      if (holiday.type === HolidayType.COMPENSATORY_WORK && !isWeekday) {
        // Ngày làm bù vào cuối tuần -> làm tăng ngày công thực tế
        compensatoryDays++
      } else if (
        (holiday.type === HolidayType.NATIONAL ||
          holiday.type === HolidayType.COMPANY ||
          holiday.type === HolidayType.SPECIAL_OFF) &&
        holiday.isPaid &&
        isWeekday
      ) {
        // Ngày lễ hưởng nguyên lương rơi vào ngày làm việc hành chính
        holidayDays++
      }
    }
  }

  const actualWorkDays = standardWorkDays - holidayDays + compensatoryDays

  return {
    standardWorkDays,
    actualWorkDays,
    holidayDays,
    compensatoryDays,
  }
}
