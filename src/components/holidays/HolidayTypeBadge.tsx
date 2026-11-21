'use client'

import React from 'react'
import { HolidayType } from '@prisma/client'
import { HOLIDAY_TYPE_MAP } from '@/lib/holidays'
import {
  Sparkles,
  Building,
  Briefcase,
  AlertCircle,
  Percent,
} from 'lucide-react'

interface HolidayTypeBadgeProps {
  type: HolidayType
  payMultiplier?: number | null
  showMultiplier?: boolean
  className?: string
}

export function HolidayTypeBadge({
  type,
  payMultiplier,
  showMultiplier = false,
  className = '',
}: HolidayTypeBadgeProps) {
  const meta = HOLIDAY_TYPE_MAP[type] || {
    label: type,
    textColor: 'text-slate-700 dark:text-slate-300',
    bgLight: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-300 dark:border-slate-700',
    defaultMultiplier: 1.0,
    isPaid: true,
  }

  const getIcon = () => {
    switch (type) {
      case HolidayType.NATIONAL:
        return <Sparkles className="w-3.5 h-3.5 mr-1" />
      case HolidayType.COMPANY:
        return <Building className="w-3.5 h-3.5 mr-1" />
      case HolidayType.COMPENSATORY_WORK:
        return <Briefcase className="w-3.5 h-3.5 mr-1" />
      case HolidayType.SPECIAL_OFF:
        return <AlertCircle className="w-3.5 h-3.5 mr-1" />
      default:
        return null
    }
  }

  const mult = typeof payMultiplier === 'number' ? payMultiplier : meta.defaultMultiplier

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.bgLight} ${meta.textColor} ${meta.borderColor}`}
      >
        {getIcon()}
        {meta.label}
      </span>

      {showMultiplier && mult > 1.0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <Percent className="w-3 h-3 mr-0.5" />
          Lương x{mult.toFixed(1)}
        </span>
      )}
    </div>
  )
}
export default HolidayTypeBadge
