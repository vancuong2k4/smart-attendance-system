'use client'

import React, { useState } from 'react'
import {
  Clock,
  MapPin,
  Camera,
  Compass,
  CheckCircle2,
  AlertCircle,
  Shield,
  Sliders,
} from 'lucide-react'

export interface SystemSettingsData {
  id: string
  companyId: string
  checkInWindowStart: string
  checkInWindowEnd: string
  checkOutWindowStart: string
  checkOutWindowEnd: string
  defaultLateThreshold: number
  defaultEarlyThreshold: number
  requireSelfie: boolean
  requireGps: boolean
  maxGpsAccuracyMeters: number
  payrollStartDay: number
  payrollEndDay: number
  attendanceLockDay: number
  standardWorkDaysMonth: number
  otRateWeekday: number
  otRateWeekend: number
  otRateHoliday: number
  defaultAnnualLeave: number
  defaultSickLeave: number
  allowCarryOverLeave: boolean
  maxCarryOverDays: number
  carryOverDeadline: number
  notifyLateArrival: boolean
  notifyEarlyLeave: boolean
  checkInReminder: boolean
  checkOutReminder: boolean
  sessionTimeoutMinutes: number
}

interface AttendanceRulesTabProps {
  settings: SystemSettingsData
  onSuccess: () => void
  isSuperAdmin: boolean
}

export default function AttendanceRulesTab({
  settings,
  onSuccess,
  isSuperAdmin,
}: AttendanceRulesTabProps) {
  const [formData, setFormData] = useState({ ...settings })
  const [loading, setLoading] = useState(false)
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

      setSuccessMessage('Đã lưu cấu hình quy tắc chấm công & GPS!')
      onSuccess()
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Clock size={18} className="text-indigo-600" />
          <span>Quy tắc Chấm công & Định vị GPS Geofence</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy định khung giờ check-in/out, ngưỡng đi muộn, bắt buộc camera selfie và sai số GPS
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
        {/* Check-in & Check-out Window Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Check-in window */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-600" />
              <span>Khung giờ Check-in (Vào ca)</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Mở check-in từ</label>
                <input
                  type="time"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.checkInWindowStart}
                  onChange={(e) =>
                    setFormData({ ...formData, checkInWindowStart: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Đóng check-in lúc</label>
                <input
                  type="time"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.checkInWindowEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, checkInWindowEnd: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Nhân viên chỉ có thể thực hiện check-in trong khoảng giờ này
            </p>
          </div>

          {/* Check-out window */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-indigo-600" />
              <span>Khung giờ Check-out (Tan ca)</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Mở check-out từ</label>
                <input
                  type="time"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.checkOutWindowStart}
                  onChange={(e) =>
                    setFormData({ ...formData, checkOutWindowStart: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Đóng check-out lúc</label>
                <input
                  type="time"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.checkOutWindowEnd}
                  onChange={(e) =>
                    setFormData({ ...formData, checkOutWindowEnd: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Check-out ngoài khung giờ sẽ yêu cầu gửi đơn giải trình bù công
            </p>
          </div>
        </div>

        {/* Late & Early Thresholds */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ngưỡng tính Đi muộn mặc định (Phút)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              required
              disabled={!isSuperAdmin}
              value={formData.defaultLateThreshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultLateThreshold: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400">
              Sau giờ bắt đầu ca + X phút sẽ tính là đi muộn
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ngưỡng tính Về sớm mặc định (Phút)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              required
              disabled={!isSuperAdmin}
              value={formData.defaultEarlyThreshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultEarlyThreshold: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400">
              Rời trước giờ kết thúc ca quá X phút sẽ tính là về sớm
            </span>
          </div>
        </div>

        {/* GPS and Selfie Toggles */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Compass size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Bắt buộc xác thực vị trí GPS Geofence
                </div>
                <div className="text-[11px] text-slate-500">
                  Từ chối chấm công nếu nhân viên đứng ngoài bán kính chi nhánh
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.requireGps}
                onChange={(e) => setFormData({ ...formData, requireGps: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* GPS Accuracy Slider */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                <Sliders size={13} />
                <span>Độ chính xác GPS tối đa cho phép:</span>
                <strong className="text-indigo-600 font-mono">
                  {formData.maxGpsAccuracyMeters} mét
                </strong>
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              disabled={!isSuperAdmin}
              value={formData.maxGpsAccuracyMeters}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxGpsAccuracyMeters: parseInt(e.target.value, 10),
                })
              }
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>10m (Rất nghiêm ngặt)</span>
              <span>50m (Tiêu chuẩn)</span>
              <span>200m (Thoáng)</span>
            </div>
          </div>

          {/* Selfie Toggle */}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Camera size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Bắt buộc chụp ảnh Selfie khi chấm công
                </div>
                <div className="text-[11px] text-slate-500">
                  Nhân viên bắt buộc mở camera trước để chụp ảnh khuôn mặt tại thời điểm check-in/out
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.requireSelfie}
                onChange={(e) => setFormData({ ...formData, requireSelfie: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Submit */}
        {isSuperAdmin && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang lưu...' : 'Lưu quy tắc chấm công'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
