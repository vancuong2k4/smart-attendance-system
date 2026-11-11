'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Clock,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { formatVietnamDateDisplay, formatVietnamTime } from '@/lib/attendance'
import {
  getAdjustmentTypeLabel,
  getAdjustmentStatusLabel,
} from '@/lib/attendance-adjustment'

interface AdjustmentRecord {
  id: string
  date: string
  type: string
  requestedCheckIn?: string | null
  requestedCheckOut?: string | null
  reason: string
  evidenceUrl?: string | null
  status: string
  approvedById?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  createdAt: string
}

interface AttendanceAdjustmentListProps {
  onAdjustmentChanged?: () => void
  refreshTrigger?: number
}

export default function AttendanceAdjustmentList({
  onAdjustmentChanged,
  refreshTrigger,
}: AttendanceAdjustmentListProps) {
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAdjustments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/attendance/adjustments?limit=30')
      const data = await res.json()
      if (data.success && data.data?.adjustments) {
        setAdjustments(data.data.adjustments)
      } else {
        throw new Error(data.error?.message || 'Không thể tải danh sách giải trình')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdjustments()
  }, [fetchAdjustments, refreshTrigger])

  const handleCancel = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn giải trình này không?')) {
      return
    }

    try {
      setCancellingId(id)
      const res = await fetch(`/api/attendance/adjustments/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Hủy đơn thất bại')
      }
      await fetchAdjustments()
      if (onAdjustmentChanged) onAdjustmentChanged()
    } catch (err: any) {
      alert(err.message || 'Đã xảy ra lỗi khi hủy đơn')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" />
            Lịch sử đơn giải trình bù công cá nhân
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-bold text-gray-600">
            {adjustments.length}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchAdjustments}
          disabled={loading}
          className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1 transition p-1.5 rounded-lg hover:bg-gray-100"
          title="Tải lại danh sách"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && adjustments.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Đang tải danh sách giải trình...</span>
        </div>
      ) : adjustments.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-xs">
          Bạn chưa có đơn giải trình bù công nào. Nhấn &quot;Giải trình chấm công&quot; ở trên để tạo đơn mới.
        </div>
      ) : (
        <div className="space-y-3">
          {adjustments.map((item) => {
            const statusInfo = getAdjustmentStatusLabel(item.status)
            return (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      {formatVietnamDateDisplay(item.date)}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                      {getAdjustmentTypeLabel(item.type)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                    {item.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(item.id)}
                        disabled={cancellingId === item.id}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-0.5 rounded-md hover:bg-rose-50 transition border border-rose-200 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        {cancellingId === item.id ? 'Đang hủy...' : 'Hủy đơn'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Requested Times & Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-lg space-y-1">
                    <span className="text-gray-400 font-medium">Giờ đề xuất:</span>
                    <div className="flex items-center gap-3 font-mono font-bold text-gray-800">
                      <span>Vào: {item.requestedCheckIn ? formatVietnamTime(item.requestedCheckIn) : '--'}</span>
                      <span>•</span>
                      <span>Ra: {item.requestedCheckOut ? formatVietnamTime(item.requestedCheckOut) : '--'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-gray-50 rounded-lg space-y-1">
                    <span className="text-gray-400 font-medium">Lý do giải trình:</span>
                    <div className="text-gray-800 font-medium line-clamp-2">{item.reason}</div>
                  </div>
                </div>

                {/* Reject reason or evidence link */}
                {item.rejectReason && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-start gap-1.5">
                    <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Lý do từ chối: {item.rejectReason}</span>
                  </div>
                )}

                {item.evidenceUrl && (
                  <div className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">
                      Xem minh chứng đính kèm
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
