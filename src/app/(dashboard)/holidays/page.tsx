'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  CalendarHeart,
  Plus,
  Sparkles,
  Calendar,
  ListFilter,
  Search,
  Building2,
  Trash2,
  Edit,
  Send,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { HolidayType } from '@prisma/client'
import {
  HolidayMetricsCards,
  HolidaySummaryData,
} from '@/components/holidays/HolidayMetricsCards'
import HolidayTypeBadge from '@/components/holidays/HolidayTypeBadge'
import HolidayCalendarView from '@/components/holidays/HolidayCalendarView'
import HolidayFormModal, {
  HolidayFormData,
} from '@/components/holidays/HolidayFormModal'
import InitDefaultsModal from '@/components/holidays/InitDefaultsModal'
import HolidayBroadcastModal from '@/components/holidays/HolidayBroadcastModal'
import { HOLIDAY_TYPE_MAP } from '@/lib/holidays'

interface BranchOption {
  id: string
  name: string
  code: string
}

export default function HolidaysPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')

  const [holidays, setHolidays] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [summary, setSummary] = useState<HolidaySummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true)

  // Bộ lọc
  const [typeFilter, setTypeFilter] = useState<HolidayType | null>(null)
  const [branchFilter, setBranchFilter] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [branches, setBranches] = useState<BranchOption[]>([])

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [selectedHoliday, setSelectedHoliday] = useState<Partial<HolidayFormData> | null>(null)

  const [initModalOpen, setInitModalOpen] = useState(false)
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)
  const [holidayToBroadcast, setHolidayToBroadcast] = useState<any | null>(null)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Tải danh sách chi nhánh
  useEffect(() => {
    fetch('/api/branches')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setBranches(json.data)
        }
      })
      .catch((err) => console.error('Failed to load branches:', err))
  }, [])

  // Tải thống kê summary
  const loadSummary = useCallback(() => {
    setLoadingSummary(true)
    const params = new URLSearchParams()
    params.set('year', selectedYear.toString())
    params.set('month', selectedMonth.toString())
    if (branchFilter) params.set('branchId', branchFilter)

    fetch(`/api/holidays/summary?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSummary(json.data)
        }
      })
      .catch((err) => console.error('Failed to load holiday summary:', err))
      .finally(() => setLoadingSummary(false))
  }, [selectedYear, selectedMonth, branchFilter])

  // Tải danh sách ngày lễ
  const loadHolidays = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('year', selectedYear.toString())
    params.set('limit', '100')
    if (typeFilter) params.set('type', typeFilter)
    if (branchFilter) params.set('branchId', branchFilter)
    if (search.trim()) params.set('search', search.trim())

    fetch(`/api/holidays?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.items) {
          setHolidays(json.data.items)
        }
      })
      .catch((err) => console.error('Failed to load holidays:', err))
      .finally(() => setLoading(false))
  }, [selectedYear, typeFilter, branchFilter, search])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadHolidays()
  }, [loadHolidays])

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  const handleCreateNew = () => {
    setSelectedHoliday(null)
    setFormModalOpen(true)
  }

  const handleEdit = (holiday: any) => {
    setSelectedHoliday({
      id: holiday.id,
      name: holiday.name,
      code: holiday.code,
      date: holiday.date,
      endDate: holiday.endDate,
      type: holiday.type,
      isPaid: holiday.isPaid,
      payMultiplier: holiday.payMultiplier,
      year: holiday.year,
      branchId: holiday.branchId,
      description: holiday.description,
    })
    setFormModalOpen(true)
  }

  const handleDelete = async (holiday: any) => {
    if (!confirm(`Bạn có chắc muốn xóa ngày nghỉ "${holiday.name}" khỏi hệ thống?`)) {
      return
    }

    try {
      const res = await fetch(`/api/holidays/${holiday.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        setSuccessMessage(`Đã xóa thành công ngày nghỉ "${holiday.name}"`)
        loadSummary()
        loadHolidays()
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        alert(json.message || 'Không thể xóa ngày nghỉ')
      }
    } catch (err) {
      alert('Lỗi kết nối khi xóa ngày nghỉ')
    }
  }

  const handleBroadcast = (holiday: any) => {
    setHolidayToBroadcast(holiday)
    setBroadcastModalOpen(true)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <CalendarHeart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Lịch Nghỉ Lễ & Ngày Làm Bù
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cấu hình ngày lễ Quốc gia, ngày nghỉ riêng công ty, làm bù và hệ số lương x300%
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setInitModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-rose-500" />
            Nạp Lễ Quốc Gia Tự Động
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm Ngày Nghỉ / Làm Bù
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <HolidayMetricsCards
        summary={summary}
        loading={loadingSummary}
        selectedTypeFilter={typeFilter}
        onFilterType={(type) => setTypeFilter(type)}
      />

      {/* Controls Bar & View Switcher */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: View Mode & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Switcher Calendar / Table */}
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Lịch biểu (Calendar)
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Danh sách (Table)
            </button>
          </div>

          {/* Search box (khi ở Table view) */}
          {viewMode === 'table' && (
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc mã ngày lễ..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Right: Year & Branch Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Year selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-500">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex items-center gap-1">
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Toàn công ty --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filter button */}
          {(typeFilter || branchFilter || search) && (
            <button
              onClick={() => {
                setTypeFilter(null)
                setBranchFilter('')
                setSearch('')
              }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Calendar View OR Table View */}
      {viewMode === 'calendar' ? (
        <HolidayCalendarView
          holidays={holidays}
          currentYear={selectedYear}
          currentMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onEditHoliday={handleEdit}
          onDeleteHoliday={handleDelete}
          onBroadcastHoliday={handleBroadcast}
          canManage={true}
        />
      ) : (
        /* Table View */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Tên ngày nghỉ / Sự kiện</th>
                  <th className="py-3.5 px-4">Mã định danh</th>
                  <th className="py-3.5 px-4">Thời gian áp dụng</th>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4">Hệ số lương</th>
                  <th className="py-3.5 px-4">Hưởng lương</th>
                  <th className="py-3.5 px-4">Chi nhánh</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-24" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : holidays.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <CalendarHeart className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Chưa có lịch ngày nghỉ nào trong năm {selectedYear}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Nhấn "Nạp Lễ Quốc Gia Tự Động" để nạp ngay danh mục ngày lễ chuẩn của Việt Nam
                      </p>
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => {
                    const startStr = new Date(h.date).toLocaleDateString('vi-VN')
                    const endStr = h.endDate
                      ? new Date(h.endDate).toLocaleDateString('vi-VN')
                      : null

                    return (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors"
                      >
                        {/* Tên */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {h.name}
                          {h.description && (
                            <div className="text-[11px] font-normal text-slate-400 mt-0.5 line-clamp-1">
                              {h.description}
                            </div>
                          )}
                        </td>

                        {/* Mã */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                          {h.code}
                        </td>

                        {/* Thời gian */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {startStr} {endStr ? `→ ${endStr}` : ''}
                        </td>

                        {/* Phân loại */}
                        <td className="py-3.5 px-4">
                          <HolidayTypeBadge type={h.type} />
                        </td>

                        {/* Hệ số lương */}
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span
                            className={
                              h.payMultiplier > 1.0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            x{h.payMultiplier.toFixed(1)} ({h.payMultiplier * 100}%)
                          </span>
                        </td>

                        {/* Hưởng lương */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              h.isPaid
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {h.isPaid ? '100% lương' : 'Không lương'}
                          </span>
                        </td>

                        {/* Chi nhánh */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {h.branch?.name || (
                            <span className="text-slate-400 italic">Toàn công ty</span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleBroadcast(h)}
                              title="Phát thông báo cho nhân viên"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(h)}
                              title="Chỉnh sửa"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(h)}
                              title="Xóa"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <HolidayFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => {
          loadSummary()
          loadHolidays()
        }}
        initialData={selectedHoliday}
        branches={branches}
        selectedYear={selectedYear}
      />

      {/* Init Defaults Modal */}
      <InitDefaultsModal
        isOpen={initModalOpen}
        onClose={() => setInitModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage(`Đã khởi tạo thành công danh mục Ngày lễ Quốc gia năm ${selectedYear}`)
          loadSummary()
          loadHolidays()
          setTimeout(() => setSuccessMessage(null), 5000)
        }}
        defaultYear={selectedYear}
      />

      {/* Broadcast Modal */}
      <HolidayBroadcastModal
        isOpen={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage(`Đã phát thông báo thành công cho lịch "${holidayToBroadcast?.name}"`)
          setTimeout(() => setSuccessMessage(null), 5000)
        }}
        holiday={holidayToBroadcast}
      />
    </div>
  )
}
