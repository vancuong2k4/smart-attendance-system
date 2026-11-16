'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  History,
  UserCheck,
  Clock,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  FileWarning,
  LogOut,
  Building2,
  Briefcase,
  Calendar,
  User,
  ChevronRight,
} from 'lucide-react'
import { LifecycleStage } from '@prisma/client'
import { LIFECYCLE_STAGE_MAP } from '@/lib/contracts'

export interface LifecycleEventItem {
  id: string
  stage: LifecycleStage
  title: string
  description?: string | null
  eventDate: string
  metadata?: any
  createdAt: string
  createdByUser?: {
    id: string
    name?: string | null
    email: string
    role: string
  } | null
}

export interface EmployeeTimelineData {
  id: string
  fullName: string
  employeeCode: string
  position?: string | null
  joinedAt?: string | null
  branch?: { id: string; name: string } | null
  department?: { id: string; name: string } | null
}

interface LifecycleTimelineModalProps {
  isOpen: boolean
  onClose: () => void
  employeeId?: string | null
}

export function LifecycleTimelineModal({
  isOpen,
  onClose,
  employeeId,
}: LifecycleTimelineModalProps) {
  const [loading, setLoading] = useState(false)
  const [employee, setEmployee] = useState<EmployeeTimelineData | null>(null)
  const [events, setEvents] = useState<LifecycleEventItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && employeeId) {
      setLoading(true)
      setError(null)
      fetch(`/api/employees/${employeeId}/timeline`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setEmployee(json.data.employee)
            setEvents(json.data.events || [])
          } else {
            setError(json.message || 'Không thể tải dòng thời gian nhân sự')
          }
        })
        .catch((err) => {
          console.error('Failed to fetch timeline:', err)
          setError('Lỗi kết nối khi tải dòng thời gian')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, employeeId])

  if (!isOpen) return null

  const getStageIcon = (stage: LifecycleStage) => {
    switch (stage) {
      case LifecycleStage.ONBOARDING:
        return <UserCheck className="w-4 h-4 text-sky-600" />
      case LifecycleStage.PROBATION:
        return <Clock className="w-4 h-4 text-amber-600" />
      case LifecycleStage.OFFICIAL:
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />
      case LifecycleStage.PROMOTION:
        return <TrendingUp className="w-4 h-4 text-purple-600" />
      case LifecycleStage.SALARY_REVIEW:
        return <DollarSign className="w-4 h-4 text-indigo-600" />
      case LifecycleStage.RESIGNATION_SUBMITTED:
        return <FileWarning className="w-4 h-4 text-orange-600" />
      case LifecycleStage.OFFBOARDED:
        return <LogOut className="w-4 h-4 text-rose-600" />
      default:
        return <History className="w-4 h-4 text-slate-600" />
    }
  }

  const getStageBg = (stage: LifecycleStage) => {
    switch (stage) {
      case LifecycleStage.ONBOARDING:
        return 'bg-sky-100 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800'
      case LifecycleStage.PROBATION:
        return 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
      case LifecycleStage.OFFICIAL:
        return 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800'
      case LifecycleStage.PROMOTION:
        return 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800'
      case LifecycleStage.SALARY_REVIEW:
        return 'bg-indigo-100 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'
      case LifecycleStage.RESIGNATION_SUBMITTED:
        return 'bg-orange-100 dark:bg-orange-950/60 border-orange-300 dark:border-orange-800'
      case LifecycleStage.OFFBOARDED:
        return 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Dòng thời gian Vòng đời Nhân sự
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Toàn bộ các mốc phát triển nghề nghiệp, bổ nhiệm, lương và hợp đồng
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
          {/* Thông tin tóm tắt nhân sự */}
          {employee && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-sm border border-purple-200 dark:border-purple-800">
                  {employee.fullName ? employee.fullName.split(' ').slice(-1)[0][0] : 'NV'}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {employee.fullName}
                    <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                      ({employee.employeeCode})
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {employee.position || 'Chưa phân chức danh'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {employee.branch?.name || 'Toàn công ty'}
                    </span>
                  </div>
                </div>
              </div>

              {employee.joinedAt && (
                <div className="text-right text-xs text-slate-500">
                  <div className="text-[11px] text-slate-400">Gia nhập ngày</div>
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(employee.joinedAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs text-slate-500">Đang tải lịch sử vòng đời...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && events.length === 0 && (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <History className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chưa có sự kiện vòng đời nào
              </div>
              <div className="text-xs text-slate-400 max-w-sm mx-auto">
                Khi ký hợp đồng mới, bổ nhiệm chức vụ hoặc điều chỉnh mức lương, hệ thống sẽ tự động ghi nhận các mốc lịch sử tại đây.
              </div>
            </div>
          )}

          {/* Timeline List */}
          {!loading && events.length > 0 && (
            <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {events.map((evt, idx) => {
                const stageMeta = LIFECYCLE_STAGE_MAP[evt.stage] || {
                  label: evt.stage,
                  color: 'text-slate-700 bg-slate-50 border-slate-200',
                }

                return (
                  <div key={evt.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-6 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${getStageBg(
                        evt.stage
                      )}`}
                    >
                      {getStageIcon(evt.stage)}
                    </div>

                    {/* Timeline Content Card */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${stageMeta.color}`}
                          >
                            {stageMeta.label}
                          </span>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {evt.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono text-slate-400 shrink-0 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(evt.eventDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>

                      {evt.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {evt.description}
                        </p>
                      )}

                      {/* Metadata Chips if present */}
                      {evt.metadata && typeof evt.metadata === 'object' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-[11px]">
                          {evt.metadata.contractNumber && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono">
                              HĐ: {evt.metadata.contractNumber}
                            </span>
                          )}
                          {evt.metadata.grossSalary && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
                              Lương: {Number(evt.metadata.grossSalary).toLocaleString('vi-VN')} ₫
                            </span>
                          )}
                          {evt.metadata.jobTitle && (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Vị trí: {evt.metadata.jobTitle}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Initiator User */}
                      {evt.createdByUser && (
                        <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>Ghi nhận bởi: {evt.createdByUser.name || evt.createdByUser.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
          <div className="text-xs text-slate-500">
            Tổng cộng <span className="font-semibold text-slate-700 dark:text-slate-300">{events.length}</span> mốc sự kiện
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
export default LifecycleTimelineModal
