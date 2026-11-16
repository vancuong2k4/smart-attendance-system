'use client'

import React from 'react'
import {
  X,
  FileText,
  User,
  Calendar,
  DollarSign,
  Clock,
  ShieldCheck,
  Building2,
  Briefcase,
  AlertTriangle,
  RotateCw,
  Edit,
  Ban,
  FileCheck,
} from 'lucide-react'
import { ContractStatusBadge, ContractTypeBadge } from './ContractStatusBadge'
import { ContractStatus, ContractType } from '@prisma/client'

export interface ContractDetailData {
  id: string
  contractNumber: string
  employeeId: string
  contractType: ContractType
  status: ContractStatus
  computedStatus?: ContractStatus
  jobTitle: string
  signDate: string
  startDate: string
  endDate?: string | null
  daysRemaining?: number | null
  grossSalary: number
  insuranceSalary: number
  workingHoursPerWeek: number
  signerName?: string | null
  signerRole?: string | null
  fileUrl?: string | null
  notes?: string | null
  createdAt: string
  employee: {
    id: string
    fullName: string
    employeeCode: string
    avatarUrl?: string | null
    position?: string | null
    branch?: { id: string; name: string } | null
    department?: { id: string; name: string } | null
  }
}

interface ContractDetailModalProps {
  isOpen: boolean
  onClose: () => void
  contract?: ContractDetailData | null
  onEdit?: (contract: ContractDetailData) => void
  onRenew?: (contract: ContractDetailData) => void
  onViewTimeline?: (employeeId: string) => void
}

export function ContractDetailModal({
  isOpen,
  onClose,
  contract,
  onEdit,
  onRenew,
  onViewTimeline,
}: ContractDetailModalProps) {
  if (!isOpen || !contract) return null

  const days = contract.daysRemaining
  const isExpiringSoon = days !== null && days !== undefined && days >= 0 && days <= 30
  const isExpired = days !== null && days !== undefined && days < 0

  // Tính % tiến độ thời hạn hợp đồng (nếu có endDate)
  let timeProgress = 0
  if (contract.startDate && contract.endDate) {
    const start = new Date(contract.startDate).getTime()
    const end = new Date(contract.endDate).getTime()
    const now = new Date().getTime()
    if (end > start) {
      timeProgress = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {contract.contractNumber}
                </h2>
                <ContractTypeBadge contractType={contract.contractType} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Khởi tạo ngày {new Date(contract.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Banner Cảnh báo nếu sắp hoặc đã hết hạn */}
          {isExpiringSoon && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Hợp đồng sắp hết hạn!</div>
                  <div className="text-xs">
                    Còn {days} ngày nữa hợp đồng sẽ chấm dứt hiệu lực ({new Date(contract.endDate!).toLocaleDateString('vi-VN')}).
                  </div>
                </div>
              </div>
              {onRenew && (
                <button
                  onClick={() => onRenew(contract)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm transition-all"
                >
                  Gia hạn ngay
                </button>
              )}
            </div>
          )}

          {isExpired && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-rose-800 dark:text-rose-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Hợp đồng đã quá hạn!</div>
                  <div className="text-xs">
                    Đã hết hạn vào ngày {new Date(contract.endDate!).toLocaleDateString('vi-VN')}. Vui lòng tái ký hoặc hoàn tất thủ tục thanh lý.
                  </div>
                </div>
              </div>
              {onRenew && (
                <button
                  onClick={() => onRenew(contract)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shrink-0 shadow-sm transition-all"
                >
                  Ký tiếp
                </button>
              )}
            </div>
          )}

          {/* Nhân sự liên quan */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-200 dark:border-indigo-800">
                {contract.employee?.fullName
                  ? contract.employee.fullName.split(' ').slice(-1)[0][0]
                  : 'NV'}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {contract.employee?.fullName}
                  <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                    ({contract.employee?.employeeCode})
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {contract.jobTitle || contract.employee?.position || 'Chưa phân chức danh'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {contract.employee?.branch?.name || 'Toàn công ty'}
                  </span>
                </div>
              </div>
            </div>

            {onViewTimeline && (
              <button
                onClick={() => onViewTimeline(contract.employeeId)}
                className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors"
              >
                Lịch sử vòng đời
              </button>
            )}
          </div>

          {/* Tiến độ thời hạn (nếu có hạn) */}
          {contract.endDate && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Tiến độ hợp đồng</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {timeProgress}% ({days !== null && days !== undefined ? (days >= 0 ? `Còn ${days} ngày` : `Quá ${Math.abs(days)} ngày`) : ''})
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    timeProgress >= 100
                      ? 'bg-rose-500'
                      : timeProgress >= 85
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.min(100, timeProgress)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Bắt đầu: {new Date(contract.startDate).toLocaleDateString('vi-VN')}</span>
                <span>Hết hạn: {new Date(contract.endDate).toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          )}

          {/* Chi tiết điều khoản */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Chế độ Lương & Đãi ngộ
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Lương Gross:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                    {contract.grossSalary.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Lương BHXH:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                    {contract.insuranceSalary.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Giờ làm việc:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {contract.workingHoursPerWeek} giờ / tuần
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Thời hạn & Hiệu lực
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Trạng thái:</span>
                  <ContractStatusBadge
                    status={contract.computedStatus || contract.status}
                    daysRemaining={contract.daysRemaining}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Ngày ký kết:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {new Date(contract.signDate).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs">Đại diện ký:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[130px]">
                    {contract.signerName || 'Ban Giám Đốc'} ({contract.signerRole || 'Đại diện'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Ghi chú điều khoản */}
          {contract.notes && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Điều khoản bổ sung & Ghi chú
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {contract.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
          <div className="text-xs text-slate-400">
            ID: <span className="font-mono">{contract.id.substring(0, 8)}...</span>
          </div>

          <div className="flex items-center gap-2">
            {onRenew && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onRenew(contract)
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-200 dark:border-emerald-800"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Gia hạn / Ký tiếp
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onEdit(contract)
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300 dark:border-slate-700 shadow-sm"
              >
                <Edit className="w-3.5 h-3.5" />
                Chỉnh sửa
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default ContractDetailModal
