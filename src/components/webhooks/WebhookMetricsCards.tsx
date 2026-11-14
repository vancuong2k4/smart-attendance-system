'use client'

import React from 'react'
import {
  Webhook,
  CheckCircle2,
  Activity,
  Send,
  Zap,
  TrendingUp,
} from 'lucide-react'

interface WebhookMetricsCardsProps {
  totalCount: number
  activeCount: number
  totalDeliveries: number
  successRatePercent: number
  averageDurationMs?: number
}

export function WebhookMetricsCards({
  totalCount,
  activeCount,
  totalDeliveries,
  successRatePercent,
  averageDurationMs = 180,
}: WebhookMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Webhooks hoạt động */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Webhooks Đang Bật
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Webhook className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-slate-900">
            {activeCount}
          </span>
          <span className="text-xs font-medium text-slate-400">/ {totalCount} kênh</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          {totalCount > 0
            ? `${Math.round((activeCount / totalCount) * 100)}% đang hoạt động`
            : 'Chưa có cấu hình'}
        </div>
      </div>

      {/* 2. Tỷ lệ giao hàng thành công */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tỷ Lệ Giao Thành Công
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-emerald-600">
            {successRatePercent}%
          </span>
          <span className="text-xs font-medium text-slate-400">Success Rate</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-slate-500">
          Dựa trên 50 lần phát gần nhất
        </div>
      </div>

      {/* 3. Tổng sự kiện đã phát */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Sự Kiện Đã Phát
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Send className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-slate-900">
            {totalDeliveries.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-medium text-slate-400">lượt gửi</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-600">
          <Activity className="h-3 w-3" />
          Đồng bộ tức thời
        </div>
      </div>

      {/* 4. Độ trễ trung bình */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Độ Trễ Trung Bình
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Zap className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-amber-900">
            {averageDurationMs}
          </span>
          <span className="text-xs font-medium text-slate-400">mili-giây (ms)</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-emerald-600">
          Phản hồi mạng siêu tốc
        </div>
      </div>
    </div>
  )
}
