'use client'

import React, { useState } from 'react'
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { SystemSettingsData } from './AttendanceRulesTab'

interface LeavePolicyTabProps {
  settings: SystemSettingsData
  onSuccess: () => void
  isSuperAdmin: boolean
}

export default function LeavePolicyTab({
  settings,
  onSuccess,
  isSuperAdmin,
}: LeavePolicyTabProps) {
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

      setSuccessMessage('Đã lưu chính sách nghỉ phép toàn hệ thống!')
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
          <FileText size={18} className="text-indigo-600" />
          <span>Chính sách Nghỉ phép & Phép năm (Leave Policy)</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Quy định số ngày phép năm, phép ốm hưởng lương và điều kiện cộng dồn phép sang năm sau
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
        {/* Default Leaves */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Số ngày phép năm mặc định (Ngày / Năm)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="30"
              required
              disabled={!isSuperAdmin}
              value={formData.defaultAnnualLeave}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultAnnualLeave: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Tự động cấp vào số dư phép năm cho nhân viên mới (tiêu chuẩn: 12 ngày)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Số ngày nghỉ ốm tiêu chuẩn (Ngày / Năm)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="30"
              required
              disabled={!isSuperAdmin}
              value={formData.defaultSickLeave}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultSickLeave: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Số ngày nghỉ ốm đau có xác nhận của cơ sở y tế
            </span>
          </div>
        </div>

        {/* Carry-over policy card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                Cho phép chuyển ngày phép năm chưa dùng sang năm sau
              </div>
              <div className="text-[11px] text-slate-500">
                Cho phép nhân viên cộng dồn số ngày phép năm còn tồn để sử dụng trong những tháng đầu năm sau
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!isSuperAdmin}
                checked={formData.allowCarryOverLeave}
                onChange={(e) =>
                  setFormData({ ...formData, allowCarryOverLeave: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {formData.allowCarryOverLeave && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200/80">
              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Số ngày phép tồn tối đa được chuyển sang
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="20"
                  required
                  disabled={!isSuperAdmin}
                  value={formData.maxCarryOverDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxCarryOverDays: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Số ngày vượt quá sẽ bị hủy bỏ theo quy chế
                </span>
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">
                  Hạn chót sử dụng phép tồn (Tháng)
                </label>
                <select
                  disabled={!isSuperAdmin}
                  value={formData.carryOverDeadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      carryOverDeadline: parseInt(e.target.value, 10) || 3,
                    })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value={1}>Hết tháng 1 (31/01)</option>
                  <option value={2}>Hết tháng 2 (28/02)</option>
                  <option value={3}>Hết tháng 3 (31/03) - Khuyên dùng</option>
                  <option value={6}>Hết tháng 6 (30/06)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sau thời hạn này, phép năm cũ chưa sử dụng sẽ bị xóa
                </span>
              </div>
            </div>
          )}
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
              <span>{loading ? 'Đang lưu...' : 'Lưu chính sách nghỉ phép'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
