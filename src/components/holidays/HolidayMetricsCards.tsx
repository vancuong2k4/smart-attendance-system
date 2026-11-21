'use client'

import React from 'react'
import {
  CalendarDays,
  Sparkles,
  Building,
  Briefcase,
  CheckCircle2,
} from 'lucide-react'
import { HolidayType } from '@prisma/client'

export interface HolidaySummaryData {
  year: number
  month: number
  totalHolidaysInYear: number
  nationalCount: number
  companyCount: number
  compensatoryCount: number
  specialOffCount: number
  workingDaysMonth?: {
    standardWorkDays: number
    actualWorkDays: number
    holidayDays: number
    compensatoryDays: number
  }
}

interface HolidayMetricsCardsProps {
  summary?: HolidaySummaryData | null
  loading?: boolean
  selectedTypeFilter?: string | null
  onFilterType?: (type: HolidayType | null) => void
}

export function HolidayMetricsCards({
  summary,
  loading = false,
  selectedTypeFilter,
  onFilterType,
}: HolidayMetricsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse shadow-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 mb-3" />
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
            <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Tổng ngày nghỉ năm',
      value: summary?.totalHolidaysInYear ?? 0,
      icon: CalendarDays,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'hover:border-indigo-300 dark:hover:border-indigo-700',
      typeValue: null,
      desc: `Lịch công bố năm ${summary?.year || new Date().getFullYear()}`,
    },
    {
      title: 'Lễ Quốc gia (Luật)',
      value: summary?.nationalCount ?? 0,
      icon: Sparkles,
      iconColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'hover:border-rose-300 dark:hover:border-rose-700',
      typeValue: HolidayType.NATIONAL,
      desc: 'Hưởng 100% lương, đi làm x3.0',
    },
    {
      title: 'Nghỉ riêng Công ty',
      value: summary?.companyCount ?? 0,
      icon: Building,
      iconColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/40',
      borderColor: 'hover:border-purple-300 dark:hover:border-purple-700',
      typeValue: HolidayType.COMPANY,
      desc: 'Sự kiện, du lịch, hội nghị',
    },
    {
      title: 'Ngày làm việc bù',
      value: summary?.compensatoryCount ?? 0,
      icon: Briefcase,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'hover:border-amber-300 dark:hover:border-amber-700',
      typeValue: HolidayType.COMPENSATORY_WORK,
      desc: 'Làm cuối tuần bù ngày nghỉ',
    },
    {
      title: `Ngày công tháng ${summary?.month || new Date().getMonth() + 1}`,
      value: summary?.workingDaysMonth?.actualWorkDays ?? 22,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'hover:border-emerald-300 dark:hover:border-emerald-700',
      typeValue: null,
      desc: `Chuẩn: ${summary?.workingDaysMonth?.standardWorkDays ?? 22} công (trừ ${summary?.workingDaysMonth?.holidayDays ?? 0} lễ)`,
      isMetricOnly: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon
        const isSelected = selectedTypeFilter === card.typeValue && !card.isMetricOnly

        return (
          <div
            key={idx}
            onClick={() => {
              if (!card.isMetricOnly && onFilterType) {
                onFilterType(card.typeValue)
              }
            }}
            className={`p-4 bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 shadow-sm ${
              card.isMetricOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              isSelected
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                : `border-slate-200 dark:border-slate-700 ${card.borderColor}`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.bgColor} ${card.iconColor}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {card.value.toLocaleString('vi-VN')}
              </div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {card.title}
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                {card.desc}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
export default HolidayMetricsCards
