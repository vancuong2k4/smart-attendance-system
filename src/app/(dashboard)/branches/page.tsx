'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Filter,
} from 'lucide-react'
import BranchStatsCards, { BranchStatsData } from '@/components/branches/BranchStatsCards'
import BranchTable from '@/components/branches/BranchTable'
import BranchFormModal, { BranchFormData } from '@/components/branches/BranchFormModal'
import BranchDetailModal, { BranchDetailData } from '@/components/branches/BranchDetailModal'
import GeofenceSimulatorModal from '@/components/branches/GeofenceSimulatorModal'

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchDetailData[]>([])
  const [stats, setStats] = useState<BranchStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedBranchForEdit, setSelectedBranchForEdit] = useState<BranchFormData | null>(null)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedBranchForDetail, setSelectedBranchForDetail] = useState<BranchDetailData | null>(null)

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
  const [selectedBranchForSim, setSelectedBranchForSim] = useState<BranchDetailData | null>(null)

  // Delete state
  const [deletingBranch, setDeletingBranch] = useState<BranchDetailData | null>(null)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Fetch branches data
  const fetchBranches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('includeCounts', 'true')
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchTerm.trim()) params.append('search', searchTerm.trim())

      const res = await fetch(`/api/branches?${params.toString()}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.message || 'Không thể tải danh sách chi nhánh')
      }

      setBranches(json.data || [])
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, statusFilter])

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/branches/stats')
      const json = await res.json()
      if (res.ok && json.data) {
        setStats(json.data)
      }
    } catch (err) {
      console.error('Error fetching branch stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleRefreshAll = () => {
    fetchBranches()
    fetchStats()
  }

  // Handlers for modal opening
  const handleOpenCreate = () => {
    setSelectedBranchForEdit(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (branch: BranchDetailData) => {
    setSelectedBranchForEdit({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      latitude: branch.latitude,
      longitude: branch.longitude,
      gpsRadius: branch.gpsRadius,
      isActive: branch.isActive,
    })
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const handleOpenDetail = (branch: BranchDetailData) => {
    setSelectedBranchForDetail(branch)
    setIsDetailOpen(true)
  }

  const handleOpenSimulator = (branch: BranchDetailData) => {
    setSelectedBranchForSim(branch)
    setIsSimulatorOpen(true)
  }

  // Delete handler
  const confirmDelete = async () => {
    if (!deletingBranch) return
    setIsDeleteLoading(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/branches/${deletingBranch.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.message || 'Không thể xóa chi nhánh')
      }

      setDeletingBranch(null)
      handleRefreshAll()
    } catch (err: any) {
      setDeleteError(err.message || 'Lỗi khi xóa chi nhánh')
    } finally {
      setIsDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Building2 className="text-indigo-600" size={26} />
            <span>Quản lý Chi nhánh & Geofence GPS</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập danh mục cơ sở văn phòng, tọa độ GPS và bán kính vòng tròn chấm công tự động
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus size={18} />
            <span>Thêm chi nhánh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <BranchStatsCards stats={stats} loading={statsLoading} />

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã hoặc địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'active'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Đang hoạt động
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Tạm dừng
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <BranchTable
        branches={branches}
        loading={loading}
        onView={handleOpenDetail}
        onEdit={handleOpenEdit}
        onDelete={(b) => {
          setDeleteError(null)
          setDeletingBranch(b)
        }}
        onSimulate={handleOpenSimulator}
      />

      {/* Modals */}
      <BranchFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleRefreshAll}
        initialData={selectedBranchForEdit}
      />

      <BranchDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        branch={selectedBranchForDetail}
        onOpenSimulator={handleOpenSimulator}
        onEdit={handleOpenEdit}
      />

      <GeofenceSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        branch={selectedBranchForSim}
      />

      {/* Delete Confirmation Modal */}
      {deletingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800">Xác nhận xóa chi nhánh</h3>
              <p className="text-sm text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa chi nhánh{' '}
                <strong className="text-slate-700">{deletingBranch.name}</strong> (
                {deletingBranch.code})? Hành động này không thể hoàn tác.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBranch(null)}
                disabled={isDeleteLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleteLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isDeleteLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
