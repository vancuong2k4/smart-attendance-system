'use client'

import React, { useState } from 'react'
import {
  Bell,
  Shield,
  RotateCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCode,
} from 'lucide-react'
import { SystemSettingsData } from './AttendanceRulesTab'

interface NotificationSecurityTabProps {
  settings: SystemSettingsData
  onSuccess: () => void
  isSuperAdmin: boolean
}

export default function NotificationSecurityTab({
  settings,
  onSuccess,
  isSuperAdmin,
}: NotificationSecurityTabProps) {
  const [formData, setFormData] = useState({ ...settings })
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSuperAdmin) return

    setLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Cập nhật thất bại')
      }

      setSuccessMessage('Đã lưu thiết lập thông báo & bảo mật!')
      onSuccess()
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  const handleResetDefaults = async () => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn khôi phục toàn bộ quy tắc hệ thống về cài đặt ban đầu? Mọi thông số tùy chỉnh sẽ bị thay thế.'
      )
    ) {
      return
    }

    setResetLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Không thể khôi phục cài đặt')
      }

      setFormData(json.data)
      setSuccessMessage('Đã khôi phục toàn bộ cài đặt về trạng thái tiêu chuẩn!')
      onSuccess()
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi khôi phục')
    } finally {
      setResetLoading(false)
    }
  }

  const handleExportConfig = async () => {
    setExportLoading(true)
    try {
      const res = await fetch('/api/settings/export')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Xuất cấu hình thất bại')

      // Download as JSON file
      const blob = new Blob([JSON.stringify(json.data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smart-attendance-config-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xuất file')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Bell size={18} className="text-indigo-600" />
          <span>Thông báo, Nhắc việc & An toàn Bảo mật</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý cơ chế thông báo nhắc nhở tự động, thời gian phiên đăng nhập và sao lưu cấu hình
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Notification Toggles */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200/80">
          <div className="pb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Thông báo khi nhân viên đi muộn (Late Arrival Alert)
              </div>
              <div className="text-[11px] text-slate-500">
                Gửi thông báo in-app cho nhân viên và quản lý chi nhánh khi check-in trễ
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.notifyLateArrival}
                onChange={(e) =>
                  setFormData({ ...formData, notifyLateArrival: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Thông báo khi nhân viên về sớm (Early Leave Alert)
              </div>
              <div className="text-[11px] text-slate-500">
                Cảnh báo khi nhân viên bấm check-out trước khi hết giờ ca quy định
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.notifyEarlyLeave}
                onChange={(e) =>
                  setFormData({ ...formData, notifyEarlyLeave: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="py-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Nhắc nhở chấm công vào trước giờ làm (Check-in Reminder)
              </div>
              <div className="text-[11px] text-slate-500">
                Gửi chuông thông báo nhắc nhân viên check-in trước giờ bắt đầu ca 15 phút
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.checkInReminder}
                onChange={(e) =>
                  setFormData({ ...formData, checkInReminder: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Nhắc nhở chấm công ra trước giờ tan làm (Check-out Reminder)
              </div>
              <div className="text-[11px] text-slate-500">
                Nhắc nhở nhân viên quét vân tay/khuôn mặt hoặc check-out trước khi rời cơ quan
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.checkOutReminder}
                onChange={(e) =>
                  setFormData({ ...formData, checkOutReminder: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Session Timeout */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Shield size={14} className="text-indigo-600" />
            <span>Thời gian duy trì phiên đăng nhập (Session Timeout)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="15"
              max="10080"
              required
              disabled={!isSuperAdmin}
              value={formData.sessionTimeoutMinutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sessionTimeoutMinutes: parseInt(e.target.value, 10) || 1440,
                })
              }
              className="w-48 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <span className="text-xs text-slate-500 font-medium">phút ({Math.round(formData.sessionTimeoutMinutes / 60)} giờ)</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Hết thời gian này nếu không có thao tác, hệ thống sẽ tự động yêu cầu đăng nhập lại
          </span>
        </div>

        {/* Submit */}
        {isSuperAdmin && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={resetLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={13} className={resetLoading ? 'animate-spin' : ''} />
                <span>Khôi phục cài đặt gốc</span>
              </button>

              <button
                type="button"
                onClick={handleExportConfig}
                disabled={exportLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                <span>Xuất file sao lưu cấu hình</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang lưu...' : 'Lưu thiết lập'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
