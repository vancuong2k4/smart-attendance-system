'use client'

import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  Building,
  Briefcase,
  AlertCircle,
  Clock,
  Send,
  Edit,
  Trash2,
} from 'lucide-react'
import { HolidayType } from '@prisma/client'
import { isDateInRange, HOLIDAY_TYPE_MAP } from '@/lib/holidays'
import HolidayTypeBadge from './HolidayTypeBadge'

interface HolidayCalendarViewProps {
  holidays: any[]
  currentYear: number
  currentMonth: number // 1-12
  onMonthChange: (year: number, month: number) => void
  onEditHoliday?: (holiday: any) => void
  onDeleteHoliday?: (holiday: any) => void
  onBroadcastHoliday?: (holiday: any) => void
  canManage?: boolean
}

export function HolidayCalendarView({
  holidays,
  currentYear,
  currentMonth,
  onMonthChange,
  onEditHoliday,
  onDeleteHoliday,
  onBroadcastHoliday,
  canManage = false,
}: HolidayCalendarViewProps) {
  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    dateStr: string
    dayNumber: number
    isWeekend: boolean
    holiday: any | null
  } | null>(null)

  // Số ngày trong tháng
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  // Ngày bắt đầu của tháng (0 = CN, 1 = T2, ..., 6 = T7)
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay()
  // Chuyển đổi theo tuần bắt đầu từ Thứ Hai: T2=0, T3=1, ..., T7=5, CN=6
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      onMonthChange(currentYear - 1, 12)
    } else {
      onMonthChange(currentYear, currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      onMonthChange(currentYear + 1, 1)
    } else {
      onMonthChange(currentYear, currentMonth + 1)
    }
  }

  const handleToday = () => {
    const now = new Date()
    onMonthChange(now.getFullYear(), now.getMonth() + 1)
  }

  const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

  const today = new Date()
  const isCurrentMonthThisMonth =
    today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Month Navigation Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Tháng {currentMonth} năm {currentYear}
            </h3>
            <p className="text-xs text-slate-400">
              Bản đồ lịch biểu ngày lễ và ngày làm bù trực quan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 shadow-sm transition-colors"
          >
            Hôm nay
          </button>
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l-lg transition-colors"
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-600 dark:text-slate-300 border-x border-slate-200 dark:border-slate-700">
              {currentMonth}/{currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-r-lg transition-colors"
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday Names Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 text-center text-xs font-bold py-2.5 bg-slate-100/60 dark:bg-slate-850 text-slate-600 dark:text-slate-400">
        {weekdays.map((wd, i) => (
          <div key={i} className={i >= 5 ? 'text-amber-600 dark:text-amber-500' : ''}>
            {wd}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-100 dark:divide-slate-750">
        {/* Ô trống đầu tháng */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div
            key={`offset-${i}`}
            className="min-h-[90px] p-2 bg-slate-50/40 dark:bg-slate-900/40 opacity-40 select-none"
          />
        ))}

        {/* Các ngày trong tháng */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNumber = i + 1
          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(
            dayNumber
          ).padStart(2, '0')}`
          const currentDate = new Date(currentYear, currentMonth - 1, dayNumber)
          const dayOfWeek = currentDate.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const isToday = isCurrentMonthThisMonth && today.getDate() === dayNumber

          // Tìm xem ngày này có thuộc ngày lễ nào không
          const holiday =
            holidays.find((h) => isDateInRange(currentDate, h.date, h.endDate)) || null

          let cellBg = isWeekend ? 'bg-slate-50/60 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'
          let borderAccent = ''

          if (holiday) {
            if (holiday.type === HolidayType.NATIONAL) {
              cellBg = 'bg-rose-50/80 dark:bg-rose-950/30'
              borderAccent = 'border-l-4 border-l-rose-500'
            } else if (holiday.type === HolidayType.COMPANY) {
              cellBg = 'bg-purple-50/80 dark:bg-purple-950/30'
              borderAccent = 'border-l-4 border-l-purple-500'
            } else if (holiday.type === HolidayType.COMPENSATORY_WORK) {
              cellBg = 'bg-amber-50/80 dark:bg-amber-950/30'
              borderAccent = 'border-l-4 border-l-amber-500'
            } else if (holiday.type === HolidayType.SPECIAL_OFF) {
              cellBg = 'bg-sky-50/80 dark:bg-sky-950/30'
              borderAccent = 'border-l-4 border-l-sky-500'
            }
          }

          return (
            <div
              key={`day-${dayNumber}`}
              onClick={() =>
                setSelectedDayInfo({
                  dateStr,
                  dayNumber,
                  isWeekend,
                  holiday,
                })
              }
              className={`min-h-[90px] p-2 transition-all cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 flex flex-col justify-between ${cellBg} ${borderAccent} ${
                isToday ? 'ring-2 ring-indigo-500 ring-inset' : ''
              }`}
            >
              {/* Ngày và nhãn Hôm nay */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                    isToday
                      ? 'bg-indigo-600 text-white'
                      : isWeekend
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {dayNumber}
                </span>

                {isToday && (
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    Hôm nay
                  </span>
                )}
              </div>

              {/* Holiday Badge bên trong ô lịch */}
              {holiday && (
                <div className="mt-1 space-y-0.5">
                  <div
                    className={`text-[11px] font-bold truncate rounded px-1.5 py-0.5 flex items-center gap-1 ${
                      holiday.type === HolidayType.NATIONAL
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                        : holiday.type === HolidayType.COMPANY
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
                          : holiday.type === HolidayType.COMPENSATORY_WORK
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                    }`}
                  >
                    {holiday.type === HolidayType.NATIONAL ? (
                      <Sparkles className="w-3 h-3 shrink-0" />
                    ) : holiday.type === HolidayType.COMPANY ? (
                      <Building className="w-3 h-3 shrink-0" />
                    ) : holiday.type === HolidayType.COMPENSATORY_WORK ? (
                      <Briefcase className="w-3 h-3 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">{holiday.name}</span>
                  </div>

                  {holiday.payMultiplier > 1.0 && (
                    <div className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 text-right pr-1">
                      x{holiday.payMultiplier.toFixed(1)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend & Details Drawer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Chú giải:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500" />
            <span>Lễ Quốc gia (300% lương)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-500" />
            <span>Nghỉ riêng Công ty</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500" />
            <span>Ngày làm việc bù</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700" />
            <span>Ngày cuối tuần</span>
          </div>
        </div>

        {/* Selected Day Quick Inspector */}
        {selectedDayInfo && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in">
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-xs">
              {new Date(selectedDayInfo.dateStr).toLocaleDateString('vi-VN')}:
            </span>
            {selectedDayInfo.holiday ? (
              <div className="flex items-center gap-2">
                <HolidayTypeBadge
                  type={selectedDayInfo.holiday.type}
                  payMultiplier={selectedDayInfo.holiday.payMultiplier}
                  showMultiplier={true}
                />
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {selectedDayInfo.holiday.name}
                </span>

                {canManage && (
                  <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                    {onBroadcastHoliday && (
                      <button
                        onClick={() => onBroadcastHoliday(selectedDayInfo.holiday)}
                        title="Phát thông báo"
                        className="p-1 text-slate-400 hover:text-amber-500 rounded"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onEditHoliday && (
                      <button
                        onClick={() => onEditHoliday(selectedDayInfo.holiday)}
                        title="Chỉnh sửa"
                        className="p-1 text-slate-400 hover:text-indigo-500 rounded"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onDeleteHoliday && (
                      <button
                        onClick={() => onDeleteHoliday(selectedDayInfo.holiday)}
                        title="Xóa"
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-slate-500">
                {selectedDayInfo.isWeekend
                  ? 'Ngày nghỉ cuối tuần thông thường'
                  : 'Ngày làm việc tiêu chuẩn (100% lương)'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
export default HolidayCalendarView
