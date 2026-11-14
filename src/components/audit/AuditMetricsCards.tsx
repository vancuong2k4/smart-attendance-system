'use client'

import React from 'react'
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  AlertCircle,
  Activity,
  ArrowUpRight,
} from 'lucide-react'

interface SummaryMetrics {
  totalEvents: number
  last24hEvents: number
  criticalCount: number
  warningCount: number
}

interface AuditMetricsCardsProps {
  metrics: SummaryMetrics
}

export function AuditMetricsCards({ metrics }: AuditMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Tổng sự kiện */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tổng sự kiện kiểm toán
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-slate-900">
            {metrics.totalEvents.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-medium text-slate-400">bản ghi</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <Activity className="h-3 w-3" />
          Lưu trữ toàn vẹn & bất biến
        </div>
      </div>

      {/* 2. Hoạt động 24h qua */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Hoạt động 24h qua
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-blue-950">
            {metrics.last24hEvents.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-medium text-slate-400">thao tác mới</span>
        </div>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-blue-600">
          <ArrowUpRight className="h-3 w-3" />
          Cập nhật thời gian thực
        </div>
      </div>

      {/* 3. Cảnh báo nghiêm trọng */}
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
            Sự kiện nghiêm trọng
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-rose-900">
            {metrics.criticalCount.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-medium text-rose-500">Critical / Security</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-rose-700">
          Reset hệ thống, xóa dữ liệu, đăng nhập lỗi
        </div>
      </div>

      {/* 4. Cảnh báo mức vừa (Warning) */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Cảnh báo giám sát
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-amber-900">
            {metrics.warningCount.toLocaleString('vi-VN')}
          </span>
          <span className="text-xs font-medium text-amber-600">Warnings</span>
        </div>
        <div className="mt-2 text-[11px] font-medium text-amber-700">
          Chỉnh sửa cấu hình, từ chối duyệt công
        </div>
      </div>
    </div>
  )
}
