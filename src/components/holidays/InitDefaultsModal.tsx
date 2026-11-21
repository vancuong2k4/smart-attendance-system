'use client'

import React, { useState } from 'react'
import {
  X,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react'
import { getVietnameseNationalHolidays } from '@/lib/holidays'

interface InitDefaultsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultYear?: number
}

export function InitDefaultsModal({
  isOpen,
  onClose,
  onSuccess,
  defaultYear = new Date().getFullYear(),
}: InitDefaultsModalProps) {
  const [year, setYear] = useState<number>(defaultYear)
  const [overwrite, setOverwrite] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const presets = getVietnameseNationalHolidays(year)

  const handleInit = async () => {
    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch('/api/holidays/init-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, overwrite }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Lỗi khi khởi tạo ngày lễ quốc gia')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra khi khởi tạo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Nạp Lịch Nghỉ Lễ Quốc Gia Tự Động
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động tạo danh mục ngày lễ Việt Nam theo Luật Lao động cho năm {year}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Chọn năm */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Chọn năm áp dụng:
            </span>
            <div className="flex items-center gap-1.5">
              {[2024, 2025, 2026, 2027].map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                    year === y
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách ngày lễ mẫu */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Danh sách {presets.length} đợt nghỉ lễ chính thức sẽ khởi tạo:
            </div>
            {presets.map((p, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {p.dateStr} {p.endDateStr ? `→ ${p.endDateStr}` : ''}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Lương x{p.payMultiplier.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* Checkbox ghi đè */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="checkbox"
              id="overwriteCheckbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
            />
            <label htmlFor="overwriteCheckbox" className="text-xs text-slate-600 dark:text-slate-400">
              Ghi đè nếu mã ngày lễ đã tồn tại trong năm {year}
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleInit}
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {submitting ? 'Đang nạp...' : `Khởi tạo ngay năm ${year}`}
          </button>
        </div>
      </div>
    </div>
  )
}
export default InitDefaultsModal
