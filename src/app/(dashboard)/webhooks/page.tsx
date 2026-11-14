'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Webhook,
  Plus,
  RotateCw,
  Send,
  Zap,
  History,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ExternalLink,
} from 'lucide-react'
import { ChannelBadge } from '@/components/webhooks/ChannelBadge'
import { WebhookMetricsCards } from '@/components/webhooks/WebhookMetricsCards'
import { WebhookFormModal, WebhookFormData } from '@/components/webhooks/WebhookFormModal'
import { WebhookTestModal } from '@/components/webhooks/WebhookTestModal'
import { WebhookDeliveriesDrawer } from '@/components/webhooks/WebhookDeliveriesDrawer'

export interface WebhookItem {
  id: string
  name: string
  channel: 'TELEGRAM' | 'DISCORD' | 'GENERIC_WEBHOOK' | 'ZALO_ZNS'
  url: string
  secret: string | null
  events: string[]
  isActive: boolean
  branchId: string | null
  branchName: string
  metadata: any
  metrics: {
    totalDeliveries: number
    successCount: number
    successRatePercent: number
    lastDeliveryAt: string | null
    lastDeliverySuccess: boolean | null
  }
  createdAt: string
  updatedAt: string
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookFormData | null>(null)
  const [testingWebhook, setTestingWebhook] = useState<WebhookItem | null>(null)
  const [historyWebhook, setHistoryWebhook] = useState<WebhookItem | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Load branches
  useEffect(() => {
    fetch('/api/branches')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setBranches(json.data)
        }
      })
      .catch(() => {})
  }, [])

  // Load webhooks
  const fetchWebhooks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setWebhooks(json.data)
      } else {
        showToast(json.message || 'Không thể tải cấu hình webhooks', 'error')
      }
    } catch {
      showToast('Lỗi mạng khi tải danh sách webhooks', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  // Save new / edit
  const handleSaveWebhook = async (data: WebhookFormData): Promise<boolean> => {
    try {
      const isEdit = !!data.id
      const url = isEdit ? `/api/webhooks/${data.id}` : '/api/webhooks'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (json.success) {
        showToast(
          isEdit ? 'Đã cập nhật webhook thành công!' : 'Đã tạo webhook mới thành công!',
          'success'
        )
        fetchWebhooks()
        return true
      } else {
        showToast(json.message || 'Không thể lưu webhook', 'error')
        return false
      }
    } catch {
      showToast('Có lỗi xảy ra khi lưu webhook', 'error')
      return false
    }
  }

  // Toggle active status
  const handleToggleActive = async (item: WebhookItem) => {
    try {
      const res = await fetch(`/api/webhooks/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      const json = await res.json()
      if (json.success) {
        setWebhooks((prev) =>
          prev.map((w) => (w.id === item.id ? { ...w, isActive: !w.isActive } : w))
        )
        showToast(
          `Đã ${!item.isActive ? 'kích hoạt' : 'tạm dừng'} webhook ${item.name}`,
          'success'
        )
      }
    } catch {
      showToast('Lỗi khi thay đổi trạng thái webhook', 'error')
    }
  }

  // Delete webhook
  const handleDelete = async (item: WebhookItem) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa webhook "${item.name}"?`)) return

    try {
      const res = await fetch(`/api/webhooks/${item.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        setWebhooks((prev) => prev.filter((w) => w.id !== item.id))
        showToast('Đã xóa webhook thành công', 'success')
      } else {
        showToast(json.message || 'Không thể xóa webhook', 'error')
      }
    } catch {
      showToast('Lỗi khi xóa webhook', 'error')
    }
  }

  // Calculate Metrics
  const totalCount = webhooks.length
  const activeCount = webhooks.filter((w) => w.isActive).length
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.metrics.totalDeliveries, 0)
  const totalSuccess = webhooks.reduce((sum, w) => sum + w.metrics.successCount, 0)
  const successRatePercent =
    totalDeliveries > 0 ? Math.round((totalSuccess / totalDeliveries) * 100) : 100

  return (
    <div className="min-h-screen space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl transition-all ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-slate-900">
            <Webhook className="h-7 w-7 text-indigo-600" />
            Tích Hợp Webhook & Thông Báo Đa Kênh
          </h1>
          <p className="text-xs text-slate-500">
            Tự động phát thông báo chấm công, đi muộn, đơn từ và an ninh về Telegram Bot, Discord Webhook hoặc Zalo ZNS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWebhooks}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            onClick={() => {
              setEditingWebhook(null)
              setFormModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Thêm Webhook Mới
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <WebhookMetricsCards
        totalCount={totalCount}
        activeCount={activeCount}
        totalDeliveries={totalDeliveries}
        successRatePercent={successRatePercent}
      />

      {/* Webhooks Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-bold text-slate-800">Danh Sách Kênh Webhook ({webhooks.length})</h4>
            <p className="text-xs text-slate-400">
              Quản lý các điểm kết nối ngoại vi và kiểm soát trạng thái gửi tin
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Kênh & Tên gọi</th>
                <th className="py-3 px-4">Điểm đến (URL)</th>
                <th className="py-3 px-4">Chi nhánh</th>
                <th className="py-3 px-4">Sự kiện đăng ký</th>
                <th className="py-3 px-4 text-center">Tỷ lệ thành công</th>
                <th className="py-3 px-4 text-center">Kích hoạt</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <span>Đang tải danh sách webhooks...</span>
                    </div>
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Chưa có cấu hình webhook nào. Bấm <strong>"Thêm Webhook Mới"</strong> để kết nối Telegram hoặc Discord!
                  </td>
                </tr>
              ) : (
                webhooks.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Channel & Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-900 text-xs">
                          {item.name}
                        </span>
                        <div>
                          <ChannelBadge channel={item.channel} size="sm" />
                        </div>
                      </div>
                    </td>

                    {/* URL */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 max-w-[220px]">
                      <div className="truncate" title={item.url}>
                        {item.url}
                      </div>
                      {item.metadata?.chatId && (
                        <div className="text-[10px] text-slate-400">
                          Chat ID: {item.metadata.chatId}
                        </div>
                      )}
                    </td>

                    {/* Branch */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {item.branchName}
                      </span>
                    </td>

                    {/* Events */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {item.events.slice(0, 2).map((ev) => (
                          <span
                            key={ev}
                            className="rounded bg-indigo-50 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700 border border-indigo-100"
                          >
                            {ev}
                          </span>
                        ))}
                        {item.events.length > 2 && (
                          <span className="text-[10px] text-slate-400 font-bold self-center">
                            +{item.events.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Metrics */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block font-extrabold text-xs px-2 py-0.5 rounded-lg ${
                          item.metrics.successRatePercent >= 90
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.metrics.successRatePercent}% ({item.metrics.totalDeliveries})
                      </span>
                    </td>

                    {/* Toggle Active */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          onChange={() => handleToggleActive(item)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setTestingWebhook(item)}
                          title="Gửi thử nghiệm ping ngay"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors shadow-2xs"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => setHistoryWebhook(item)}
                          title="Xem lịch sử phát"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors shadow-2xs"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setEditingWebhook({
                              id: item.id,
                              name: item.name,
                              channel: item.channel,
                              url: item.url,
                              secret: '',
                              events: item.events,
                              isActive: item.isActive,
                              branchId: item.branchId,
                              chatId: item.metadata?.chatId,
                            })
                            setFormModalOpen(true)
                          }}
                          title="Chỉnh sửa"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(item)}
                          title="Xóa webhook"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors shadow-2xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {formModalOpen && (
        <WebhookFormModal
          initialData={editingWebhook}
          branches={branches}
          onClose={() => {
            setFormModalOpen(false)
            setEditingWebhook(null)
          }}
          onSave={handleSaveWebhook}
        />
      )}

      {/* Test Modal */}
      <WebhookTestModal
        webhook={testingWebhook}
        onClose={() => setTestingWebhook(null)}
      />

      {/* History Drawer */}
      <WebhookDeliveriesDrawer
        subscription={historyWebhook}
        onClose={() => setHistoryWebhook(null)}
      />
    </div>
  )
}
