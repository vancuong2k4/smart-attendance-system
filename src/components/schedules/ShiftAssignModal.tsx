'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react'

export interface ShiftAssignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  schedules: Array<{
    id: string
    name: string
    startTime: string
    endTime: string
    branch?: { name: string }
  }>
  employees: Array<{
    id: string
    fullName: string
    employeeCode: string
    position?: string | null
    department?: { name: string } | null
  }>
}

export default function ShiftAssignModal({
  isOpen,
  onClose,
  onSuccess,
  schedules,
  employees,
}: ShiftAssignModalProps) {
  const [scheduleId, setScheduleId] = useState(schedules[0]?.id || '')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [note, setNote] = useState('')
  const [empSearch, setEmpSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (schedules.length > 0 && !scheduleId) {
      setScheduleId(schedules[0].id)
    }
  }, [schedules, scheduleId])

  if (!isOpen) return null

  const filteredEmployees = employees.filter((e) => {
    if (!empSearch.trim()) return true
    const term = empSearch.toLowerCase()
    return (
      e.fullName.toLowerCase().includes(term) ||
      e.employeeCode.toLowerCase().includes(term) ||
      e.department?.name?.toLowerCase().includes(term)
    )
  })

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const selectAllFiltered = () => {
    const ids = filteredEmployees.map((e) => e.id)
    setSelectedEmployees((prev) => Array.from(new Set([...prev, ...ids])))
  }

  const clearSelectedEmployees = () => {
    setSelectedEmployees([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    if (selectedEmployees.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 nhân viên để phân ca')
      setLoading(false)
      return
    }

    if (!scheduleId) {
      setErrorMessage('Vui lòng chọn ca làm việc')
      setLoading(false)
      return
    }

    // Generate list of dates between startDate and endDate
    const dates: string[] = []
    const cur = new Date(`${startDate}T00:00:00.000Z`)
    const end = new Date(`${endDate}T00:00:00.000Z`)

    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay() // 0 = Sun, 6 = Sat
      if (!skipWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        dates.push(cur.toISOString().slice(0, 10))
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    if (dates.length === 0) {
      setErrorMessage('Khoảng ngày đã chọn không có ngày làm việc nào phù hợp')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/schedules/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeIds: selectedEmployees,
          scheduleId,
          dates,
          note: note.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Phân ca không thành công')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi gửi yêu cầu')
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
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Phân ca làm việc hàng loạt</h2>
              <p className="text-xs text-slate-500">
                Gán ca làm việc cho nhiều nhân viên theo ngày hoặc khoảng thời gian
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Select Schedule */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Chọn ca làm việc áp dụng <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} - {s.endTime}) {s.branch ? `- ${s.branch.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date range selection */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={15} className="text-indigo-600" />
              <span>Khoảng thời gian áp dụng</span>
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Từ ngày</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">Đến ngày</label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={skipWeekends}
                onChange={(e) => setSkipWeekends(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-600 font-medium">Bỏ qua Thứ 7 và Chủ Nhật</span>
            </label>
          </div>

          {/* Employee Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Chọn nhân viên ({selectedEmployees.length} đã chọn) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={clearSelectedEmployees}
                  className="text-slate-500 hover:text-slate-700 font-medium"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhân viên theo họ tên, mã nhân sự hoặc phòng ban..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Employee Checklist Box */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Không tìm thấy nhân viên phù hợp
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isChecked = selectedEmployees.includes(emp.id)
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEmployee(emp.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-800">{emp.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {emp.employeeCode} {emp.position ? `• ${emp.position}` : ''}
                          </div>
                        </div>
                      </div>
                      {emp.department && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {emp.department.name}
                        </span>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Ghi chú phân ca (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="VD: Phân ca dự án tháng mới, Ca trực lễ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang phân ca...' : 'Xác nhận phân ca'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
