'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  Sparkles,
  Save,
  AlertCircle,
  Building2,
  Percent,
} from 'lucide-react'
import { HolidayType } from '@prisma/client'
import { HOLIDAY_TYPE_MAP } from '@/lib/holidays'

export interface HolidayFormData {
  id?: string
  name: string
  code: string
  date: string
  endDate?: string | null
  type: HolidayType
  isPaid: boolean
  payMultiplier: number
  year: number
  branchId?: string | null
  description?: string | null
}

interface BranchOption {
  id: string
  name: string
  code: string
}

interface HolidayFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: Partial<HolidayFormData> | null
  branches?: BranchOption[]
  selectedYear?: number
}

export function HolidayFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  branches = [],
  selectedYear = new Date().getFullYear(),
}: HolidayFormModalProps) {
  const isEditing = !!initialData?.id

  const [formData, setFormData] = useState<HolidayFormData>({
    name: '',
    code: '',
    date: new Date().toISOString().split('T')[0],
    endDate: '',
    type: HolidayType.NATIONAL,
    isPaid: true,
    payMultiplier: 3.0,
    year: selectedYear,
    branchId: '',
    description: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tự sinh mã ngày lễ
  const generateCode = (name: string, type: HolidayType, year: number) => {
    const slug = name
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 20)
    return `${slug || 'HOLIDAY'}_${year}`
  }

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      if (initialData) {
        setFormData({
          id: initialData.id,
          name: initialData.name || '',
          code: initialData.code || '',
          date: initialData.date ? initialData.date.substring(0, 10) : new Date().toISOString().split('T')[0],
          endDate: initialData.endDate ? initialData.endDate.substring(0, 10) : '',
          type: initialData.type || HolidayType.NATIONAL,
          isPaid: initialData.isPaid ?? true,
          payMultiplier: initialData.payMultiplier ?? 3.0,
          year: initialData.year || selectedYear,
          branchId: initialData.branchId || '',
          description: initialData.description || '',
        })
      } else {
        const todayStr = new Date().toISOString().split('T')[0]
        setFormData({
          name: '',
          code: '',
          date: todayStr,
          endDate: '',
          type: HolidayType.NATIONAL,
          isPaid: true,
          payMultiplier: 3.0,
          year: selectedYear,
          branchId: '',
          description: '',
        })
      }
    }
  }, [isOpen, initialData, selectedYear])

  const handleTypeChange = (newType: HolidayType) => {
    const meta = HOLIDAY_TYPE_MAP[newType]
    setFormData((prev) => ({
      ...prev,
      type: newType,
      isPaid: meta ? meta.isPaid : true,
      payMultiplier: meta ? meta.defaultMultiplier : 3.0,
      code: prev.name ? generateCode(prev.name, newType, prev.year) : prev.code,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!formData.name.trim()) {
      setErrorMessage('Vui lòng nhập tên ngày lễ / ngày nghỉ')
      return
    }
    if (!formData.code.trim()) {
      setErrorMessage('Vui lòng nhập mã ngày lễ')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        endDate: formData.endDate ? formData.endDate : null,
        branchId: formData.branchId ? formData.branchId : null,
        payMultiplier: Number(formData.payMultiplier),
        year: Number(formData.year),
      }

      const url = isEditing && formData.id ? `/api/holidays/${formData.id}` : '/api/holidays'
      const method = isEditing && formData.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Lỗi khi lưu thông tin ngày lễ')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isEditing ? 'Cập nhật Ngày nghỉ / Làm bù' : 'Thêm Ngày nghỉ / Làm bù Mới'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thiết lập lịch nghỉ lễ, ngày nghỉ riêng và hệ số lương đi làm
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Loại ngày */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Phân loại ngày nghỉ / làm bù <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(HOLIDAY_TYPE_MAP).map(([key, meta]) => {
                const isSelected = formData.type === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTypeChange(key as HolidayType)}
                    className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {meta.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tên và Mã */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tên ngày nghỉ / làm bù <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    name: val,
                    code: prev.code ? prev.code : generateCode(val, prev.type, prev.year),
                  }))
                }}
                placeholder="Ví dụ: Nghỉ Tết Dương Lịch"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mã định danh <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      code: generateCode(prev.name, prev.type, prev.year),
                    }))
                  }
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Tự sinh
                </button>
              </div>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="TET_DUONG_LICH_2026"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Ngày bắt đầu & Ngày kết thúc */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ngày bắt đầu <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  const val = e.target.value
                  const d = new Date(val)
                  setFormData((prev) => ({
                    ...prev,
                    date: val,
                    year: !isNaN(d.getFullYear()) ? d.getFullYear() : prev.year,
                  }))
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ngày kết thúc (nếu kéo dài nhiều ngày)
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Hệ số lương & Hưởng lương */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hệ số lương đi làm (Multiplier)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="5.0"
                  value={formData.payMultiplier}
                  onChange={(e) =>
                    setFormData({ ...formData, payMultiplier: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">
                  {formData.payMultiplier * 100}%
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Lễ Quốc gia theo Luật: 3.0 (300% lương)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Áp dụng chi nhánh
              </label>
              <select
                value={formData.branchId || ''}
                onChange={(e) =>
                  setFormData({ ...formData, branchId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">-- Toàn công ty (Tất cả chi nhánh) --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkbox Hưởng nguyên lương */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPaidCheckbox"
              checked={formData.isPaid}
              onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
            />
            <label htmlFor="isPaidCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nghỉ được hưởng nguyên 100% lương (Paid Leave)
            </label>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ghi chú / Quyết định ban hành
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Thông báo số 01/TB-HR về lịch nghỉ lễ..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Thêm ngày nghỉ'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default HolidayFormModal
