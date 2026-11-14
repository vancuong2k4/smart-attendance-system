'use client'

import React from 'react'
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  User,
  Monitor,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

export interface AuditLogItem {
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
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'SECURITY'
  status: 'SUCCESS' | 'FAILURE' | 'DENIED'
  ipAddress: string | null
  userAgent: string | null
  hasDiff: boolean
  createdAt: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface AuditLogTableProps {
  logs: AuditLogItem[]
  pagination: Pagination
  onPageChange: (page: number) => void
  onSelectLog: (logId: string) => void
  loading?: boolean
}

export function AuditLogTable({
  logs,
  pagination,
  onPageChange,
  onSelectLog,
  loading = false,
}: AuditLogTableProps) {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            CRITICAL
          </span>
        )
      case 'SECURITY':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 border border-purple-200">
            <ShieldAlert className="h-3 w-3" />
            SECURITY
          </span>
        )
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 border border-amber-200">
            <AlertCircle className="h-3 w-3" />
            WARNING
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
            <Info className="h-3 w-3" />
            INFO
          </span>
        )
    }
  }

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Mức độ</th>
              <th className="py-3 px-4">Hành động</th>
              <th className="py-3 px-4">Thực thể</th>
              <th className="py-3 px-4">Người thực hiện</th>
              <th className="py-3 px-4">Địa chỉ IP</th>
              <th className="py-3 px-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span>Đang tải nhật ký kiểm toán...</span>
                  </div>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Không tìm thấy bản ghi kiểm toán nào phù hợp với bộ lọc
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {/* Thời gian */}
                  <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {formatDateTime(log.createdAt)}
                    </div>
                  </td>

                  {/* Mức độ */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getSeverityBadge(log.severity)}
                  </td>

                  {/* Hành động */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-800 line-clamp-1">
                        {log.actionMeta.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.action}
                      </span>
                    </div>
                  </td>

                  {/* Thực thể */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                      {log.entity}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 line-clamp-1 max-w-[120px]">
                      ID: {log.entityId}
                    </div>
                  </td>

                  {/* Người thực hiện */}
                  <td className="py-3.5 px-4">
                    {log.user ? (
                      <div className="flex items-center gap-2.5">
                        {log.user.avatarUrl ? (
                          <img
                            src={log.user.avatarUrl}
                            alt={log.user.fullName}
                            className="h-7 w-7 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                            {log.user.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {log.user.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">
                            {log.user.email} {log.user.branchName ? `• ${log.user.branchName}` : ''}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Hệ thống tự động</span>
                    )}
                  </td>

                  {/* Địa chỉ IP */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-mono text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </span>
                  </td>

                  {/* Thao tác */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => onSelectLog(log.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-2xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 bg-slate-50/50">
        <div className="text-xs text-slate-500">
          Hiển thị <strong>{logs.length}</strong> / <strong>{pagination.total}</strong> bản ghi
          (Trang {pagination.page} / {Math.max(1, pagination.totalPages)})
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Trước
          </button>

          <span className="px-2 text-xs font-semibold text-slate-700">
            {pagination.page}
          </span>

          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
          >
            Sau
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
