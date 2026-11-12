'use client'

import React from 'react'
import {
  X,
  Building2,
  MapPin,
  Phone,
  Users,
  Layers,
  Calendar,
  Compass,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import BranchMapPicker from './BranchMapPicker'

export interface BranchDetailData {
  id: string
  name: string
  code: string
  address?: string | null
  phone?: string | null
  latitude: number
  longitude: number
  gpsRadius: number
  isActive: boolean
  createdAt: string | Date
  company?: {
    id: string
    name: string
    code: string
  } | null
  departments?: Array<{
    id: string
    name: string
    code?: string | null
    _count?: {
      employees: number
    }
  }>
  schedules?: Array<{
    id: string
    name: string
    startTime: string
    endTime: string
    isDefault: boolean
    isActive: boolean
  }>
  _count?: {
    employees: number
    departments: number
    schedules: number
  }
}

interface BranchDetailModalProps {
  isOpen: boolean
  onClose: () => void
  branch: BranchDetailData | null
  onOpenSimulator?: (branch: BranchDetailData) => void
  onEdit?: (branch: BranchDetailData) => void
}

export default function BranchDetailModal({
  isOpen,
  onClose,
  branch,
  onOpenSimulator,
  onEdit,
}: BranchDetailModalProps) {
  if (!isOpen || !branch) return null

  const employeeCount = branch._count?.employees ?? 0
  const departmentCount = branch._count?.departments ?? branch.departments?.length ?? 0
  const scheduleCount = branch._count?.schedules ?? branch.schedules?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">{branch.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {branch.code}
                </span>
                {branch.isActive ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                    <CheckCircle size={12} /> Hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium border border-slate-200">
                    <XCircle size={12} /> Tạm dừng
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {branch.company?.name ? `Trực thuộc: ${branch.company.name}` : 'Thông tin chi tiết chi nhánh'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Users size={18} />
              </div>
              <div>
                <div className="text-xs text-indigo-700 font-medium">Nhân sự liên kết</div>
                <div className="text-xl font-bold text-slate-800">{employeeCount}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-violet-50/60 border border-violet-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <div className="text-xs text-violet-700 font-medium">Phòng ban</div>
                <div className="text-xl font-bold text-slate-800">{departmentCount}</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <div className="text-xs text-amber-700 font-medium">Ca làm việc</div>
                <div className="text-xl font-bold text-slate-800">{scheduleCount}</div>
              </div>
            </div>
          </div>

          {/* Address & Contact Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2.5 text-slate-700">
              <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <span>{branch.address || 'Chưa cập nhật địa chỉ'}</span>
            </div>
            {branch.phone && (
              <div className="flex items-center gap-2.5 text-slate-700">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span>{branch.phone}</span>
              </div>
            )}
          </div>

          {/* Visual Geofence Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-600" />
                <span>Vùng Geofence Chấm Công (Bán kính {branch.gpsRadius}m)</span>
              </div>

              {onOpenSimulator && (
                <button
                  type="button"
                  onClick={() => onOpenSimulator(branch)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg border border-indigo-200 transition-colors"
                >
                  <Compass size={14} />
                  <span>Mở bộ giả lập GPS</span>
                </button>
              )}
            </div>

            <BranchMapPicker
              latitude={branch.latitude}
              longitude={branch.longitude}
              radius={branch.gpsRadius}
              readOnly={true}
              branchName={branch.name}
            />
          </div>

          {/* Departments list */}
          {branch.departments && branch.departments.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Các phòng ban trực thuộc
              </div>
              <div className="flex flex-wrap gap-2">
                {branch.departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2 font-medium"
                  >
                    <span>{dept.name}</span>
                    {dept._count?.employees !== undefined && (
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                        {dept._count.employees} nhân sự
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Tạo ngày: {new Date(branch.createdAt).toLocaleDateString('vi-VN')}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(branch)}
                className="px-4 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
              >
                Chỉnh sửa
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
