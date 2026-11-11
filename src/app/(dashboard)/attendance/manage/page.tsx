'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Building,
  Users,
  Search,
  Filter,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Camera,
  X,
  ShieldCheck,
  MapPin,
} from 'lucide-react'
import { formatVietnamTime, formatVietnamDateDisplay, formatDuration, getVietnamDateString } from '@/lib/attendance'
import { calculateDistance } from '@/lib/gps'

interface AttendanceRecordItem {
  id: string
  date: string
  checkInTime?: string | null
  checkInLat?: number | null
  checkInLon?: number | null
  checkInAccuracy?: number | null
  checkInDevice?: string | null
  checkInPhoto?: string | null
  checkOutTime?: string | null
  checkOutLat?: number | null
  checkOutLon?: number | null
  checkOutAccuracy?: number | null
  checkOutDevice?: string | null
  checkOutPhoto?: string | null
  workDuration?: number | null
  workDays?: number | null
  isLate?: boolean | null
  lateMinutes?: number | null
  isEarlyLeave?: boolean | null
  earlyMinutes?: number | null
  status: string
  employee: {
    id: string
    fullName: string
    employeeCode: string
    position?: string | null
    department?: {
      id: string
      name: string
      code?: string | null
    } | null
    branch?: {
      id: string
      name: string
      code?: string | null
      latitude?: number | null
      longitude?: number | null
      gpsRadius?: number | null
    } | null
  }
}

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

export default function AttendanceManagePage() {
  const [records, setRecords] = useState<AttendanceRecordItem[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(true)

  // Selfie Modal State
  const [selfieModal, setSelfieModal] = useState<{
    photoUrl: string
    type: 'CHECK_IN' | 'CHECK_OUT'
    employeeName: string
    employeeCode: string
    branchName?: string | null
    departmentName?: string | null
    time?: string | null
    accuracy?: number | null
    device?: string | null
    date: string
    distance?: number | null
    allowedRadius?: number | null
    otherPhotoUrl?: string | null
    otherType?: 'CHECK_IN' | 'CHECK_OUT'
    otherTime?: string | null
    otherAccuracy?: number | null
    otherDevice?: string | null
    otherDistance?: number | null
    otherAllowedRadius?: number | null
  } | null>(null)

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(getVietnamDateString())
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [filterLate, setFilterLate] = useState<string>('')
  const [filterEarly, setFilterEarly] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Pagination
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const limit = 20

  // Load Branch & Department options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [branchRes, deptRes] = await Promise.all([
          fetch('/api/branches'),
          fetch('/api/departments'),
        ])
        const [branchJson, deptJson] = await Promise.all([branchRes.json(), deptRes.json()])

        if (branchJson.success) setBranches(branchJson.data || [])
        if (deptJson.success) setDepartments(deptJson.data || [])
      } catch (e) {
        console.error('Lỗi tải danh mục chi nhánh/phòng ban:', e)
      }
    }
    loadOptions()
  }, [])

  // Load Records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedDate) params.set('date', selectedDate)
      if (selectedBranch) params.set('branchId', selectedBranch)
      if (selectedDepartment) params.set('departmentId', selectedDepartment)
      if (selectedStatus) params.set('status', selectedStatus)
      if (filterLate) params.set('isLate', filterLate)
      if (filterEarly) params.set('isEarlyLeave', filterEarly)
      if (searchQuery) params.set('search', searchQuery)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/attendance/records?${params.toString()}`)
      const json = await res.json()

      if (json.success) {
        setRecords(json.data.records || [])
        setTotalPages(json.data.pagination.totalPages || 1)
        setTotalCount(json.data.pagination.total || 0)
      } else {
        setRecords([])
        setTotalPages(1)
        setTotalCount(0)
      }
    } catch (e) {
      console.error('Lỗi khi tải bản ghi chấm công:', e)
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [
    selectedDate,
    selectedBranch,
    selectedDepartment,
    selectedStatus,
    filterLate,
    filterEarly,
    searchQuery,
    page,
  ])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // Filter departments based on selected branch
  const filteredDepartments = selectedBranch
    ? departments.filter((d) => d.branchId === selectedBranch)
    : departments

  // Quick stats computed from current records
  const onTimeCount = records.filter((r) => r.checkInTime && !r.isLate).length
  const lateCount = records.filter((r) => r.isLate).length
  const earlyCount = records.filter((r) => r.isEarlyLeave).length
  const completedCount = records.filter((r) => r.checkInTime && r.checkOutTime).length

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-indigo-600" />
            Quản lý chấm công
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi, lọc và quản lý dữ liệu chấm công GPS của nhân viên toàn công ty.
          </p>
        </div>

        <button
          onClick={() => {
            setPage(1)
            fetchRecords()
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* KPI / Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gray-400" />
            Tổng lượt hiển thị
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{totalCount}</div>
          <div className="text-xs text-gray-400 mt-1">Bản ghi theo bộ lọc</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Đúng giờ
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{onTimeCount}</div>
          <div className="text-xs text-gray-400 mt-1">Check-in chuẩn giờ</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            Đi muộn
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{lateCount}</div>
          <div className="text-xs text-gray-400 mt-1">Vượt buffer quy định</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            Về sớm / Chưa xong
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">
            {earlyCount} <span className="text-xs font-normal text-gray-400">({completedCount} đã ra)</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">Rời VP trước giờ</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 pb-2 border-b border-gray-100">
          <Filter className="w-4 h-4 text-indigo-600" />
          Bộ lọc tìm kiếm
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ngày chấm công</label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setPage(1)
                }}
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Branch Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Chi nhánh</label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
                setSelectedDepartment('')
                setPage(1)
              }}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phòng ban</label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value)
                setPage(1)
              }}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">Tất cả phòng ban</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tìm nhân viên</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tên hoặc mã NV..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full text-sm border border-gray-300 rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>

        {/* Secondary Filters: Late / Early & Attendance Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 mr-1">Chỉ số:</span>

            <button
              type="button"
              onClick={() => {
                setFilterLate('')
                setFilterEarly('')
                setPage(1)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filterLate === '' && filterEarly === ''
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tất cả
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterLate('true')
                setFilterEarly('')
                setPage(1)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filterLate === 'true'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Đi muộn
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterLate('false')
                setFilterEarly('')
                setPage(1)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filterLate === 'false'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Đúng giờ
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterEarly('true')
                setFilterLate('')
                setPage(1)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                filterEarly === 'true'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Về sớm
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Trạng thái công:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value)
                setPage(1)
              }}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium text-gray-700"
            >
              <option value="">Tất cả</option>
              <option value="PRESENT">Có mặt (Đủ ngày)</option>
              <option value="HALF_DAY">Nửa ngày</option>
              <option value="ABSENT">Vắng mặt</option>
              <option value="LEAVE">Nghỉ phép</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-gray-500">Đang tải danh sách bản ghi...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">Không tìm thấy bản ghi chấm công nào</p>
            <p className="text-xs text-gray-400">
              Hãy thử chọn ngày khác hoặc nới lỏng các tiêu chí bộ lọc.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-semibold">Nhân viên</th>
                  <th className="py-3.5 px-4 font-semibold">Chi nhánh / Ban</th>
                  <th className="py-3.5 px-4 font-semibold">Ngày</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Ảnh Selfie</th>
                  <th className="py-3.5 px-4 font-semibold">Giờ vào (Check-in)</th>
                  <th className="py-3.5 px-4 font-semibold">Giờ ra (Check-out)</th>
                  <th className="py-3.5 px-4 font-semibold">Thời gian làm</th>
                  <th className="py-3.5 px-4 font-semibold">Công</th>
                  <th className="py-3.5 px-4 font-semibold">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition">
                    {/* Employee Info */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{r.employee.fullName}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5">
                        {r.employee.employeeCode} {r.employee.position ? `• ${r.employee.position}` : ''}
                      </div>
                    </td>

                    {/* Branch & Dept */}
                    <td className="py-3 px-4">
                      <div className="text-xs font-medium text-gray-800">
                        {r.employee.branch?.name || '--'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.employee.department?.name || '--'}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-xs font-medium text-gray-700">
                      {formatVietnamDateDisplay(r.date)}
                    </td>

                    {/* Selfie Thumbnails */}
                    <td className="py-3 px-4">
                      {(() => {
                        const inDistance =
                          r.checkInLat != null &&
                          r.checkInLon != null &&
                          r.employee.branch?.latitude != null &&
                          r.employee.branch?.longitude != null
                            ? Math.round(
                                calculateDistance(
                                  r.checkInLat,
                                  r.checkInLon,
                                  r.employee.branch.latitude,
                                  r.employee.branch.longitude
                                )
                              )
                            : null

                        const outDistance =
                          r.checkOutLat != null &&
                          r.checkOutLon != null &&
                          r.employee.branch?.latitude != null &&
                          r.employee.branch?.longitude != null
                            ? Math.round(
                                calculateDistance(
                                  r.checkOutLat,
                                  r.checkOutLon,
                                  r.employee.branch.latitude,
                                  r.employee.branch.longitude
                                )
                              )
                            : null

                        const branchRadius = r.employee.branch?.gpsRadius || 100

                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            {r.checkInPhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelfieModal({
                                    photoUrl: r.checkInPhoto!,
                                    type: 'CHECK_IN',
                                    employeeName: r.employee.fullName,
                                    employeeCode: r.employee.employeeCode,
                                    branchName: r.employee.branch?.name,
                                    departmentName: r.employee.department?.name,
                                    time: r.checkInTime,
                                    accuracy: r.checkInAccuracy,
                                    device: r.checkInDevice,
                                    date: r.date,
                                    distance: inDistance,
                                    allowedRadius: branchRadius,
                                    otherPhotoUrl: r.checkOutPhoto,
                                    otherType: 'CHECK_OUT',
                                    otherTime: r.checkOutTime,
                                    otherAccuracy: r.checkOutAccuracy,
                                    otherDevice: r.checkOutDevice,
                                    otherDistance: outDistance,
                                    otherAllowedRadius: branchRadius,
                                  })
                                }
                                className="group relative w-9 h-9 rounded-xl overflow-hidden border border-emerald-300 ring-2 ring-emerald-100 hover:ring-emerald-400 transition cursor-pointer shadow-xs"
                                title="Bấm xem ảnh selfie check-in"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={r.checkInPhoto}
                                  alt={`Check-in selfie ${r.employee.fullName}`}
                                  className="w-full h-full object-cover group-hover:scale-110 transition"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[8px] font-bold text-center py-0.5">
                                  Vào
                                </span>
                              </button>
                            ) : (
                              <div
                                className="w-8 h-8 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400"
                                title="Không có ảnh vào"
                              >
                                -
                              </div>
                            )}

                            {r.checkOutPhoto ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelfieModal({
                                    photoUrl: r.checkOutPhoto!,
                                    type: 'CHECK_OUT',
                                    employeeName: r.employee.fullName,
                                    employeeCode: r.employee.employeeCode,
                                    branchName: r.employee.branch?.name,
                                    departmentName: r.employee.department?.name,
                                    time: r.checkOutTime,
                                    accuracy: r.checkOutAccuracy,
                                    device: r.checkOutDevice,
                                    date: r.date,
                                    distance: outDistance,
                                    allowedRadius: branchRadius,
                                    otherPhotoUrl: r.checkInPhoto,
                                    otherType: 'CHECK_IN',
                                    otherTime: r.checkInTime,
                                    otherAccuracy: r.checkInAccuracy,
                                    otherDevice: r.checkInDevice,
                                    otherDistance: inDistance,
                                    otherAllowedRadius: branchRadius,
                                  })
                                }
                                className="group relative w-9 h-9 rounded-xl overflow-hidden border border-indigo-300 ring-2 ring-indigo-100 hover:ring-indigo-400 transition cursor-pointer shadow-xs"
                                title="Bấm xem ảnh selfie check-out"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={r.checkOutPhoto}
                                  alt={`Check-out selfie ${r.employee.fullName}`}
                                  className="w-full h-full object-cover group-hover:scale-110 transition"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-indigo-600/90 text-white text-[8px] font-bold text-center py-0.5">
                                  Ra
                                </span>
                              </button>
                            ) : (
                              <div
                                className="w-8 h-8 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400"
                                title="Không có ảnh ra"
                              >
                                -
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Check-in */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {r.checkInTime ? formatVietnamTime(r.checkInTime) : '--:--'}
                      </div>
                      {r.checkInAccuracy ? (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          GPS: ±{Math.round(r.checkInAccuracy)}m
                        </div>
                      ) : null}
                    </td>

                    {/* Check-out */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {r.checkOutTime ? formatVietnamTime(r.checkOutTime) : '--:--'}
                      </div>
                      {r.checkOutAccuracy ? (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          GPS: ±{Math.round(r.checkOutAccuracy)}m
                        </div>
                      ) : null}
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4 font-medium text-gray-700">
                      {r.workDuration !== null && r.workDuration !== undefined
                        ? formatDuration(r.workDuration)
                        : '--'}
                    </td>

                    {/* Workdays */}
                    <td className="py-3 px-4 font-bold text-gray-900">
                      {r.workDays !== null && r.workDays !== undefined
                        ? `${r.workDays} công`
                        : '--'}
                    </td>

                    {/* Badges */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {r.isLate ? (
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            Muộn {r.lateMinutes}p
                          </span>
                        ) : r.checkInTime ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Đúng giờ
                          </span>
                        ) : null}

                        {r.isEarlyLeave && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Về sớm {r.earlyMinutes}p
                          </span>
                        )}

                        {r.status === 'HALF_DAY' && (
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            Nửa ngày
                          </span>
                        )}

                        {!r.checkInTime && (
                          <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            Vắng mặt
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-xs text-gray-500 font-medium">
              Trang {page} / {totalPages} (Tổng số {totalCount} bản ghi)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Selfie Lightbox Modal for Admin / HR */}
      {selfieModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelfieModal(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    {selfieModal.employeeName}
                  </h3>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                    {selfieModal.employeeCode}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selfieModal.branchName || 'Chi nhánh'} • {selfieModal.departmentName || 'Phòng ban'} — Ngày {formatVietnamDateDisplay(selfieModal.date)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelfieModal(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle switch if both check-in and check-out photos exist */}
            {selfieModal.otherPhotoUrl && (
              <div className="px-5 pt-3 pb-1 bg-white flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Xem ảnh:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selfieModal.type !== 'CHECK_IN') {
                      // Swap to check-in
                      setSelfieModal({
                        photoUrl: selfieModal.otherPhotoUrl!,
                        type: 'CHECK_IN',
                        employeeName: selfieModal.employeeName,
                        employeeCode: selfieModal.employeeCode,
                        branchName: selfieModal.branchName,
                        departmentName: selfieModal.departmentName,
                        time: selfieModal.otherTime,
                        accuracy: selfieModal.otherAccuracy,
                        device: selfieModal.otherDevice,
                        date: selfieModal.date,
                        distance: selfieModal.otherDistance,
                        allowedRadius: selfieModal.otherAllowedRadius,
                        otherPhotoUrl: selfieModal.photoUrl,
                        otherType: 'CHECK_OUT',
                        otherTime: selfieModal.time,
                        otherAccuracy: selfieModal.accuracy,
                        otherDevice: selfieModal.device,
                        otherDistance: selfieModal.distance,
                        otherAllowedRadius: selfieModal.allowedRadius,
                      })
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    selfieModal.type === 'CHECK_IN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Selfie Check-in (Vào)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selfieModal.type !== 'CHECK_OUT') {
                      // Swap to check-out
                      setSelfieModal({
                        photoUrl: selfieModal.otherPhotoUrl!,
                        type: 'CHECK_OUT',
                        employeeName: selfieModal.employeeName,
                        employeeCode: selfieModal.employeeCode,
                        branchName: selfieModal.branchName,
                        departmentName: selfieModal.departmentName,
                        time: selfieModal.otherTime,
                        accuracy: selfieModal.otherAccuracy,
                        device: selfieModal.otherDevice,
                        date: selfieModal.date,
                        distance: selfieModal.otherDistance,
                        allowedRadius: selfieModal.otherAllowedRadius,
                        otherPhotoUrl: selfieModal.photoUrl,
                        otherType: 'CHECK_IN',
                        otherTime: selfieModal.time,
                        otherAccuracy: selfieModal.accuracy,
                        otherDevice: selfieModal.device,
                        otherDistance: selfieModal.distance,
                        otherAllowedRadius: selfieModal.allowedRadius,
                      })
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    selfieModal.type === 'CHECK_OUT'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Selfie Check-out (Ra)
                </button>
              </div>
            )}

            {/* Photo Container */}
            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selfieModal.photoUrl}
                alt={`Ảnh selfie ${selfieModal.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'} của ${selfieModal.employeeName}`}
                className="w-full h-full object-contain"
              />

              {/* Status Badge Overlay */}
              <div
                className={`absolute top-3 left-3 px-3 py-1 rounded-xl text-xs font-bold text-white shadow backdrop-blur-sm flex items-center gap-1.5 ${
                  selfieModal.type === 'CHECK_IN'
                    ? 'bg-emerald-600/90'
                    : 'bg-indigo-600/90'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {selfieModal.type === 'CHECK_IN'
                  ? 'Ảnh Selfie Check-in (Vào)'
                  : 'Ảnh Selfie Check-out (Ra)'}
              </div>
            </div>

            {/* Verification Metadata Panel */}
            <div className="p-5 bg-gray-50 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <div className="text-gray-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    Thời gian chấm công
                  </div>
                  <div className="font-mono font-bold text-gray-900 mt-1 text-sm">
                    {selfieModal.time ? formatVietnamTime(selfieModal.time) : '--:--'}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100">
                  <div className="text-gray-400 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    Khoảng cách GPS
                  </div>
                  <div className="font-mono font-bold text-gray-900 mt-1 text-sm">
                    {selfieModal.distance !== null && selfieModal.distance !== undefined
                      ? `${selfieModal.distance}m`
                      : 'Đúng quy định'}
                  </div>
                  {selfieModal.distance !== null && selfieModal.distance !== undefined && (
                    <div className="mt-1">
                      {selfieModal.distance <= (selfieModal.allowedRadius || 100) ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Trong bán kính ({selfieModal.allowedRadius || 100}m)
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                          Ngoài bán kính (+{selfieModal.distance - (selfieModal.allowedRadius || 100)}m)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                  <div className="text-gray-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    Độ chính xác GPS
                  </div>
                  <div className="font-mono font-bold text-gray-900 mt-1 text-sm">
                    {selfieModal.accuracy ? `±${Math.round(selfieModal.accuracy)}m` : 'Hợp lệ'}
                  </div>
                </div>
              </div>

              {selfieModal.branchName && (
                <div className="text-[11px] text-gray-600 bg-white p-2.5 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-700">Chi nhánh / Ban:</span> {selfieModal.branchName}
                    {selfieModal.departmentName && ` — ${selfieModal.departmentName}`}
                  </div>
                  {selfieModal.allowedRadius && (
                    <span className="text-gray-400 font-mono text-[10px]">
                      Bán kính: {selfieModal.allowedRadius}m
                    </span>
                  )}
                </div>
              )}

              {selfieModal.device && (
                <div className="text-[11px] text-gray-500 bg-white p-2.5 rounded-xl border border-gray-100 truncate">
                  <span className="font-semibold text-gray-700">Thiết bị:</span> {selfieModal.device}
                </div>
              )}

              {/* Anti-fraud Verification Badge */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="leading-relaxed">
                  <strong>Đối soát chống gian lận:</strong> Ảnh chụp selfie trực tiếp khuôn mặt bằng camera trước tại thời điểm chấm công kết hợp tọa độ khoảng cách GPS chi nhánh giúp HR phát hiện gian lận và chấm công hộ.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
