import { prisma } from '@/lib/db'
import { AuditSeverity, AuditStatus } from '@prisma/client'
import { NextRequest } from 'next/server'

export const AuditActions = {
  // System & Organization
  SYSTEM_SETTINGS_UPDATED: 'SYSTEM_SETTINGS_UPDATED',
  SYSTEM_SETTINGS_RESET: 'SYSTEM_SETTINGS_RESET',
  COMPANY_PROFILE_UPDATED: 'COMPANY_PROFILE_UPDATED',

  // Branch & Geofence
  BRANCH_CREATED: 'BRANCH_CREATED',
  BRANCH_UPDATED: 'BRANCH_UPDATED',
  BRANCH_DELETED: 'BRANCH_DELETED',

  // Employee Lifecycle
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_DEACTIVATED: 'EMPLOYEE_DEACTIVATED',

  // Attendance & Adjustments
  ATTENDANCE_CHECK_IN: 'ATTENDANCE_CHECK_IN',
  ATTENDANCE_CHECK_OUT: 'ATTENDANCE_CHECK_OUT',
  ATTENDANCE_ADJUSTMENT_CREATED: 'ATTENDANCE_ADJUSTMENT_CREATED',
  ATTENDANCE_ADJUSTMENT_APPROVED: 'ATTENDANCE_ADJUSTMENT_APPROVED',
  ATTENDANCE_ADJUSTMENT_REJECTED: 'ATTENDANCE_ADJUSTMENT_REJECTED',

  // Shifts & Schedule Swaps
  WORK_SCHEDULE_CREATED: 'WORK_SCHEDULE_CREATED',
  WORK_SCHEDULE_UPDATED: 'WORK_SCHEDULE_UPDATED',
  WORK_SCHEDULE_DELETED: 'WORK_SCHEDULE_DELETED',
  SHIFT_SWAP_REQUESTED: 'SHIFT_SWAP_REQUESTED',
  SHIFT_SWAP_APPROVED: 'SHIFT_SWAP_APPROVED',
  SHIFT_SWAP_REJECTED: 'SHIFT_SWAP_REJECTED',

  // Leaves & Overtime
  LEAVE_REQUEST_APPROVED: 'LEAVE_REQUEST_APPROVED',
  LEAVE_REQUEST_REJECTED: 'LEAVE_REQUEST_REJECTED',
  OVERTIME_REQUEST_APPROVED: 'OVERTIME_REQUEST_APPROVED',
  OVERTIME_REQUEST_REJECTED: 'OVERTIME_REQUEST_REJECTED',

  // Gamification & Diagnostics
  GAMIFICATION_RECALCULATED: 'GAMIFICATION_RECALCULATED',
  SECURITY_LOGIN_SUCCESS: 'SECURITY_LOGIN_SUCCESS',
  SECURITY_LOGIN_FAILED: 'SECURITY_LOGIN_FAILED',
} as const

export type AuditActionType = (typeof AuditActions)[keyof typeof AuditActions] | string

export interface AuditActionMeta {
  label: string
  category: 'Cài đặt' | 'Chi nhánh' | 'Nhân sự' | 'Chấm công' | 'Ca làm việc' | 'Bảo mật' | 'Khác'
  badgeColor: string
}

export const AUDIT_ACTION_MAP: Record<string, AuditActionMeta> = {
  [AuditActions.SYSTEM_SETTINGS_UPDATED]: {
    label: 'Cập nhật cài đặt hệ thống',
    category: 'Cài đặt',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  [AuditActions.SYSTEM_SETTINGS_RESET]: {
    label: 'Khôi phục cài đặt gốc',
    category: 'Cài đặt',
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  [AuditActions.COMPANY_PROFILE_UPDATED]: {
    label: 'Cập nhật hồ sơ công ty',
    category: 'Cài đặt',
    badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  [AuditActions.BRANCH_CREATED]: {
    label: 'Tạo chi nhánh mới',
    category: 'Chi nhánh',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  [AuditActions.BRANCH_UPDATED]: {
    label: 'Cập nhật chi nhánh / Geofence',
    category: 'Chi nhánh',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
  [AuditActions.BRANCH_DELETED]: {
    label: 'Xóa chi nhánh',
    category: 'Chi nhánh',
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  [AuditActions.EMPLOYEE_CREATED]: {
    label: 'Thêm nhân viên mới',
    category: 'Nhân sự',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  [AuditActions.EMPLOYEE_UPDATED]: {
    label: 'Cập nhật thông tin nhân viên',
    category: 'Nhân sự',
    badgeColor: 'text-slate-700 bg-slate-50 border-slate-200',
  },
  [AuditActions.EMPLOYEE_DEACTIVATED]: {
    label: 'Vô hiệu hóa tài khoản nhân viên',
    category: 'Nhân sự',
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  [AuditActions.ATTENDANCE_ADJUSTMENT_APPROVED]: {
    label: 'Duyệt điều chỉnh chấm công',
    category: 'Chấm công',
    badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
  [AuditActions.ATTENDANCE_ADJUSTMENT_REJECTED]: {
    label: 'Từ chối điều chỉnh chấm công',
    category: 'Chấm công',
    badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  [AuditActions.SHIFT_SWAP_APPROVED]: {
    label: 'Phê duyệt đổi ca làm việc',
    category: 'Ca làm việc',
    badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
  [AuditActions.SHIFT_SWAP_REJECTED]: {
    label: 'Từ chối đổi ca làm việc',
    category: 'Ca làm việc',
    badgeColor: 'text-slate-700 bg-slate-50 border-slate-200',
  },
  [AuditActions.SECURITY_LOGIN_FAILED]: {
    label: 'Đăng nhập thất bại',
    category: 'Bảo mật',
    badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  [AuditActions.GAMIFICATION_RECALCULATED]: {
    label: 'Tính lại điểm chuyên cần',
    category: 'Cài đặt',
    badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
  },
}

/**
 * Tự động suy luận mức độ nghiêm trọng (Severity) dựa trên Action
 */
export function inferAuditSeverity(action: string): AuditSeverity {
  const upper = action.toUpperCase()
  if (
    upper.includes('RESET') ||
    upper.includes('DELETE') ||
    upper.includes('DEACTIVATED') ||
    upper.includes('SECURITY_LOGIN_FAILED')
  ) {
    return AuditSeverity.CRITICAL
  }

  if (
    upper.includes('UPDATE') ||
    upper.includes('REJECT') ||
    upper.includes('ADJUSTMENT') ||
    upper.includes('OVERRIDE')
  ) {
    return AuditSeverity.WARNING
  }

  if (upper.includes('SECURITY') || upper.includes('AUTH') || upper.includes('PASSWORD')) {
    return AuditSeverity.SECURITY
  }

  return AuditSeverity.INFO
}

export interface LogAuditParams {
  userId: string
  action: AuditActionType
  entity: string
  entityId: string
  oldData?: any
  newData?: any
  severity?: AuditSeverity
  status?: AuditStatus
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: any
}

/**
 * Hàm ghi log kiểm toán trung tâm với cơ chế an toàn ngoại lệ
 */
export async function logAuditEvent(params: LogAuditParams) {
  try {
    const severity = params.severity || inferAuditSeverity(params.action)
    const status = params.status || AuditStatus.SUCCESS

    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldData: params.oldData ?? null,
        newData: params.newData ?? null,
        severity,
        status,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to write audit log event:', error)
    return null
  }
}

/**
 * Trích xuất địa chỉ IP của Client từ Request
 */
export function extractClientIp(req: Request | NextRequest): string {
  if ('headers' in req) {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp.trim()
  }
  return '127.0.0.1'
}

/**
 * Trích xuất User-Agent từ Request
 */
export function extractUserAgent(req: Request | NextRequest): string {
  if ('headers' in req) {
    return req.headers.get('user-agent') || 'Unknown Client'
  }
  return 'Unknown Client'
}
