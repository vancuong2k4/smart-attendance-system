'use client'

import React, { useState } from 'react'
import {
  DollarSign,
  Calendar,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { SystemSettingsData } from './AttendanceRulesTab'

interface PayrollRulesTabProps {
  settings: SystemSettingsData
  onSuccess: () => void
  isSuperAdmin: boolean
}

export default function PayrollRulesTab({
  settings,
  onSuccess,
  isSuperAdmin,
}: PayrollRulesTabProps) {
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

      setSuccessMessage('Đã lưu quy tắc chu kỳ tính lương và hệ số làm thêm giờ!')
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
          <DollarSign size={18} className="text-indigo-600" />
          <span>Chu kỳ Bảng lương & Hệ số Làm thêm giờ (OT)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy định chu kỳ chốt công, ngày khóa dữ liệu và hệ số nhân lương làm thêm giờ
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
        {/* Cycle and Lock Day */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ngày bắt đầu chu kỳ tính công
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="31"
                required
                disabled={!isSuperAdmin}
                value={formData.payrollStartDay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payrollStartDay: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                VD: Ngày 1 (đầu tháng) hoặc ngày 26
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ngày kết thúc chu kỳ tính công
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="31"
                required
                disabled={!isSuperAdmin}
                value={formData.payrollEndDay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payrollEndDay: parseInt(e.target.value, 10) || 31,
                  })
                }
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                VD: Ngày 31 (cuối tháng) hoặc ngày 25
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ngày khóa dữ liệu công hàng tháng
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="28"
                required
                disabled={!isSuperAdmin}
                value={formData.attendanceLockDay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attendanceLockDay: parseInt(e.target.value, 10) || 5,
                  })
                }
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Sau ngày này, dữ liệu tháng trước bị khóa hoàn toàn
              </span>
            </div>
          </div>
        </div>

        {/* Standard Work Days */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Số ngày công tiêu chuẩn trong tháng
          </label>
          <input
            type="number"
            step="0.5"
            min="15"
            max="30"
            required
            disabled={!isSuperAdmin}
            value={formData.standardWorkDaysMonth}
            onChange={(e) =>
              setFormData({
                ...formData,
                standardWorkDaysMonth: parseFloat(e.target.value) || 22,
              })
            }
            className="w-full sm:w-64 px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Dùng làm mẫu số tính lương theo ngày (VD: 22 ngày công chuẩn / tháng)
          </span>
        </div>

        {/* Overtime (OT) Rate Multipliers */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={14} className="text-indigo-600" />
            <span>Hệ số tính lương làm thêm giờ (Overtime Multipliers)</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-600 mb-1">
                OT Ngày thường (Weekday)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.otRateWeekday}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      otRateWeekday: parseFloat(e.target.value) || 1.5,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Luật LĐ: &ge; 150% (1.5x)</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-1">
                OT Cuối tuần (Weekend)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.otRateWeekend}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      otRateWeekend: parseFloat(e.target.value) || 2.0,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Luật LĐ: &ge; 200% (2.0x)</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-1">
                OT Ngày Lễ, Tết (Holiday)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.otRateHoliday}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      otRateHoliday: parseFloat(e.target.value) || 3.0,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Luật LĐ: &ge; 300% (3.0x)</span>
              </div>
            </div>
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
              <span>{loading ? 'Đang lưu...' : 'Lưu quy tắc bảng lương'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
