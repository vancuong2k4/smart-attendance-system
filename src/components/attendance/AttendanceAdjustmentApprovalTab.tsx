'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Building,
  AlertCircle,
  ExternalLink,
  User,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { formatVietnamDateDisplay, formatVietnamTime } from '@/lib/attendance'
import {
  getAdjustmentTypeLabel,
  getAdjustmentStatusLabel,
} from '@/lib/attendance-adjustment'

interface AdjustmentApprovalItem {
  id: string
  date: string
  type: string
  requestedCheckIn?: string | null
  requestedCheckOut?: string | null
  reason: string
  evidenceUrl?: string | null
  status: string
  rejectReason?: string | null
  createdAt: string
  employee: {
    id: string
    fullName: string
    employeeCode: string
    position?: string | null
    branch?: {
      id: string
      name: string
      code: string
    } | null
    department?: {
      id: string
      name: string
      code?: string | null
    } | null
  }
}

interface AttendanceAdjustmentApprovalTabProps {
  branches: { id: string; name: string; code: string }[]
  onApprovalSuccess?: () => void
}

export default function AttendanceAdjustmentApprovalTab({
  branches,
  onApprovalSuccess,
}: AttendanceAdjustmentApprovalTabProps) {
  const [adjustments, setAdjustments] = useState<AdjustmentApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING')
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<AdjustmentApprovalItem | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedBranch) params.append('branchId', selectedBranch)
      if (selectedType) params.append('type', selectedType)
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      params.append('page', page.toString())
      params.append('limit', '15')

      const res = await fetch(`/api/attendance/adjustments?${params.toString()}`)
      const data = await res.json()
      if (data.success && data.data) {
        setAdjustments(data.data.adjustments || [])
        setTotalPages(data.data.pagination?.totalPages || 1)
        setTotalCount(data.data.pagination?.total || 0)
      } else {
        throw new Error(data.error?.message || 'Không thể tải danh sách giải trình')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedBranch, selectedType, page, searchQuery])

  useEffect(() => {
    fetchAdjustments()
  }, [fetchAdjustments])

  const handleApprove = async (id: string) => {
    if (!window.confirm('Xác nhận phê duyệt đơn giải trình bù công này? Bản ghi chấm công ngày đó sẽ được cập nhật tự động.')) {
      return
    }

    try {
      setProcessingId(id)
      const res = await fetch(`/api/attendance/adjustments/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED' }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Phê duyệt thất bại')
      }

      await fetchAdjustments()
      if (onApprovalSuccess) onApprovalSuccess()
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi khi duyệt đơn')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectingItem) return

    try {
      setProcessingId(rejectingItem.id)
      const res = await fetch(`/api/attendance/adjustments/${rejectingItem.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJECTED',
          rejectReason: rejectReason.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Từ chối thất bại')
      }

      setRejectingItem(null)
      setRejectReason('')
      await fetchAdjustments()
      if (onApprovalSuccess) onApprovalSuccess()
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi khi từ chối đơn')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-gray-800 text-sm">
              Bộ lọc xét duyệt giải trình
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAdjustments}
              disabled={loading}
              className="text-xs font-medium text-gray-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5 transition"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* Status Tab Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Trạng thái:</span>
          {[
            { value: '', label: 'Tất cả' },
            { value: 'PENDING', label: 'Chờ duyệt' },
            { value: 'APPROVED', label: 'Đã duyệt' },
            { value: 'REJECTED', label: 'Đã từ chối' },
            { value: 'CANCELLED', label: 'Đã hủy' },
          ].map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => {
                setSelectedStatus(st.value)
                setPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedStatus === st.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Chi nhánh</label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
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

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Loại giải trình</label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPage(1)
              }}
              className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">Tất cả loại sự cố</option>
              <option value="FORGOT_CHECKIN">{getAdjustmentTypeLabel('FORGOT_CHECKIN')}</option>
              <option value="FORGOT_CHECKOUT">{getAdjustmentTypeLabel('FORGOT_CHECKOUT')}</option>
              <option value="FORGOT_BOTH">{getAdjustmentTypeLabel('FORGOT_BOTH')}</option>
              <option value="GPS_ERROR">{getAdjustmentTypeLabel('GPS_ERROR')}</option>
              <option value="BUSINESS_OUTSIDE">{getAdjustmentTypeLabel('BUSINESS_OUTSIDE')}</option>
            </select>
          </div>

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
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Adjustments Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <span>Danh sách đơn giải trình</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {totalCount} đơn
            </span>
          </div>
        </div>

        {loading && adjustments.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Đang tải danh sách đơn giải trình...</span>
          </div>
        ) : adjustments.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Không tìm thấy đơn giải trình nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {adjustments.map((item) => {
              const statusInfo = getAdjustmentStatusLabel(item.status)
              return (
                <div
                  key={item.id}
                  className="p-5 hover:bg-gray-50/70 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left Column: Employee Info & Request */}
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {item.employee.fullName.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-sm">
                          {item.employee.fullName}
                        </span>
                        <span className="text-xs text-gray-400 font-mono ml-1.5">
                          ({item.employee.employeeCode})
                        </span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                        {item.employee.branch?.name || 'Chi nhánh'} • {item.employee.department?.name || 'Phòng ban'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-gray-800 flex items-center gap-1 bg-indigo-50/80 text-indigo-900 px-2 py-0.5 rounded-md">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Ngày giải trình: {formatVietnamDateDisplay(item.date)}
                      </span>
                      <span className="font-semibold text-indigo-600 px-2 py-0.5 bg-gray-100 rounded-md">
                        {getAdjustmentTypeLabel(item.type)}
                      </span>
                      <span className="font-mono text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md">
                        Đề xuất: {item.requestedCheckIn ? formatVietnamTime(item.requestedCheckIn) : '--'} – {item.requestedCheckOut ? formatVietnamTime(item.requestedCheckOut) : '--'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <span className="font-semibold text-gray-700">Lý do: </span>
                      {item.reason}
                    </p>

                    {item.evidenceUrl && (
                      <div className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">
                          Xem liên kết minh chứng
                        </a>
                      </div>
                    )}

                    {item.rejectReason && (
                      <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                        <span className="font-bold">Lý do từ chối: </span>
                        {item.rejectReason}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Status & Action buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>

                    {item.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(item.id)}
                          disabled={processingId === item.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition shadow-sm disabled:opacity-50 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingItem(item)
                            setRejectReason('')
                          }}
                          disabled={processingId === item.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 active:scale-95 transition disabled:opacity-50 flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Trang {page} / {totalPages} ({totalCount} kết quả)</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 text-rose-700">
                <XCircle className="w-4 h-4" />
                Từ chối đơn giải trình
              </h4>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Nhân viên: <strong>{rejectingItem.employee.fullName}</strong> ({formatVietnamDateDisplay(rejectingItem.date)})
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lý do từ chối (tùy chọn)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do không chấp thuận giải trình để nhân viên nắm rõ..."
                className="w-full text-xs border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={processingId === rejectingItem.id}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm"
              >
                {processingId === rejectingItem.id ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
