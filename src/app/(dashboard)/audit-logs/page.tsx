'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert,
  RotateCw,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react'
import { AuditMetricsCards } from '@/components/audit/AuditMetricsCards'
import { SecurityTrendChart } from '@/components/audit/SecurityTrendChart'
import { AuditFilterBar } from '@/components/audit/AuditFilterBar'
import { AuditLogTable, AuditLogItem } from '@/components/audit/AuditLogTable'
import { AuditDetailModal, DetailedAuditLog } from '@/components/audit/AuditDetailModal'

export default function AuditLogsPage() {
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('ALL')
  const [entity, setEntity] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  // Data state
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  })

  // Metrics state
  const [metrics, setMetrics] = useState({
    summary: {
      totalEvents: 0,
      last24hEvents: 0,
      criticalCount: 0,
      warningCount: 0,
    },
    topActors: [],
    actionBreakdown: [],
    timelineTrend: [],
  })

  // Detail Modal state
  const [selectedLog, setSelectedLog] = useState<DetailedAuditLog | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true)
    try {
      const res = await fetch('/api/audit-logs/metrics')
      const json = await res.json()
      if (json.success && json.data) {
        setMetrics(json.data)
      }
    } catch (err) {
      console.error('Failed to load audit metrics:', err)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '20')
      if (search) params.set('search', search)
      if (severity !== 'ALL') params.set('severity', severity)
      if (entity !== 'ALL') params.set('entity', entity)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/audit-logs?${params.toString()}`)
      const json = await res.json()

      if (json.success && json.data) {
        setLogs(json.data.items || [])
        setPagination(json.data.pagination)
      } else {
        showToast(json.message || 'Không thể nạp danh sách kiểm toán', 'error')
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
      showToast('Có lỗi xảy ra khi tải dữ liệu', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, search, severity, entity, startDate, endDate])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Select log for detail inspection
  const handleSelectLog = async (logId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/audit-logs/${logId}`)
      const json = await res.json()
      if (json.success && json.data) {
        setSelectedLog(json.data)
      } else {
        showToast('Không thể tải chi tiết sự kiện', 'error')
      }
    } catch {
      showToast('Lỗi khi tải chi tiết sự kiện', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  // Export CSV / JSON
  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      if (search) params.set('search', search)
      if (severity !== 'ALL') params.set('severity', severity)
      if (entity !== 'ALL') params.set('entity', entity)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/audit-logs/export?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Export failed')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      showToast(`Đã xuất thành công tệp ${format.toUpperCase()}`, 'success')
    } catch {
      showToast('Có lỗi xảy ra khi xuất tệp dữ liệu', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  // Reset filters
  const handleResetFilters = () => {
    setSearch('')
    setSeverity('ALL')
    setEntity('ALL')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

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
            <ShieldAlert className="h-7 w-7 text-indigo-600" />
            Nhật Ký Kiểm Toán & Giám Sát Bảo Mật
          </h1>
          <p className="text-xs text-slate-500">
            Theo dõi, lưu vết mọi thao tác nhạy cảm và kiểm soát tính toàn vẹn hệ thống theo thời gian thực
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchMetrics()
              fetchLogs()
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RotateCw className="h-3.5 w-3.5 text-slate-500" />
            Làm mới
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <AuditMetricsCards metrics={metrics.summary} />

      {/* Security Trend Chart & Top Users */}
      <SecurityTrendChart
        timelineTrend={metrics.timelineTrend}
        topActors={metrics.topActors}
        actionBreakdown={metrics.actionBreakdown}
      />

      {/* Filter Toolbar */}
      <AuditFilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val)
          setPage(1)
        }}
        severity={severity}
        onSeverityChange={(val) => {
          setSeverity(val)
          setPage(1)
        }}
        entity={entity}
        onEntityChange={(val) => {
          setEntity(val)
          setPage(1)
        }}
        startDate={startDate}
        onStartDateChange={(val) => {
          setStartDate(val)
          setPage(1)
        }}
        endDate={endDate}
        onEndDateChange={(val) => {
          setEndDate(val)
          setPage(1)
        }}
        onReset={handleResetFilters}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Audit Logs Table */}
      <AuditLogTable
        logs={logs}
        pagination={pagination}
        onPageChange={(newPage) => setPage(newPage)}
        onSelectLog={handleSelectLog}
        loading={loading}
      />

      {/* Detail Modal */}
      <AuditDetailModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  )
}
