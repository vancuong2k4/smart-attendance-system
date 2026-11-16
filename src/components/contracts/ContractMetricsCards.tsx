'use client'

import React from 'react'
import {
  FileText,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

export interface ContractMetricsData {
  totalContracts: number
  activeContracts: number
  probationContracts: number
  expiringSoonContracts: number
  expiredContracts: number
}

interface ContractMetricsCardsProps {
  metrics?: ContractMetricsData | null
  loading?: boolean
  onFilterStatus?: (status: string | null) => void
  activeStatusFilter?: string | null
}

export function ContractMetricsCards({
  metrics,
  loading = false,
  onFilterStatus,
  activeStatusFilter,
}: ContractMetricsCardsProps) {
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
      title: 'Tổng hợp đồng',
      value: metrics?.totalContracts ?? 0,
      icon: FileText,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'hover:border-indigo-300 dark:hover:border-indigo-700',
      filterValue: null,
      desc: 'Tất cả các bản ghi',
    },
    {
      title: 'Đang hiệu lực',
      value: metrics?.activeContracts ?? 0,
      icon: ShieldCheck,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'hover:border-emerald-300 dark:hover:border-emerald-700',
      filterValue: 'ACTIVE',
      desc: 'Hợp đồng còn thời hạn',
    },
    {
      title: 'Thử việc',
      value: metrics?.probationContracts ?? 0,
      icon: UserCheck,
      iconColor: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-50 dark:bg-sky-950/40',
      borderColor: 'hover:border-sky-300 dark:hover:border-sky-700',
      filterValue: 'PROBATION',
      desc: 'Nhân sự đang thử việc',
    },
    {
      title: 'Sắp hết hạn',
      value: metrics?.expiringSoonContracts ?? 0,
      icon: AlertTriangle,
      iconColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'hover:border-amber-300 dark:hover:border-amber-700',
      filterValue: 'EXPIRING_SOON',
      desc: 'Cần tái ký trong 30 ngày',
      highlightBadge: (metrics?.expiringSoonContracts ?? 0) > 0,
    },
    {
      title: 'Đã hết hạn',
      value: metrics?.expiredContracts ?? 0,
      icon: XCircle,
      iconColor: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'hover:border-rose-300 dark:hover:border-rose-700',
      filterValue: 'EXPIRED',
      desc: 'Chờ thanh lý hoặc ký mới',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon
        const isSelected = activeStatusFilter === card.filterValue

        return (
          <div
            key={idx}
            onClick={() => onFilterStatus && onFilterStatus(card.filterValue)}
            className={`p-4 bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
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
              {card.highlightBadge && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
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
