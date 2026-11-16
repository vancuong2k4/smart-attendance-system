import { prisma } from '@/lib/db'
import { ContractType, ContractStatus, LifecycleStage } from '@prisma/client'

export interface ContractTypeMeta {
  label: string
  color: string
}

export const CONTRACT_TYPE_MAP: Record<ContractType, ContractTypeMeta> = {
  [ContractType.PROBATION]: {
    label: 'Thử việc',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  [ContractType.DEFINITE_TERM]: {
    label: 'Xác định thời hạn',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  [ContractType.INDEFINITE_TERM]: {
    label: 'Không xác định thời hạn',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  [ContractType.SEASONAL]: {
    label: 'Thời vụ',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
  },
  [ContractType.INTERNSHIP]: {
    label: 'Thực tập sinh',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
  },
  [ContractType.COLLABORATOR]: {
    label: 'Cộng tác viên',
    color: 'text-slate-700 bg-slate-50 border-slate-200',
  },
}

export interface ContractStatusMeta {
  label: string
  color: string
}

export const CONTRACT_STATUS_MAP: Record<ContractStatus, ContractStatusMeta> = {
  [ContractStatus.DRAFT]: {
    label: 'Bản nháp',
    color: 'text-slate-600 bg-slate-100 border-slate-200',
  },
  [ContractStatus.ACTIVE]: {
    label: 'Đang hiệu lực',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  [ContractStatus.EXPIRING_SOON]: {
    label: 'Sắp hết hạn',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  [ContractStatus.EXPIRED]: {
    label: 'Đã hết hạn',
    color: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  [ContractStatus.TERMINATED]: {
    label: 'Đã thanh lý',
    color: 'text-slate-500 bg-slate-100 border-slate-200',
  },
}

export interface LifecycleStageMeta {
  label: string
  icon: string
  color: string
}

export const LIFECYCLE_STAGE_MAP: Record<LifecycleStage, LifecycleStageMeta> = {
  [LifecycleStage.ONBOARDING]: {
    label: 'Tiếp nhận & Hội nhập',
    icon: 'UserCheck',
    color: 'text-sky-600 bg-sky-50 border-sky-200',
  },
  [LifecycleStage.PROBATION]: {
    label: 'Thử việc',
    icon: 'Clock',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  [LifecycleStage.OFFICIAL]: {
    label: 'Chính thức',
    icon: 'Award',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  [LifecycleStage.PROMOTION]: {
    label: 'Thăng chức / Điều chuyển',
    icon: 'TrendingUp',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
  [LifecycleStage.RESIGNATION_NOTICE]: {
    label: 'Báo trước nghỉ việc',
    icon: 'AlertTriangle',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
  },
  [LifecycleStage.OFFBOARDED]: {
    label: 'Đã nghỉ việc',
    icon: 'UserX',
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
}

/**
 * Tính số ngày còn lại đến khi hợp đồng hết hạn
 * Trả về null nếu là hợp đồng vô thời hạn
 */
export function calculateDaysRemaining(
  endDate: Date | string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!endDate) return null

  const target = new Date(endDate)
  target.setHours(23, 59, 59, 999)

  const current = new Date(referenceDate)
  current.setHours(0, 0, 0, 0)

  const diffTime = target.getTime() - current.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Tự động cập nhật / xác định trạng thái thực tế của hợp đồng theo thời gian
 */
export function computeContractStatus(
  currentStatus: ContractStatus,
  endDate: Date | string | null | undefined,
  referenceDate: Date = new Date()
): ContractStatus {
  // Nếu đã thanh lý hoặc bản nháp thì giữ nguyên
  if (currentStatus === ContractStatus.TERMINATED || currentStatus === ContractStatus.DRAFT) {
    return currentStatus
  }

  // Hợp đồng không thời hạn
  if (!endDate) {
    return ContractStatus.ACTIVE
  }

  const days = calculateDaysRemaining(endDate, referenceDate)
  if (days === null) return ContractStatus.ACTIVE

  if (days < 0) {
    return ContractStatus.EXPIRED
  }

  if (days <= 30) {
    return ContractStatus.EXPIRING_SOON
  }

  return ContractStatus.ACTIVE
}

export type ExpirationUrgency = 'CRITICAL' | 'WARNING' | 'NORMAL' | 'INDEFINITE'

/**
 * Xác định mức độ khẩn cấp sắp hết hạn để tô màu trên giao diện
 */
export function getExpirationUrgency(daysRemaining: number | null): ExpirationUrgency {
  if (daysRemaining === null) return 'INDEFINITE'
  if (daysRemaining <= 15) return 'CRITICAL'
  if (daysRemaining <= 30) return 'WARNING'
  return 'NORMAL'
}

export interface RecordLifecycleEventParams {
  employeeId: string
  stage: LifecycleStage
  title: string
  description?: string | null
  eventDate?: Date
  metadata?: any
  createdById?: string | null
}

/**
 * Ghi lại sự kiện mốc thời gian vòng đời nhân sự
 */
export async function recordLifecycleEvent(params: RecordLifecycleEventParams) {
  try {
    if (!prisma?.lifecycleEvent?.create) return null

    return await prisma.lifecycleEvent.create({
      data: {
        employeeId: params.employeeId,
        stage: params.stage,
        title: params.title,
        description: params.description ?? null,
        eventDate: params.eventDate || new Date(),
        metadata: params.metadata ?? null,
        createdById: params.createdById ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to record lifecycle event:', error)
    return null
  }
}
