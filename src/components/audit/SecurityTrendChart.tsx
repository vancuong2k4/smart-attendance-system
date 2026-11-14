'use client'

import React from 'react'
import {
  TrendingUp,
  User,
  Shield,
  Layers,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'

export interface ActorItem {
  userId: string
  email: string
  fullName: string
  employeeCode?: string | null
  avatarUrl?: string | null
  count: number
}

export interface ActionBreakdownItem {
  action: string
  count: number
  label: string
  category: string
}

export interface TrendItem {
  date: string
  total: number
  warningsOrCritical: number
}

interface SecurityTrendChartProps {
  timelineTrend: TrendItem[]
  topActors: ActorItem[]
  actionBreakdown: ActionBreakdownItem[]
}

export function SecurityTrendChart({
  timelineTrend,
  topActors,
  actionBreakdown,
}: SecurityTrendChartProps) {
  const maxTotal = Math.max(...timelineTrend.map((t) => t.total), 1)

  const formatShortDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`
      }
      return dateStr
    } catch {
      return dateStr
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* 1. Biểu đồ xu hướng 7 ngày (2 Cột trên màn hình lớn) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Xu Hướng Sự Kiện & Cảnh Báo An Ninh (7 Ngày)
            </h4>
            <p className="text-xs text-slate-400">
              Số lượng thao tác hệ thống và tỷ lệ cảnh báo bảo mật theo ngày
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              Tổng sự kiện
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-600">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Cảnh báo / Nguy cơ
            </span>
          </div>
        </div>

        {/* Biểu đồ thanh HTML/CSS responsive */}
        <div className="mt-6 flex h-48 items-end gap-2 sm:gap-4 border-b border-slate-100 pb-2">
          {timelineTrend.map((item) => {
            const heightPercent = Math.max(8, Math.round((item.total / maxTotal) * 100))
            const warningPercent =
              item.total > 0
                ? Math.min(100, Math.round((item.warningsOrCritical / item.total) * 100))
                : 0

            return (
              <div key={item.date} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                {/* Tooltip khi hover */}
                <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white shadow-lg group-hover:block whitespace-nowrap">
                  <div className="font-bold">{item.date}</div>
                  <div>Tổng: {item.total} | Cảnh báo: {item.warningsOrCritical}</div>
                </div>

                {/* Cột chính */}
                <div className="w-full max-w-[42px] flex flex-col justify-end h-full">
                  <div
                    className="w-full rounded-t-lg bg-indigo-100 transition-all duration-500 group-hover:bg-indigo-200 relative overflow-hidden"
                    style={{ height: `${heightPercent}%` }}
                  >
                    {/* Phần cảnh báo màu đỏ ở đỉnh cột */}
                    {item.warningsOrCritical > 0 && (
                      <div
                        className="w-full bg-rose-500 rounded-t-lg transition-all"
                        style={{ height: `${warningPercent}%` }}
                      />
                    )}
                  </div>
                </div>

                <span className="mt-2 text-[11px] font-semibold text-slate-500">
                  {formatShortDate(item.date)}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {item.total}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Top người dùng thực hiện thao tác & Phân bổ danh mục */}
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <User className="h-4 w-4 text-indigo-600" />
            Người Dùng Hoạt Động Tích Cực
          </h4>
          <p className="text-xs text-slate-400">
            Tài khoản có nhiều thao tác ghi nhận nhất
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {topActors.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Chưa có dữ liệu hoạt động
            </div>
          ) : (
            topActors.map((actor, idx) => (
              <div key={actor.userId} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 line-clamp-1">
                      {actor.fullName}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">
                      {actor.email}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                  {actor.count} sự kiện
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Breakdown */}
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            Nhóm thao tác phổ biến
          </div>
          <div className="flex flex-wrap gap-1.5">
            {actionBreakdown.slice(0, 4).map((ab) => (
              <span
                key={ab.action}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
              >
                {ab.label}: <strong className="text-slate-900">{ab.count}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
