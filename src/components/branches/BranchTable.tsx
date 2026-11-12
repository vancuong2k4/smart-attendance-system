'use client'

import React from 'react'
import {
  Building2,
  MapPin,
  Users,
  Compass,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { BranchDetailData } from './BranchDetailModal'

interface BranchTableProps {
  branches: BranchDetailData[]
  loading?: boolean
  onView: (branch: BranchDetailData) => void
  onEdit: (branch: BranchDetailData) => void
  onDelete: (branch: BranchDetailData) => void
  onSimulate: (branch: BranchDetailData) => void
  isSuperAdmin?: boolean
}

export default function BranchTable({
  branches,
  loading,
  onView,
  onEdit,
  onDelete,
  onSimulate,
  isSuperAdmin = true,
}: BranchTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-4">
          <Building2 size={32} />
        </div>
        <h3 className="text-base font-bold text-slate-800">Không tìm thấy chi nhánh nào</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Chưa có chi nhánh nào phù hợp với bộ lọc hiện tại hoặc hệ thống chưa được thiết lập dữ liệu.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4">Chi nhánh</th>
              <th className="py-3.5 px-4">Địa chỉ & Liên hệ</th>
              <th className="py-3.5 px-4">Tọa độ GPS & Bán kính</th>
              <th className="py-3.5 px-4 text-center">Quy mô</th>
              <th className="py-3.5 px-4 text-center">Trạng thái</th>
              <th className="py-3.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {branches.map((b) => {
              const empCount = b._count?.employees ?? 0
              const deptCount = b._count?.departments ?? b.departments?.length ?? 0

              return (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors group">
                  {/* Name & Code */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onView(b)}>
                          {b.name}
                        </div>
                        <div className="font-mono text-xs text-slate-400 font-medium">
                          {b.code}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Address & Phone */}
                  <td className="py-3.5 px-4 max-w-[240px]">
                    <div className="text-xs text-slate-600 truncate" title={b.address || ''}>
                      {b.address || <span className="text-slate-400 italic">Chưa có địa chỉ</span>}
                    </div>
                    {b.phone && (
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{b.phone}</div>
                    )}
                  </td>

                  {/* GPS & Geofence Radius */}
                  <td className="py-3.5 px-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-xs font-mono text-slate-700 border border-slate-200">
                      <MapPin size={12} className="text-indigo-500 shrink-0" />
                      <span>
                        {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-600 font-medium mt-1">
                      Bán kính: <span className="font-bold">{b.gpsRadius} mét</span>
                    </div>
                  </td>

                  {/* Employee & Dept Counts */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                      <span className="flex items-center gap-1" title="Số nhân sự">
                        <Users size={13} className="text-slate-400" />
                        <strong>{empCount}</strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500" title="Số phòng ban">
                        {deptCount} PB
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    {b.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle size={12} /> Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <XCircle size={12} /> Tạm dừng
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onView(b)}
                        title="Xem chi tiết"
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onSimulate(b)}
                        title="Thử nghiệm GPS Geofence"
                        className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                      >
                        <Compass size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(b)}
                        title="Chỉnh sửa chi nhánh"
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => onDelete(b)}
                          title="Xóa chi nhánh"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
