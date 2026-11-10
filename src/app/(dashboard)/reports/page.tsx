'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Download,
  Calendar,
  Building,
  Users,
  Search,
  RotateCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'

interface BranchOption {
  id: string
  name: string
  code: string
}

interface DepartmentOption {
  id: string
  branchId: string
  name: string
  code?: string | null
}

interface SummaryData {
  period: { year: number; month: number }
  summary: {
    totalWorkdays: number
    totalEmployees: number
    averageAttendanceRate: number
    totalAbsences: number
    totalLate: number
    totalOTHours: number
  }
  byBranch: Array<{
    branchId: string
    branchName: string
    branchCode: string
    totalEmployees: number
    averageAttendanceRate: number
    totalAbsences: number
    totalLate: number
    totalOTHours: number
  }>
}

interface PayrollRecord {
  employee_code: string
  employee_name: string
  department: string
  branch: string
  work_days: number
  absent_days: number
  paid_leave_days: number
  late_count: number
  ot_hours: number
  period_start: string
  period_end: string
}

export default function ReportsPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [payrollPreview, setPayrollPreview] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Load branches & departments
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [branchRes, deptRes] = await Promise.all([
          fetch('/api/branches'),
          fetch('/api/departments'),
        ])
        const [bJson, dJson] = await Promise.all([branchRes.json(), deptRes.json()])
        if (bJson.success) setBranches(bJson.data)
        if (dJson.success) setDepartments(dJson.data)
      } catch (err) {
        console.error('Error loading filter options:', err)
      }
    }
    loadFilterOptions()
  }, [])

  // Fetch summary and payroll preview
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const branchParam = selectedBranch ? `&branchId=${selectedBranch}` : ''

      // 1. Fetch summary stats
      const summaryUrl = `/api/reports/summary?year=${selectedYear}&month=${selectedMonth}${branchParam}`
      const summaryRes = await fetch(summaryUrl)
      const summaryJson = await summaryRes.json()
      if (summaryJson.success) {
        setSummaryData(summaryJson.data)
      }

      // 2. Fetch payroll preview (format=json)
      const payrollUrl = `/api/reports/payroll-export?year=${selectedYear}&month=${selectedMonth}${branchParam}&format=json`
      const payrollRes = await fetch(payrollUrl)
      const payrollJson = await payrollRes.json()
      if (Array.isArray(payrollJson)) {
        setPayrollPreview(payrollJson)
      }
    } catch (err) {
      console.error('Error fetching reports data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth, selectedBranch])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Lọc theo phòng ban và từ khóa tìm kiếm
  const filteredRecords = payrollPreview.filter((rec) => {
    const matchSearch =
      !searchQuery ||
      rec.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.branch.toLowerCase().includes(searchQuery.toLowerCase())

    const matchDept =
      !selectedDepartment ||
      rec.department.toLowerCase() ===
        departments.find((d) => d.id === selectedDepartment)?.name.toLowerCase()

    return matchSearch && matchDept
  })

  // Trigger export download
  const handleExport = async (format: 'xlsx' | 'csv' | 'json') => {
    setExporting(format)
    setExportError(null)
    try {
      const branchParam = selectedBranch ? `&branchId=${selectedBranch}` : ''
      const url = `/api/reports/payroll-export?year=${selectedYear}&month=${selectedMonth}${branchParam}&format=${format}`

      const res = await fetch(url)
      if (!res.ok) {
        const errorJson = await res.json().catch(() => null)
        throw new Error(errorJson?.message || `Lỗi xuất file (Mã ${res.status})`)
      }

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `payroll-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      setExportError(err.message || 'Lỗi khi tải file xuất bảng công')
    } finally {
      setExporting(null)
    }
  }

  // Danh sách các năm cho dropdown
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="space-y-6">
      {/* Export Error Alert */}
      {exportError && (
        <div className="p-4 rounded-xl flex items-center justify-between text-sm bg-red-50 text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{exportError}</span>
          </div>
          <button onClick={() => setExportError(null)} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Xuất dữ liệu lương</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tổng hợp dữ liệu chuyên cần, ngày công thực tế và xuất file phục vụ tính lương
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-60"
          >
            <FileSpreadsheet size={16} />
            <span>{exporting === 'xlsx' ? 'Đang xuất...' : 'Xuất Excel (.xlsx)'}</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-60"
          >
            <FileText size={16} />
            <span>{exporting === 'csv' ? 'Đang xuất...' : 'Xuất CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Tháng */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tháng</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>

          {/* Năm */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Chi nhánh */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Chi nhánh</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Phòng ban */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phòng ban</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="">Tất cả phòng ban</option>
              {departments
                .filter((d) => !selectedBranch || d.branchId === selectedBranch)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Tỷ lệ chuyên cần"
          value={
            summaryData ? `${summaryData.summary.averageAttendanceRate}%` : '--'
          }
          icon={<TrendingUp size={20} className="text-emerald-600" />}
          bg="bg-emerald-50"
        />
        <KpiCard
          label="Tổng nhân viên"
          value={summaryData ? `${summaryData.summary.totalEmployees}` : '--'}
          icon={<Users size={20} className="text-indigo-600" />}
          bg="bg-indigo-50"
        />
        <KpiCard
          label="Ngày làm chuẩn"
          value={summaryData ? `${summaryData.summary.totalWorkdays} ngày` : '--'}
          icon={<Calendar size={20} className="text-blue-600" />}
          bg="bg-blue-50"
        />
        <KpiCard
          label="Tổng vắng mặt"
          value={summaryData ? `${summaryData.summary.totalAbsences}` : '--'}
          icon={<AlertTriangle size={20} className="text-red-600" />}
          bg="bg-red-50"
        />
        <KpiCard
          label="Số lần đi muộn"
          value={summaryData ? `${summaryData.summary.totalLate}` : '--'}
          icon={<Clock size={20} className="text-amber-600" />}
          bg="bg-amber-50"
        />
        <KpiCard
          label="Tổng giờ làm thêm"
          value={summaryData ? `${summaryData.summary.totalOTHours}h` : '--'}
          icon={<Clock size={20} className="text-purple-600" />}
          bg="bg-purple-50"
        />
      </div>

      {/* Payroll Data Preview Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Bảng xem trước tính công (Kỳ: {selectedMonth}/{selectedYear})
            </h2>
            <p className="text-xs text-gray-500">
              Hiển thị {filteredRecords.length} / {payrollPreview.length} nhân viên
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã NV..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <RotateCw size={28} className="mx-auto mb-2 animate-spin text-indigo-500" />
            <p className="text-sm">Đang tính toán dữ liệu bảng công...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Không có dữ liệu nhân viên trong kỳ được chọn</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards (sm:hidden) */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredRecords.map((item) => (
                <div key={item.employee_code} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.employee_name}</p>
                      <p className="text-xs text-gray-400">
                        {item.employee_code} • {item.department} ({item.branch})
                      </p>
                    </div>
                    <span className="font-bold text-sm text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {item.work_days} công
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <span className="text-gray-400 block text-[11px]">Nghỉ phép</span>
                      <span className="font-semibold text-gray-800">{item.paid_leave_days} ngày</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <span className="text-gray-400 block text-[11px]">Vắng mặt</span>
                      <span className={`font-semibold ${item.absent_days > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                        {item.absent_days} ngày
                      </span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg text-center">
                      <span className="text-gray-400 block text-[11px]">Làm thêm</span>
                      <span className="font-semibold text-purple-600">{item.ot_hours}h</span>
                    </div>
                  </div>

                  {item.late_count > 0 && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded flex items-center justify-between">
                      <span>Ghi nhận đi muộn:</span>
                      <span className="font-bold">{item.late_count} lần</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 min-w-[700px]">
                <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Mã NV</th>
                    <th className="px-5 py-3">Họ và tên</th>
                    <th className="px-5 py-3">Phòng ban</th>
                    <th className="px-5 py-3">Chi nhánh</th>
                    <th className="px-4 py-3 text-right">Ngày công</th>
                    <th className="px-4 py-3 text-right">Ngày vắng</th>
                    <th className="px-4 py-3 text-right">Nghỉ có lương</th>
                    <th className="px-4 py-3 text-right">Đi muộn</th>
                    <th className="px-4 py-3 text-right">Giờ OT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((item) => (
                    <tr key={item.employee_code} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {item.employee_code}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {item.employee_name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{item.department}</td>
                      <td className="px-5 py-3.5 text-gray-600">{item.branch}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">
                        {item.work_days}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-red-600">
                        {item.absent_days > 0 ? item.absent_days : '0'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-700">
                        {item.paid_leave_days}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {item.late_count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            {item.late_count} lần
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-purple-600">
                        {item.ot_hours > 0 ? `${item.ot_hours}h` : '0h'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string
  value: string
  icon: React.ReactNode
  bg: string
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
