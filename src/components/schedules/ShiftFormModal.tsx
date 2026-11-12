'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Clock,
  Building2,
  Calendar,
  Coffee,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { calculateShiftDuration, formatWorkDaysLabel } from '@/lib/shift-engine'

export interface ShiftFormData {
  id?: string
  branchId: string
  name: string
  startTime: string
  endTime: string
  lunchStart?: string | null
  lunchEnd?: string | null
  workDays: number[]
  lateThreshold: number
  earlyThreshold: number
  isDefault: boolean
  isActive: boolean
}

interface ShiftFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: ShiftFormData | null
  branches: Array<{ id: string; name: string; code: string }>
  userBranchId?: string
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 7, label: 'Chủ Nhật' },
]

export default function ShiftFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  branches,
  userBranchId,
}: ShiftFormModalProps) {
  const isEditing = !!initialData?.id

  const [formData, setFormData] = useState<ShiftFormData>({
    branchId: userBranchId || branches[0]?.id || '',
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    workDays: [1, 2, 3, 4, 5],
    lateThreshold: 15,
    earlyThreshold: 15,
    isDefault: false,
    isActive: true,
  })

  const [hasLunch, setHasLunch] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        branchId: initialData.branchId,
        name: initialData.name,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        lunchStart: initialData.lunchStart,
        lunchEnd: initialData.lunchEnd,
        workDays: initialData.workDays || [1, 2, 3, 4, 5],
        lateThreshold: initialData.lateThreshold ?? 15,
        earlyThreshold: initialData.earlyThreshold ?? 15,
        isDefault: initialData.isDefault ?? false,
        isActive: initialData.isActive ?? true,
      })
      setHasLunch(!!(initialData.lunchStart && initialData.lunchEnd))
    } else {
      setFormData({
        branchId: userBranchId || branches[0]?.id || '',
        name: '',
        startTime: '08:00',
        endTime: '17:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        workDays: [1, 2, 3, 4, 5],
        lateThreshold: 15,
        earlyThreshold: 15,
        isDefault: false,
        isActive: true,
      })
      setHasLunch(true)
    }
    setErrorMessage(null)
  }, [initialData, isOpen, userBranchId, branches])

  if (!isOpen) return null

  // Calculate live work duration
  const netHours = calculateShiftDuration(
    formData.startTime,
    formData.endTime,
    hasLunch ? formData.lunchStart : null,
    hasLunch ? formData.lunchEnd : null
  )

  const toggleDay = (day: number) => {
    setFormData((prev) => {
      const exists = prev.workDays.includes(day)
      const updated = exists
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day]
      return { ...prev, workDays: updated }
    })
  }

  const setPresetDays = (preset: 'T2-T6' | 'T2-T7' | 'ALL') => {
    if (preset === 'T2-T6') setFormData({ ...formData, workDays: [1, 2, 3, 4, 5] })
    if (preset === 'T2-T7') setFormData({ ...formData, workDays: [1, 2, 3, 4, 5, 6] })
    if (preset === 'ALL') setFormData({ ...formData, workDays: [1, 2, 3, 4, 5, 6, 7] })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    if (formData.workDays.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 ngày làm việc trong tuần')
      setLoading(false)
      return
    }

    try {
      const url = isEditing ? `/api/schedules/${initialData.id}` : '/api/schedules'
      const method = isEditing ? 'PATCH' : 'POST'

      const payload = {
        branchId: formData.branchId,
        name: formData.name.trim(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        lunchStart: hasLunch ? formData.lunchStart || null : null,
        lunchEnd: hasLunch ? formData.lunchEnd || null : null,
        workDays: formData.workDays,
        lateThreshold: Number(formData.lateThreshold),
        earlyThreshold: Number(formData.earlyThreshold),
        isDefault: formData.isDefault,
        isActive: formData.isActive,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Thao tác không thành công')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isEditing ? 'Chỉnh sửa ca làm việc' : 'Tạo ca làm việc mới'}
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập khung giờ chấm công, nghỉ trưa và lịch làm việc trong tuần
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Branch & Shift Name Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Chi nhánh áp dụng <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  disabled={isEditing || !!userBranchId}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên ca làm việc <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Ca Hành Chính, Ca Sáng, Ca Chiều"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Time Window Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={15} className="text-indigo-600" />
                <span>Khung giờ làm việc</span>
              </span>

              <div className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                Thời lượng: {netHours} giờ công
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Giờ bắt đầu vào ca</label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Giờ kết thúc ca</label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* Lunch break toggle & inputs */}
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasLunch}
                    onChange={(e) => setHasLunch(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <Coffee size={14} className="text-amber-500" />
                  <span>Trừ giờ nghỉ trưa</span>
                </label>
              </div>

              {hasLunch && (
                <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Nghỉ trưa từ</label>
                    <input
                      type="time"
                      value={formData.lunchStart || ''}
                      onChange={(e) => setFormData({ ...formData, lunchStart: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Nghỉ trưa đến</label>
                    <input
                      type="time"
                      value={formData.lunchEnd || ''}
                      onChange={(e) => setFormData({ ...formData, lunchEnd: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Working Days Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                <span>Ngày làm việc trong tuần</span>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPresetDays('T2-T6')}
                  className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-medium"
                >
                  T2 - T6
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDays('T2-T7')}
                  className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-medium"
                >
                  T2 - T7
                </button>
                <button
                  type="button"
                  onClick={() => setPresetDays('ALL')}
                  className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-medium"
                >
                  Cả tuần
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((d) => {
                const selected = formData.workDays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Đã chọn: <span className="font-medium text-slate-600">{formatWorkDaysLabel(formData.workDays)}</span>
            </p>
          </div>

          {/* Thresholds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cho phép đi muộn tối đa (phút)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={formData.lateThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, lateThreshold: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Vượt quá sẽ tính là Đi muộn</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cho phép về sớm tối đa (phút)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={formData.earlyThreshold}
                onChange={(e) =>
                  setFormData({ ...formData, earlyThreshold: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Rời sớm trước ngưỡng sẽ tính là Về sớm</span>
            </div>
          </div>

          {/* Default and Active Toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-semibold text-slate-700">Đặt làm ca mặc định của chi nhánh</span>
                <p className="text-[11px] text-slate-400">
                  Tự động áp dụng cho nhân viên mới và nhân viên chưa được xếp ca riêng
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div>
                <span className="text-xs font-semibold text-slate-700">Đang hoạt động</span>
                <p className="text-[11px] text-slate-400">Cho phép chấm công và phân ca theo lịch này</p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo ca làm việc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
