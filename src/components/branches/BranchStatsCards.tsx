'use client'

import React from 'react'
import { Building2, CheckCircle2, Compass, Users } from 'lucide-react'

export interface BranchStatsData {
  totalBranches: number
  activeBranches: number
  inactiveBranches: number
  totalEmployees: number
  totalDepartments: number
  averageRadius: number
  minRadius: number
  maxRadius: number
}

interface BranchStatsCardsProps {
  stats: BranchStatsData | null
  loading?: boolean
}

export default function BranchStatsCards({ stats, loading }: BranchStatsCardsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm animate-pulse flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-6 bg-slate-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Tổng số chi nhánh',
      value: stats.totalBranches,
      subtitle: `${stats.inactiveBranches} chi nhánh tạm dừng`,
      icon: <Building2 size={22} />,
      bgIcon: 'bg-indigo-50 text-indigo-600',
      border: 'border-slate-100',
    },
    {
      title: 'Đang hoạt động',
      value: stats.activeBranches,
      subtitle: `${Math.round((stats.activeBranches / (stats.totalBranches || 1)) * 100)}% tỷ lệ vận hành`,
      icon: <CheckCircle2 size={22} />,
      bgIcon: 'bg-emerald-50 text-emerald-600',
      border: 'border-slate-100',
    },
    {
      title: 'Bán kính GPS TB',
      value: `${stats.averageRadius}m`,
      subtitle: `Dao động: ${stats.minRadius}m – ${stats.maxRadius}m`,
      icon: <Compass size={22} />,
      bgIcon: 'bg-violet-50 text-violet-600',
      border: 'border-slate-100',
    },
    {
      title: 'Nhân sự liên kết',
      value: stats.totalEmployees,
      subtitle: `Thuộc ${stats.totalDepartments} phòng ban`,
      icon: <Users size={22} />,
      bgIcon: 'bg-amber-50 text-amber-600',
      border: 'border-slate-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, idx) => (
        <div
          key={idx}
          className={`p-5 rounded-2xl bg-white border ${c.border} shadow-sm hover:shadow-md transition-all flex items-center gap-4`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${c.bgIcon}`}>
            {c.icon}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.title}</p>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-0.5">{c.value}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{c.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
