'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Code,
} from 'lucide-react'

export interface DeliveryLogItem {
  id: string
  subscriptionId: string
  event: string
  payload: any
  responseStatus: number | null
  responseBody: string | null
  durationMs: number
  isSuccess: boolean
  errorMessage: string | null
  createdAt: string
}

interface WebhookDeliveriesDrawerProps {
  subscription: {
    id: string
    name: string
  } | null
  onClose: () => void
}

export function WebhookDeliveriesDrawer({
  subscription,
  onClose,
}: WebhookDeliveriesDrawerProps) {
  const [deliveries, setDeliveries] = useState<DeliveryLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<DeliveryLogItem | null>(null)

  useEffect(() => {
    if (!subscription) return

    setLoading(true)
    fetch(`/api/webhooks/${subscription.id}/deliveries`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setDeliveries(json.data.deliveries || [])
        }
      })
      .catch((err) => console.error('Failed to load webhook deliveries:', err))
      .finally(() => setLoading(false))
  }, [subscription])

  if (!subscription) return null

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString('vi-VN') + ' - ' + d.toLocaleDateString('vi-VN')
    } catch {
      return iso
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Nhật Ký Phát Webhook (Delivery Logs)
              </h3>
              <p className="text-[11px] text-slate-400">
                {subscription.name} • 50 lượt phát gần nhất
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-slate-400">
              <RotateCw className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
              <span>Đang tải lịch sử phát...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Chưa có sự kiện nào được phát từ webhook này
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {deliveries.map((del) => (
                <div
                  key={del.id}
                  className="flex flex-col gap-2 p-3.5 hover:bg-slate-50/80 transition-colors text-xs cursor-pointer"
                  onClick={() => setSelectedLog(selectedLog?.id === del.id ? null : del)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {del.isSuccess ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                          ✓
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                          ✕
                        </span>
                      )}
                      <span className="font-mono font-bold text-slate-800">
                        {del.event}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          del.isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        HTTP {del.responseStatus || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {del.durationMs}ms
                      </span>
                      <span>{formatDateTime(del.createdAt)}</span>
                    </div>
                  </div>

                  {del.errorMessage && (
                    <div className="text-[11px] font-medium text-rose-600 pl-7">
                      Lỗi: {del.errorMessage}
                    </div>
                  )}

                  {/* Expanded JSON Inspector */}
                  {selectedLog?.id === del.id && (
                    <div className="mt-2 pl-7 space-y-2 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          Payload Gửi Đi:
                        </span>
                        <pre className="font-mono text-[11px] bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto max-h-48">
                          {JSON.stringify(del.payload, null, 2)}
                        </pre>
                      </div>

                      {del.responseBody && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Phản Hồi Máy Chủ (Response):
                          </span>
                          <pre className="font-mono text-[11px] bg-slate-100 text-slate-800 p-2.5 rounded-lg border border-slate-200 overflow-x-auto max-h-36">
                            {del.responseBody}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition-colors shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
