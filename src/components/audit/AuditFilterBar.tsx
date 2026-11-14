'use client'

import React from 'react'
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  Calendar,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react'

interface AuditFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  severity: string
  onSeverityChange: (value: string) => void
  entity: string
  onEntityChange: (value: string) => void
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  onReset: () => void
  onExport: (format: 'csv' | 'json') => void
  isExporting?: boolean
}

export function AuditFilterBar({
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  entity,
  onEntityChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onReset,
  onExport,
  isExporting = false,
}: AuditFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      {/* Hàng 1: Search bar và nút Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo hành động, thực thể, email, IP, mã ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport('csv')}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors disabled:opacity-50"
            title="Xuất file CSV mở bằng Excel (UTF-8)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Xuất CSV
          </button>

          <button
            onClick={() => onExport('json')}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors disabled:opacity-50"
            title="Xuất file JSON lưu trữ tuân thủ"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600" />
            Xuất JSON
          </button>

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Đặt lại tất cả bộ lọc"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đặt lại
          </button>
        </div>
      </div>

      {/* Hàng 2: Bộ lọc chuyên sâu */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 pt-1">
        {/* Severity */}
        <div>
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="ALL">Mọi mức độ (Severity)</option>
            <option value="INFO">INFO (Thông tin)</option>
            <option value="WARNING">WARNING (Cảnh báo)</option>
            <option value="CRITICAL">CRITICAL (Nghiêm trọng)</option>
            <option value="SECURITY">SECURITY (Bảo mật)</option>
          </select>
        </div>

        {/* Entity */}
        <div>
          <select
            value={entity}
            onChange={(e) => onEntityChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="ALL">Mọi thực thể (Entity)</option>
            <option value="SystemSetting">SystemSetting (Cấu hình)</option>
            <option value="Company">Company (Công ty)</option>
            <option value="Branch">Branch (Chi nhánh)</option>
            <option value="Employee">Employee (Nhân sự)</option>
            <option value="AttendanceRecord">Attendance (Chấm công)</option>
            <option value="AttendanceAdjustment">Adjustment (Sửa công)</option>
            <option value="WorkSchedule">Schedule (Ca làm việc)</option>
            <option value="ShiftSwapRequest">ShiftSwap (Đổi ca)</option>
            <option value="LeaveRequest">LeaveRequest (Nghỉ phép)</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full bg-transparent text-xs focus:outline-none"
            placeholder="Từ ngày"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full bg-transparent text-xs focus:outline-none"
            placeholder="Đến ngày"
          />
        </div>
      </div>
    </div>
  )
}
