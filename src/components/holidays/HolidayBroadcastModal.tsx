'use client'

import React, { useState } from 'react'
import {
  X,
  BellRing,
  Send,
  AlertCircle,
  Building2,
  Calendar,
} from 'lucide-react'

interface HolidayBroadcastModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  holiday: any | null
}

export function HolidayBroadcastModal({
  isOpen,
  onClose,
  onSuccess,
  holiday,
}: HolidayBroadcastModalProps) {
  const [customMessage, setCustomMessage] = useState('')
  const [sendInApp, setSendInApp] = useState(true)
  const [sendWebhooks, setSendWebhooks] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen || !holiday) return null

  const startDateStr = new Date(holiday.date).toLocaleDateString('vi-VN')
  const endDateStr = holiday.endDate ? new Date(holiday.endDate).toLocaleDateString('vi-VN') : null
  const dateRangeStr = endDateStr ? `từ ${startDateStr} đến ${endDateStr}` : `vào ngày ${startDateStr}`

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/holidays/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidayId: holiday.id,
          customMessage: customMessage.trim() || undefined,
          sendInApp,
          sendWebhooks,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Lỗi khi phát thông báo')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra khi phát thông báo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Phát Thông Báo Lịch Nghỉ Lễ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi thông báo đến toàn bộ nhân viên và kích hoạt Webhook đa kênh
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
        <form onSubmit={handleBroadcast} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Card thông tin ngày lễ */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {holiday.name}
            </div>
            <div className="text-slate-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Thời gian: {dateRangeStr}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {holiday.branch?.name || 'Toàn công ty'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Hệ số tính lương khi đi làm: {holiday.payMultiplier * 100}%
            </div>
          </div>

          {/* Lời nhắn tùy chỉnh */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nội dung thông báo (tùy chọn)
            </label>
            <textarea
              rows={3}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={`Để trống nếu muốn sử dụng nội dung mặc định: "Công ty xin thông báo lịch ${holiday.name} ${dateRangeStr}..."`}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Kênh phát thông báo */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Kênh phát thông báo:
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sendInAppBox"
                checked={sendInApp}
                onChange={(e) => setSendInApp(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="sendInAppBox" className="text-xs text-slate-700 dark:text-slate-300">
                Gửi thông báo nội bộ hệ thống (In-App Notifications) tới nhân sự
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sendWebhooksBox"
                checked={sendWebhooks}
                onChange={(e) => setSendWebhooks(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="sendWebhooksBox" className="text-xs text-slate-700 dark:text-slate-300">
                Kích hoạt Webhook phát thông báo ra Telegram Bot, Discord, Zalo OA
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || (!sendInApp && !sendWebhooks)}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Đang phát...' : 'Phát thông báo ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default HolidayBroadcastModal
