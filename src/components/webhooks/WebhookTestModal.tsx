'use client'

import React, { useState } from 'react'
import {
  X,
  Send,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Code,
  RotateCw,
} from 'lucide-react'

interface WebhookTestModalProps {
  webhook: {
    id: string
    name: string
    channel: string
    url: string
  } | null
  onClose: () => void
}

export function WebhookTestModal({ webhook, onClose }: WebhookTestModalProps) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    isSuccess: boolean
    responseStatus: number | null
    responseBody: string | null
    durationMs: number
    errorMessage: string | null
  } | null>(null)

  if (!webhook) return null

  const handleRunTest = async () => {
    setTesting(true)
    setResult(null)
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}/test`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.data) {
        setResult(json.data)
      } else {
        setResult({
          isSuccess: false,
          responseStatus: res.status,
          responseBody: json.message || 'Lỗi kiểm tra kết nối',
          durationMs: 0,
          errorMessage: json.message,
        })
      }
    } catch (err: any) {
      setResult({
        isSuccess: false,
        responseStatus: null,
        responseBody: null,
        durationMs: 0,
        errorMessage: err?.message || 'Lỗi mạng khi gửi thử nghiệm',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Thử Nghiệm Kết Nối Webhook
              </h3>
              <p className="text-[11px] text-slate-400 font-mono line-clamp-1">
                {webhook.name} ({webhook.channel})
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-slate-500">
              <span>Đích đến (Destination):</span>
              <span className="font-bold text-slate-800">{webhook.channel}</span>
            </div>
            <div className="text-[11px] text-slate-600 break-all">
              {webhook.url}
            </div>
          </div>

          {/* Result view */}
          {result && (
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                result.isSuccess
                  ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                  : 'border-rose-200 bg-rose-50/40 text-rose-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {result.isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Kết nối thành công (HTTP {result.responseStatus})</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-600" />
                      <span>Kết nối thất bại (HTTP {result.responseStatus || 'ERR'})</span>
                    </>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <Clock className="h-3 w-3" />
                  {result.durationMs} ms
                </span>
              </div>

              {result.errorMessage && (
                <div className="text-[11px] text-rose-700 font-medium">
                  {result.errorMessage}
                </div>
              )}

              {result.responseBody && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Phản hồi từ máy chủ đích (Response Body):
                  </span>
                  <pre className="font-mono text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 max-h-36 overflow-auto">
                    {result.responseBody}
                  </pre>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-500 italic">
            Gói tin thử nghiệm bao gồm sự kiện chấm công mẫu. Nếu là Telegram Bot hoặc Discord, bạn sẽ nhận được tin nhắn tức thì trong kênh!
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handleRunTest}
            disabled={testing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            {testing ? (
              <>
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                Đang gửi ping...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Bắt Đầu Gửi Ping
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
