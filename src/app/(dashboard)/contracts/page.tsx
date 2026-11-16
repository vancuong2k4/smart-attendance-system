'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  BellRing,
  RotateCw,
  Eye,
  Edit,
  History,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Ban,
} from 'lucide-react'
import { ContractStatus, ContractType } from '@prisma/client'
import {
  ContractMetricsCards,
  ContractMetricsData,
} from '@/components/contracts/ContractMetricsCards'
import {
  ContractStatusBadge,
  ContractTypeBadge,
} from '@/components/contracts/ContractStatusBadge'
import ContractFormModal, {
  ContractFormData,
} from '@/components/contracts/ContractFormModal'
import ContractDetailModal, {
  ContractDetailData,
} from '@/components/contracts/ContractDetailModal'
import LifecycleTimelineModal from '@/components/contracts/LifecycleTimelineModal'
import { CONTRACT_TYPE_MAP, CONTRACT_STATUS_MAP } from '@/lib/contracts'

interface BranchOption {
  id: string
  name: string
}

export default function ContractsPage() {
  // State quản lý danh sách hợp đồng
  const [contracts, setContracts] = useState<ContractDetailData[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  })

  // State metrics
  const [metrics, setMetrics] = useState<ContractMetricsData | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  // State bộ lọc
  const [search, setSearch] = useState('')
  const [contractType, setContractType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [branchId, setBranchId] = useState<string>('')
  const [branches, setBranches] = useState<BranchOption[]>([])

  // State modals
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formInitialData, setFormInitialData] = useState<Partial<ContractFormData> | null>(null)
  const [isRenewalMode, setIsRenewalMode] = useState(false)

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<ContractDetailData | null>(null)

  const [timelineModalOpen, setTimelineModalOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  // State cảnh báo quét hết hạn
  const [scanningExpiring, setScanningExpiring] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  // Tải danh sách chi nhánh
  useEffect(() => {
    fetch('/api/branches')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setBranches(json.data)
        }
      })
      .catch((err) => console.error('Failed to load branches:', err))
  }, [])

  // Tải metrics thống kê
  const loadMetrics = useCallback(() => {
    setLoadingMetrics(true)
    const params = new URLSearchParams()
    if (branchId) params.set('branchId', branchId)

    fetch(`/api/contracts/metrics?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setMetrics(json.data)
        }
      })
      .catch((err) => console.error('Failed to load metrics:', err))
      .finally(() => setLoadingMetrics(false))
  }, [branchId])

  // Tải danh sách hợp đồng
  const loadContracts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', pagination.page.toString())
    params.set('limit', pagination.limit.toString())
    if (search.trim()) params.set('search', search.trim())
    if (contractType) params.set('contractType', contractType)
    if (status) params.set('status', status)
    if (branchId) params.set('branchId', branchId)

    fetch(`/api/contracts?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setContracts(json.data.items || [])
          setPagination((prev) => ({
            ...prev,
            total: json.data.pagination?.total ?? 0,
            totalPages: json.data.pagination?.totalPages ?? 1,
          }))
        }
      })
      .catch((err) => console.error('Failed to load contracts:', err))
      .finally(() => setLoading(false))
  }, [pagination.page, pagination.limit, search, contractType, status, branchId])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  // Xử lý filter từ Metrics Cards
  const handleCardFilterStatus = (targetStatus: string | null) => {
    setStatus(targetStatus || '')
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  // Quét cảnh báo hợp đồng sắp hết hạn
  const handleCheckExpiring = async () => {
    setScanningExpiring(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/contracts/check-expiring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysThreshold: 30 }),
      })
      const json = await res.json()
      if (json.success) {
        setScanResult(
          `Hoàn tất: Đã quét & gửi cảnh báo cho ${json.data?.totalExpiring ?? 0} hợp đồng sắp hết hạn trong 30 ngày qua Webhook & Notification.`
        )
        loadMetrics()
        loadContracts()
      } else {
        setScanResult(`Lỗi: ${json.message || 'Không thể thực hiện quét'}`)
      }
    } catch (err: any) {
      setScanResult('Lỗi kết nối khi quét hợp đồng')
    } finally {
      setScanningExpiring(false)
      setTimeout(() => setScanResult(null), 8000)
    }
  }

  // Mở modal tạo mới
  const handleCreateNew = () => {
    setFormInitialData(null)
    setIsRenewalMode(false)
    setFormModalOpen(true)
  }

  // Mở modal sửa
  const handleEdit = (contract: ContractDetailData) => {
    setFormInitialData({
      id: contract.id,
      contractNumber: contract.contractNumber,
      employeeId: contract.employeeId,
      contractType: contract.contractType,
      status: contract.status,
      jobTitle: contract.jobTitle,
      signDate: contract.signDate,
      startDate: contract.startDate,
      endDate: contract.endDate,
      grossSalary: contract.grossSalary,
      insuranceSalary: contract.insuranceSalary,
      workingHoursPerWeek: contract.workingHoursPerWeek,
      signerName: contract.signerName,
      signerRole: contract.signerRole,
      notes: contract.notes,
    })
    setIsRenewalMode(false)
    setFormModalOpen(true)
  }

  // Mở modal gia hạn
  const handleRenew = (contract: ContractDetailData) => {
    setFormInitialData({
      employeeId: contract.employeeId,
      contractType:
        contract.contractType === ContractType.PROBATION
          ? ContractType.DEFINITE_TERM
          : contract.contractType,
      status: ContractStatus.ACTIVE,
      jobTitle: contract.jobTitle,
      grossSalary: contract.grossSalary,
      insuranceSalary: contract.insuranceSalary,
      workingHoursPerWeek: contract.workingHoursPerWeek,
      signerName: contract.signerName,
      signerRole: contract.signerRole,
      notes: `Gia hạn nối tiếp từ hợp đồng cũ số ${contract.contractNumber}`,
    })
    setIsRenewalMode(true)
    setFormModalOpen(true)
  }

  // Mở modal xem chi tiết
  const handleViewDetail = (contract: ContractDetailData) => {
    setSelectedContract(contract)
    setDetailModalOpen(true)
  }

  // Mở modal xem timeline nhân sự
  const handleViewTimeline = (empId: string) => {
    setSelectedEmployeeId(empId)
    setTimelineModalOpen(true)
  }

  // Thanh lý hợp đồng
  const handleTerminate = async (contract: ContractDetailData) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn thanh lý hợp đồng "${contract.contractNumber}" của nhân viên ${contract.employee?.fullName}?`
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ContractStatus.TERMINATED }),
      })
      const json = await res.json()
      if (json.success) {
        loadMetrics()
        loadContracts()
      } else {
        alert(json.message || 'Không thể thanh lý hợp đồng')
      }
    } catch (err) {
      alert('Lỗi kết nối khi thanh lý hợp đồng')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Quản lý Hợp đồng & Vòng đời Nhân sự
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Theo dõi hồ sơ pháp lý lao động, hạn hợp đồng và toàn bộ các mốc phát triển sự nghiệp
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCheckExpiring}
            disabled={scanningExpiring}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <BellRing
              className={`w-4 h-4 text-amber-500 ${scanningExpiring ? 'animate-bounce' : ''}`}
            />
            {scanningExpiring ? 'Đang quét...' : 'Quét cảnh báo hết hạn'}
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            Ký hợp đồng mới
          </button>
        </div>
      </div>

      {/* Alert Thông báo kết quả quét */}
      {scanResult && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{scanResult}</span>
          </div>
          <button
            onClick={() => setScanResult(null)}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Overview Metrics Cards */}
      <ContractMetricsCards
        metrics={metrics}
        loading={loadingMetrics}
        onFilterStatus={handleCardFilterStatus}
        activeStatusFilter={status}
      />

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              placeholder="Tìm theo số HĐ, tên hoặc mã nhân viên..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Filter Contract Type */}
          <div>
            <select
              value={contractType}
              onChange={(e) => {
                setContractType(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Tất cả loại HĐ --</option>
              {Object.entries(CONTRACT_TYPE_MAP).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Tất cả trạng thái --</option>
              {Object.entries(CONTRACT_STATUS_MAP).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Branch */}
          <div>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value)
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">-- Tất cả chi nhánh --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters indicator */}
        {(search || contractType || status || branchId) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700">
            <span>
              Đang lọc theo tiêu chí tìm kiếm.
            </span>
            <button
              onClick={() => {
                setSearch('')
                setContractType('')
                setStatus('')
                setBranchId('')
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Contracts Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Mã Hợp đồng</th>
                <th className="py-3.5 px-4">Nhân sự & Chức vụ</th>
                <th className="py-3.5 px-4">Loại hợp đồng</th>
                <th className="py-3.5 px-4">Mức lương (Gross)</th>
                <th className="py-3.5 px-4">Thời hạn hợp đồng</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36 mb-1" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-24" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                      Không tìm thấy hợp đồng nào
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Thử thay đổi bộ lọc tìm kiếm hoặc tạo hợp đồng lao động mới
                    </p>
                  </td>
                </tr>
              ) : (
                contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors"
                  >
                    {/* Số HĐ */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      <button
                        onClick={() => handleViewDetail(c)}
                        className="hover:underline text-left"
                      >
                        {c.contractNumber}
                      </button>
                    </td>

                    {/* Nhân sự & Chức vụ */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span>{c.employee?.fullName}</span>
                        <span className="text-[11px] font-mono font-normal text-slate-400">
                          ({c.employee?.employeeCode})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span>{c.jobTitle || c.employee?.position || 'Nhân viên'}</span>
                        {c.employee?.branch?.name && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">
                              {c.employee.branch.name}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Loại hợp đồng */}
                    <td className="py-3.5 px-4">
                      <ContractTypeBadge contractType={c.contractType} />
                    </td>

                    {/* Lương */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {c.grossSalary ? `${c.grossSalary.toLocaleString('vi-VN')} ₫` : '—'}
                    </td>

                    {/* Thời hạn */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 dark:text-slate-300">
                        {new Date(c.startDate).toLocaleDateString('vi-VN')} →{' '}
                        {c.endDate
                          ? new Date(c.endDate).toLocaleDateString('vi-VN')
                          : 'Vô thời hạn'}
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3.5 px-4">
                      <ContractStatusBadge
                        status={c.computedStatus || c.status}
                        daysRemaining={c.daysRemaining}
                        showDays={true}
                      />
                    </td>

                    {/* Thao tác */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetail(c)}
                          title="Xem chi tiết"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleEdit(c)}
                          title="Chỉnh sửa"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/60 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleRenew(c)}
                          title="Gia hạn / Ký tiếp"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                        >
                          <RotateCw className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleViewTimeline(c.employeeId)}
                          title="Lịch sử vòng đời"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleTerminate(c)}
                          title="Thanh lý hợp đồng"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <div>
            Hiển thị{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {contracts.length}
            </span>{' '}
            trên tổng số{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {pagination.total}
            </span>{' '}
            hợp đồng
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
              }
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
              Trang {pagination.page} / {pagination.totalPages || 1}
            </span>

            <button
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  page: Math.min(pagination.totalPages, prev.page + 1),
                }))
              }
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Form Modal (Create / Edit / Renew) */}
      <ContractFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        onSuccess={() => {
          loadMetrics()
          loadContracts()
        }}
        initialData={formInitialData}
        isRenewal={isRenewalMode}
      />

      {/* Detail Modal */}
      <ContractDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        contract={selectedContract}
        onEdit={(contract) => {
          setDetailModalOpen(false)
          handleEdit(contract)
        }}
        onRenew={(contract) => {
          setDetailModalOpen(false)
          handleRenew(contract)
        }}
        onViewTimeline={(empId) => {
          setDetailModalOpen(false)
          handleViewTimeline(empId)
        }}
      />

      {/* Lifecycle Timeline Modal */}
      <LifecycleTimelineModal
        isOpen={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        employeeId={selectedEmployeeId}
      />
    </div>
  )
}
