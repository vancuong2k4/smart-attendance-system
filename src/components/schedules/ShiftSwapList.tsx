'use client'

import React, { useState } from 'react'
import {
  ArrowLeftRight,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  User,
  ShieldCheck,
} from 'lucide-react'

export interface ShiftSwapItem {
  id: string
  requesterId: string
  targetEmployeeId: string
  requesterDate: string | Date
  targetDate: string | Date
  reason: string
  peerStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  status: 'PENDING_PEER' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  rejectReason?: string | null
  createdAt: string | Date
  requester: {
    id: string
    fullName: string
    employeeCode: string
    avatarUrl?: string | null
    branch?: { name: string }
    department?: { name: string }
  }
  targetEmployee: {
    id: string
    fullName: string
    employeeCode: string
    avatarUrl?: string | null
    branch?: { name: string }
    department?: { name: string }
  }
  requesterSchedule: {
    id: string
    name: string
    startTime: string
    endTime: string
  }
  targetSchedule: {
    id: string
    name: string
    startTime: string
    endTime: string
  }
}

interface ShiftSwapListProps {
  swaps: ShiftSwapItem[]
  currentEmployeeId: string
  isManager: boolean
  onRefresh: () => void
}

export default function ShiftSwapList({
  swaps,
  currentEmployeeId,
  isManager,
  onRefresh,
}: ShiftSwapListProps) {
  const [activeTab, setActiveTab] = useState<'sent' | 'received' | 'manage'>('sent')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [rejectingItem, setRejectingItem] = useState<{ id: string; type: 'peer' | 'manager' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Filter lists
  const sentSwaps = swaps.filter((s) => s.requesterId === currentEmployeeId)
  const receivedSwaps = swaps.filter((s) => s.targetEmployeeId === currentEmployeeId)
  const manageSwaps = swaps.filter((s) => s.status === 'PENDING_MANAGER')

  const handlePeerResponse = async (id: string, action: 'ACCEPT' | 'REJECT', reasonText?: string) => {
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/schedules/swaps/${id}/peer-response`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectReason: reasonText || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Thao tác thất bại')
      }
      onRefresh()
      setRejectingItem(null)
      setRejectReason('')
    } catch (err: any) {
      alert(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleManagerDecision = async (id: string, action: 'APPROVE' | 'REJECT', reasonText?: string) => {
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/schedules/swaps/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectReason: reasonText || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Thao tác thất bại')
      }
      onRefresh()
      setRejectingItem(null)
      setRejectReason('')
    } catch (err: any) {
      alert(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn đổi ca này?')) return
    setActionLoadingId(id)
    try {
      const res = await fetch(`/api/schedules/swaps/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Không thể hủy đơn')
      }
      onRefresh()
    } catch (err: any) {
      alert(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setActionLoadingId(null)
    }
  }

  const getStatusBadge = (status: ShiftSwapItem['status']) => {
    switch (status) {
      case 'PENDING_PEER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} /> Chờ đồng nghiệp phản hồi
          </span>
        )
      case 'PENDING_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ShieldCheck size={12} /> Chờ quản lý duyệt
          </span>
        )
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Đã phê duyệt
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={12} /> Đã từ chối
          </span>
        )
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Đã hủy
          </span>
        )
    }
  }

  const activeList =
    activeTab === 'sent'
      ? sentSwaps
      : activeTab === 'received'
      ? receivedSwaps
      : manageSwaps

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'sent'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Yêu cầu đã gửi ({sentSwaps.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'received'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Yêu cầu nhận được ({receivedSwaps.length})
        </button>

        {isManager && (
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'manage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Xét duyệt đổi ca ({manageSwaps.length})</span>
          </button>
        )}
      </div>

      {/* Cards list */}
      {activeList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <ArrowLeftRight size={24} />
          </div>
          <h4 className="text-sm font-bold text-slate-700">Chưa có yêu cầu đổi ca nào</h4>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'sent'
              ? 'Bạn chưa gửi yêu cầu đổi ca làm việc nào.'
              : activeTab === 'received'
              ? 'Hiện tại không có đồng nghiệp nào yêu cầu đổi ca với bạn.'
              : 'Không có đơn đổi ca nào đang chờ quản lý phê duyệt.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeList.map((item) => {
            const isLoading = actionLoadingId === item.id

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow"
              >
                {/* Header card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <ArrowLeftRight size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {item.requester.fullName} &harr; {item.targetEmployee.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Gửi lúc: {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {/* Swap Details */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                      Ca chuyển đi
                    </span>
                    <div className="font-semibold text-slate-800">{item.requesterSchedule.name}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {new Date(item.requesterDate).toLocaleDateString('vi-VN')} ({item.requesterSchedule.startTime} - {item.requesterSchedule.endTime})
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                      Ca nhận về
                    </span>
                    <div className="font-semibold text-slate-800">{item.targetSchedule.name}</div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      {new Date(item.targetDate).toLocaleDateString('vi-VN')} ({item.targetSchedule.startTime} - {item.targetSchedule.endTime})
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div className="text-xs text-slate-600 italic">
                  &ldquo;{item.reason}&rdquo;
                </div>

                {/* Reject reason if any */}
                {item.rejectReason && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[11px]">
                    <strong>Lý do từ chối:</strong> {item.rejectReason}
                  </div>
                )}

                {/* Actions Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  {/* Sent Tab: Cancel button */}
                  {activeTab === 'sent' &&
                    (item.status === 'PENDING_PEER' || item.status === 'PENDING_MANAGER') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(item.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
                      >
                        Hủy yêu cầu
                      </button>
                    )}

                  {/* Received Tab: Peer accept/reject */}
                  {activeTab === 'received' && item.status === 'PENDING_PEER' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setRejectingItem({ id: item.id, type: 'peer' })
                        }
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePeerResponse(item.id, 'ACCEPT')}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>Đồng ý đổi ca</span>
                      </button>
                    </>
                  )}

                  {/* Manage Tab: Manager Approve / Reject */}
                  {activeTab === 'manage' && item.status === 'PENDING_MANAGER' && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setRejectingItem({ id: item.id, type: 'manager' })
                        }
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManagerDecision(item.id, 'APPROVE')}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>Phê duyệt đổi ca</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <XCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Từ chối yêu cầu đổi ca</h3>
                <p className="text-xs text-slate-500">
                  Vui lòng cung cấp lý do từ chối để thông báo cho nhân viên
                </p>
              </div>
            </div>

            <textarea
              rows={3}
              placeholder="Nhập lý do từ chối..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingItem(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (rejectingItem.type === 'peer') {
                    handlePeerResponse(rejectingItem.id, 'REJECT', rejectReason)
                  } else {
                    handleManagerDecision(rejectingItem.id, 'REJECT', rejectReason)
                  }
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
