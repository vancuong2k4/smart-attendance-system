'use client'

import React, { useState } from 'react'
import { X, Clock, FileText, AlertCircle, CheckCircle2, Link2, Calendar } from 'lucide-react'
import { getVietnamDateString } from '@/lib/attendance'
import { getAdjustmentTypeLabel } from '@/lib/attendance-adjustment'

interface AttendanceAdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AttendanceAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
}: AttendanceAdjustmentModalProps) {
  const todayStr = getVietnamDateString()
  const [date, setDate] = useState<string>(todayStr)
  const [type, setType] = useState<string>('FORGOT_CHECKIN')
  const [requestedCheckIn, setRequestedCheckIn] = useState<string>('08:00')
  const [requestedCheckOut, setRequestedCheckOut] = useState<string>('17:00')
  const [reason, setReason] = useState<string>('')
  const [evidenceUrl, setEvidenceUrl] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!reason.trim() || reason.trim().length < 5) {
      setError('Vui lòng nhập lý do giải trình cụ thể (tối thiểu 5 ký tự)')
      return
    }

    const payload: any = {
      date,
      type,
      reason: reason.trim(),
      evidenceUrl: evidenceUrl.trim() || null,
    }

    if (type === 'FORGOT_CHECKIN' || type === 'FORGOT_BOTH' || type === 'GPS_ERROR' || type === 'BUSINESS_OUTSIDE') {
      if (requestedCheckIn) payload.requestedCheckIn = requestedCheckIn
    }

    if (type === 'FORGOT_CHECKOUT' || type === 'FORGOT_BOTH' || type === 'GPS_ERROR' || type === 'BUSINESS_OUTSIDE') {
      if (requestedCheckOut) payload.requestedCheckOut = requestedCheckOut
    }

    if (!payload.requestedCheckIn && !payload.requestedCheckOut) {
      setError('Cần cung cấp ít nhất giờ check-in hoặc check-out đề xuất')
      return
    }

    if (type === 'FORGOT_BOTH' && (!payload.requestedCheckIn || !payload.requestedCheckOut)) {
      setError('Khi chọn quên cả check-in và check-out, vui lòng nhập đầy đủ cả 2 mốc giờ')
      return
    }

    if (payload.requestedCheckIn && payload.requestedCheckOut && payload.requestedCheckIn >= payload.requestedCheckOut) {
      setError('Giờ check-out đề xuất phải sau giờ check-in đề xuất')
      return
    }

    if (date === todayStr) {
      const now = new Date()
      const currentHoursMinutes = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      if (payload.requestedCheckIn && payload.requestedCheckIn > currentHoursMinutes) {
        setError('Giờ check-in đề xuất không thể ở thời điểm tương lai của hôm nay')
        return
      }
      if (payload.requestedCheckOut && payload.requestedCheckOut > currentHoursMinutes) {
        setError('Giờ check-out đề xuất không thể ở thời điểm tương lai của hôm nay')
        return
      }
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/attendance/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Không thể gửi đơn giải trình')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi gửi đơn giải trình')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Giải trình bù công</h3>
              <p className="text-xs text-gray-500">Quên check-in/out, lỗi GPS hoặc công tác ngoài</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Ngày cần giải trình *
            </label>
            <input
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Loại sự cố / Lý do chính *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
            >
              <option value="FORGOT_CHECKIN">{getAdjustmentTypeLabel('FORGOT_CHECKIN')}</option>
              <option value="FORGOT_CHECKOUT">{getAdjustmentTypeLabel('FORGOT_CHECKOUT')}</option>
              <option value="FORGOT_BOTH">{getAdjustmentTypeLabel('FORGOT_BOTH')}</option>
              <option value="GPS_ERROR">{getAdjustmentTypeLabel('GPS_ERROR')}</option>
              <option value="BUSINESS_OUTSIDE">{getAdjustmentTypeLabel('BUSINESS_OUTSIDE')}</option>
            </select>
          </div>

          {/* Time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Giờ vào đề xuất
              </label>
              <input
                type="time"
                value={requestedCheckIn}
                onChange={(e) => setRequestedCheckIn(e.target.value)}
                disabled={type === 'FORGOT_CHECKOUT'}
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">VD: 08:00</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Giờ ra đề xuất
              </label>
              <input
                type="time"
                value={requestedCheckOut}
                onChange={(e) => setRequestedCheckOut(e.target.value)}
                disabled={type === 'FORGOT_CHECKIN'}
                className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:bg-gray-100 disabled:text-gray-400"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">VD: 17:00</span>
            </div>
          </div>

          {/* Reason Textarea */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Lý do chi tiết *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Giải trình cụ thể nguyên nhân (VD: Khách hàng yêu cầu họp đột xuất tại đối tác, điện thoại hết pin chưa kịp check-in...)"
              required
              className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
            />
          </div>

          {/* Evidence URL / Proof */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-gray-500" />
              Đường dẫn minh chứng (nếu có)
            </label>
            <input
              type="text"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="Link ảnh tin nhắn xác nhận, hóa đơn công tác hoặc giấy tờ chứng minh"
              className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Đang nộp...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Nộp đơn giải trình
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
