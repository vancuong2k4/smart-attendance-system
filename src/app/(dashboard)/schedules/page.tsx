'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  Clock,
  Plus,
  Users,
  ArrowLeftRight,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react'
import ShiftFormModal, { ShiftFormData } from '@/components/schedules/ShiftFormModal'
import ShiftAssignModal from '@/components/schedules/ShiftAssignModal'
import ShiftSwapModal from '@/components/schedules/ShiftSwapModal'
import ShiftSwapList, { ShiftSwapItem } from '@/components/schedules/ShiftSwapList'
import { formatWorkDaysLabel, calculateShiftDuration } from '@/lib/shift-engine'

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState<'roster' | 'templates' | 'swaps'>('roster')

  // Data states
  const [schedules, setSchedules] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [swaps, setSwaps] = useState<ShiftSwapItem[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('EMPLOYEE')

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  )
  const [templateSearch, setTemplateSearch] = useState('')

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ShiftFormData | null>(null)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false)

  const [loading, setLoading] = useState(true)

  const isManager = ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER'].includes(userRole)

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch schedules
      const schedRes = await fetch('/api/schedules')
      const schedJson = await schedRes.json()
      if (schedRes.ok && schedJson.data) {
        setSchedules(schedJson.data)
      }

      // 2. Fetch assignments for month
      const assignRes = await fetch(`/api/schedules/assignments?month=${selectedMonth}`)
      const assignJson = await assignRes.json()
      if (assignRes.ok && assignJson.data) {
        setAssignments(assignJson.data)
      }

      // 3. Fetch swaps
      const swapsRes = await fetch('/api/schedules/swaps')
      const swapsJson = await swapsRes.json()
      if (swapsRes.ok && swapsJson.data) {
        setSwaps(swapsJson.data)
      }

      // 4. Fetch branches
      const branchRes = await fetch('/api/branches')
      const branchJson = await branchRes.json()
      if (branchRes.ok && branchJson.data) {
        setBranches(branchJson.data)
      }

      // 5. Fetch employees
      const empRes = await fetch('/api/employees')
      const empJson = await empRes.json()
      if (empRes.ok && empJson.data) {
        setEmployees(empJson.data.employees || empJson.data || [])
      }

      // 6. Fetch user profile / my-branch to identify current employee
      const meRes = await fetch('/api/branches/my-branch')
      const meJson = await meRes.json()
      if (meRes.ok && meJson.data) {
        if (meJson.data.employeeId) setCurrentEmployeeId(meJson.data.employeeId)
        if (meJson.data.userRole) setUserRole(meJson.data.userRole)
      }
    } catch (err) {
      console.error('Error fetching schedules data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Delete schedule template
  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ca làm việc "${name}"?`)) return
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Không thể xóa ca làm việc')
      }
      fetchData()
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa')
    }
  }

  // Filtered schedules for templates tab
  const filteredSchedules = schedules.filter((s) => {
    if (!templateSearch.trim()) return true
    const term = templateSearch.toLowerCase()
    return (
      s.name.toLowerCase().includes(term) ||
      s.branch?.name?.toLowerCase().includes(term) ||
      s.startTime.includes(term) ||
      s.endTime.includes(term)
    )
  })

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <CalendarDays className="text-indigo-600" size={26} />
            <span>Quản lý Ca làm việc & Đổi ca</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập danh mục ca, phân ca lịch biểu nhân sự và giải quyết đơn đổi ca linh hoạt
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setIsSwapModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 shadow-sm transition-all hover:scale-[1.01]"
          >
            <ArrowLeftRight size={15} />
            <span>Yêu cầu đổi ca</span>
          </button>

          {isManager && (
            <>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
              >
                <Users size={15} />
                <span>Phân ca nhân viên</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null)
                  setIsFormModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01]"
              >
                <Plus size={16} />
                <span>Thêm ca mới</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'roster'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={16} />
          <span>Lịch phân ca ({assignments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock size={16} />
          <span>Danh mục ca làm việc ({schedules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('swaps')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'swaps'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowLeftRight size={16} />
          <span>Đơn đổi ca ({swaps.length})</span>
        </button>
      </div>

      {/* TAB 1: Roster Calendar & Table */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Month selector toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Calendar size={16} className="text-indigo-600" />
              <span>Xem lịch tháng:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="text-xs text-slate-400">
              Tổng cộng: <strong>{assignments.length}</strong> lượt phân ca trong tháng {selectedMonth}
            </div>
          </div>

          {/* Roster Table */}
          {assignments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Calendar size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Chưa có phân ca trong tháng này</h4>
              <p className="text-xs text-slate-400 mt-1">
                Nhân viên sẽ tự động áp dụng ca làm việc mặc định của chi nhánh khi chưa được phân ca riêng.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Ngày làm việc</th>
                      <th className="py-3 px-4">Nhân viên</th>
                      <th className="py-3 px-4">Ca làm việc</th>
                      <th className="py-3 px-4">Khung giờ</th>
                      <th className="py-3 px-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {assignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {new Date(item.date).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{item.employee.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.employee.employeeCode} {item.employee.department ? `• ${item.employee.department.name}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-indigo-700">
                          {item.schedule.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {item.schedule.startTime} - {item.schedule.endTime}
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic">
                          {item.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Shift Templates */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm ca làm việc theo tên, chi nhánh..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-400">
              Hiển thị: <strong>{filteredSchedules.length}</strong> ca làm việc
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Tên ca & Chi nhánh</th>
                    <th className="py-3 px-4">Khung giờ</th>
                    <th className="py-3 px-4">Thời lượng</th>
                    <th className="py-3 px-4">Lịch tuần</th>
                    <th className="py-3 px-4 text-center">Mặc định</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    {isManager && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSchedules.map((s) => {
                    const hours = calculateShiftDuration(
                      s.startTime,
                      s.endTime,
                      s.lunchStart,
                      s.lunchEnd
                    )

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">{s.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {s.branch?.name || 'Toàn hệ thống'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          <div>
                            {s.startTime} - {s.endTime}
                          </div>
                          {s.lunchStart && s.lunchEnd && (
                            <div className="text-[10px] text-slate-400">
                              Nghỉ: {s.lunchStart} - {s.lunchEnd}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {hours} giờ công
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {formatWorkDaysLabel(s.workDays)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {s.isDefault ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Mặc định
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {s.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              <CheckCircle2 size={11} /> Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              <XCircle size={11} /> Tạm dừng
                            </span>
                          )}
                        </td>

                        {isManager && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSchedule(s)
                                  setIsFormModalOpen(true)
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSchedule(s.id, s.name)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Xóa ca"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Shift Swaps */}
      {activeTab === 'swaps' && (
        <ShiftSwapList
          swaps={swaps}
          currentEmployeeId={currentEmployeeId}
          isManager={isManager}
          onRefresh={fetchData}
        />
      )}

      {/* Modals */}
      <ShiftFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={fetchData}
        initialData={editingSchedule}
        branches={branches}
      />

      <ShiftAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSuccess={fetchData}
        schedules={schedules}
        employees={employees}
      />

      <ShiftSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        onSuccess={fetchData}
        peers={employees}
        schedules={schedules}
        currentEmployeeId={currentEmployeeId}
      />
    </div>
  )
}
