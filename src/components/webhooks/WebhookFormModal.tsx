'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Webhook,
  Send,
  MessageSquare,
  Globe,
  Bell,
  Key,
  Building2,
  CheckSquare,
  Square,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { WebhookEvents, WEBHOOK_EVENT_MAP } from '@/lib/webhooks'

export interface WebhookFormData {
  id?: string
  name: string
  channel: 'TELEGRAM' | 'DISCORD' | 'GENERIC_WEBHOOK' | 'ZALO_ZNS'
  url: string
  secret?: string | null
  events: string[]
  isActive: boolean
  branchId?: string | null
  chatId?: string
}

interface WebhookFormModalProps {
  initialData?: WebhookFormData | null
  branches: Array<{ id: string; name: string }>
  userRole?: string
  onClose: () => void
  onSave: (data: WebhookFormData) => Promise<boolean>
}

export function WebhookFormModal({
  initialData,
  branches,
  userRole,
  onClose,
  onSave,
}: WebhookFormModalProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [channel, setChannel] = useState<'TELEGRAM' | 'DISCORD' | 'GENERIC_WEBHOOK' | 'ZALO_ZNS'>(
    initialData?.channel || 'TELEGRAM'
  )
  const [url, setUrl] = useState(initialData?.url || '')
  const [chatId, setChatId] = useState(initialData?.chatId || '')
  const [secret, setSecret] = useState(initialData?.secret || '')
  const [events, setEvents] = useState<string[]>(
    initialData?.events || [
      WebhookEvents.ATTENDANCE_CHECK_IN,
      WebhookEvents.ATTENDANCE_LATE_ALERT,
      WebhookEvents.SECURITY_CRITICAL_ALERT,
    ]
  )
  const [isActive, setIsActive] = useState(initialData ? initialData.isActive : true)
  const [branchId, setBranchId] = useState<string>(initialData?.branchId || 'all')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleEvent = (ev: string) => {
    if (events.includes(ev)) {
      if (events.length === 1) return // Cần ít nhất 1 sự kiện
      setEvents(events.filter((e) => e !== ev))
    } else {
      setEvents([...events, ev])
    }
  }

  const selectAllEvents = () => {
    setEvents(Object.values(WebhookEvents))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Vui lòng nhập tên webhook')
      return
    }

    if (!url.trim()) {
      setError('Vui lòng nhập URL webhook / Bot API')
      return
    }

    if (channel === 'TELEGRAM' && !chatId.trim()) {
      setError('Vui lòng nhập Telegram Chat ID')
      return
    }

    if (events.length === 0) {
      setError('Vui lòng chọn ít nhất 1 sự kiện đăng ký')
      return
    }

    setSubmitting(true)
    try {
      const payload: WebhookFormData = {
        name: name.trim(),
        channel,
        url: url.trim(),
        secret: secret.trim() ? secret.trim() : null,
        events,
        isActive,
        branchId: branchId === 'all' ? null : branchId,
        chatId: channel === 'TELEGRAM' ? chatId.trim() : undefined,
      }

      const success = await onSave(payload)
      if (success) {
        onClose()
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu webhook')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Webhook className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {initialData ? 'Chỉnh Sửa Cấu Hình Webhook' : 'Thêm Mới Kênh Webhook / Bot Thông Báo'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Tự động phát thông báo thời gian thực về Telegram, Discord hoặc hệ thống nội bộ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Chọn Kênh */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Kênh Thông Báo Tích Hợp
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setChannel('TELEGRAM')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all ${
                  channel === 'TELEGRAM'
                    ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Send className="h-5 w-5 mb-1.5 text-sky-500" />
                Telegram Bot
              </button>

              <button
                type="button"
                onClick={() => setChannel('DISCORD')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all ${
                  channel === 'DISCORD'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MessageSquare className="h-5 w-5 mb-1.5 text-indigo-500" />
                Discord Webhook
              </button>

              <button
                type="button"
                onClick={() => setChannel('GENERIC_WEBHOOK')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all ${
                  channel === 'GENERIC_WEBHOOK'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Globe className="h-5 w-5 mb-1.5 text-emerald-500" />
                Custom Webhook
              </button>

              <button
                type="button"
                onClick={() => setChannel('ZALO_ZNS')}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-xs font-bold transition-all ${
                  channel === 'ZALO_ZNS'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Bell className="h-5 w-5 mb-1.5 text-blue-500" />
                Zalo ZNS
              </button>
            </div>
          </div>

          {/* 2. Tên Webhook */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tên Gọi Gợi Nhớ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="VD: Nhóm Thông Báo Chấm Công Chi Nhánh HN, Bot Báo Động Đi Muộn..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          {/* 3. URL Endpoint & Thông số riêng từng kênh */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {channel === 'TELEGRAM'
                  ? 'Telegram Bot URL hoặc Bot API Endpoint'
                  : channel === 'DISCORD'
                  ? 'Discord Webhook URL'
                  : 'Webhook Destination Endpoint URL'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="url"
                placeholder={
                  channel === 'TELEGRAM'
                    ? 'https://api.telegram.org/bot<TOKEN>'
                    : channel === 'DISCORD'
                    ? 'https://discord.com/api/webhooks/...'
                    : 'https://api.yourdomain.com/webhooks/attendance'
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Telegram Chat ID */}
            {channel === 'TELEGRAM' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Telegram Chat ID hoặc Group ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: -1001234567890 (ID nhóm chat) hoặc 987654321 (ID cá nhân)"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Thêm Bot vào nhóm Telegram và cấp quyền gửi tin nhắn để Bot hoạt động.
                </p>
              </div>
            )}

            {/* Secret key cho Custom Webhook */}
            {(channel === 'GENERIC_WEBHOOK' || channel === 'ZALO_ZNS') && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Secret Key (Tùy chọn - Ký HMAC-SHA256)
                </label>
                <input
                  type="password"
                  placeholder="Nhập secret key để xác thực chữ ký header X-Signature-SHA256"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* 4. Chi nhánh áp dụng */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Phạm Vi Chi Nhánh Áp Dụng
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={userRole === 'BRANCH_ADMIN'}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none cursor-pointer disabled:bg-slate-100"
            >
              <option value="all">Toàn bộ doanh nghiệp (Tất cả chi nhánh)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  Chi nhánh: {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Sự kiện đăng ký */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Sự Kiện Đăng Ký Nhận Thông Báo ({events.length} đã chọn)
              </label>
              <button
                type="button"
                onClick={selectAllEvents}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Chọn tất cả
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(WEBHOOK_EVENT_MAP).map(([evKey, meta]) => {
                const isSelected = events.includes(evKey)
                return (
                  <div
                    key={evKey}
                    onClick={() => toggleEvent(evKey)}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 text-indigo-600">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{meta.label}</div>
                      <div className="text-[10px] text-slate-400">{meta.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 6. Trạng thái kích hoạt */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Kích Hoạt Webhook
              </span>
              <span className="text-[11px] text-slate-400">
                Cho phép hệ thống phát các sự kiện theo thời gian thực tới URL này
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? 'Đang lưu...' : initialData ? 'Cập nhật Webhook' : 'Lưu Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
