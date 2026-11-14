'use client'

import React from 'react'
import {
  X,
  Clock,
  Shield,
  Monitor,
  Globe,
  FileText,
  User,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

export interface DetailedAuditLog {
  id: string
  userId: string
  user: {
    id: string
    email: string
    role: string
    fullName: string
    employeeCode: string | null
    avatarUrl: string | null
    position: string | null
    branchName: string | null
  } | null
  action: string
  actionMeta: {
    label: string
    category: string
    badgeColor: string
  }
  entity: string
  entityId: string
  severity: string
  status: string
  ipAddress: string | null
  userAgent: string | null
  oldData: any
  newData: any
  metadata?: any
  createdAt: string
}

interface AuditDetailModalProps {
  log: DetailedAuditLog | null
  onClose: () => void
}

export function AuditDetailModal({ log, onClose }: AuditDetailModalProps) {
  if (!log) return null

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return isoString
    }
  }

  // Lấy danh sách keys thay đổi
  const oldKeys = log.oldData && typeof log.oldData === 'object' ? Object.keys(log.oldData) : []
  const newKeys = log.newData && typeof log.newData === 'object' ? Object.keys(log.newData) : []
  const allKeys = Array.from(new Set([...oldKeys, ...newKeys]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">
                {log.actionMeta.label}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${log.actionMeta.badgeColor}`}
              >
                {log.severity}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Sự kiện ID: {log.id} • Thực thể: {log.entity} (#{log.entityId})
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs">
            {/* Người thực hiện */}
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Người thực hiện
              </span>
              <div className="font-semibold text-slate-800">
                {log.user?.fullName || 'Hệ thống tự động'}
              </div>
              <div className="text-[11px] text-slate-500">
                {log.user?.email || 'N/A'} {log.user?.role ? `(${log.user.role})` : ''}
              </div>
            </div>

            {/* Thời gian */}
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Thời gian ghi nhận
              </span>
              <div className="font-semibold text-slate-800">
                {formatDateTime(log.createdAt)}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {log.createdAt}
              </div>
            </div>

            {/* Địa chỉ IP */}
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Địa chỉ IP
              </span>
              <div className="font-mono font-semibold text-slate-800">
                {log.ipAddress || '127.0.0.1'}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium">
                Xác thực phiên hợp lệ
              </div>
            </div>

            {/* Trình duyệt / Thiết bị */}
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Thiết bị / User Agent
              </span>
              <div className="font-mono text-[11px] text-slate-700 line-clamp-2" title={log.userAgent || ''}>
                {log.userAgent || 'Unknown'}
              </div>
            </div>
          </div>

          {/* JSON Diff Comparison Viewer */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              So Sánh Thay Đổi Dữ Liệu (State Diff Viewer)
            </h4>

            {allKeys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                Sự kiện này không có thay đổi trạng thái dữ liệu (oldData / newData)
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dữ liệu cũ */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 mb-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Trạng thái trước thay đổi (oldData)
                  </div>
                  {log.oldData ? (
                    <pre className="font-mono text-xs text-rose-950 bg-white p-3 rounded-lg border border-rose-100 overflow-x-auto max-h-80">
                      {JSON.stringify(log.oldData, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-4 text-center">
                      (Không có dữ liệu cũ - Đây là hành động tạo mới)
                    </div>
                  )}
                </div>

                {/* Dữ liệu mới */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Trạng thái sau thay đổi (newData)
                  </div>
                  {log.newData ? (
                    <pre className="font-mono text-xs text-emerald-950 bg-white p-3 rounded-lg border border-emerald-100 overflow-x-auto max-h-80">
                      {JSON.stringify(log.newData, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-4 text-center">
                      (Không có dữ liệu mới - Đây là hành động xóa)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata bổ sung nếu có */}
          {log.metadata && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Thông tin bổ sung (Metadata):
              </span>
              <pre className="font-mono text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3 bg-slate-50/50">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 transition-colors shadow-xs"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  )
}
