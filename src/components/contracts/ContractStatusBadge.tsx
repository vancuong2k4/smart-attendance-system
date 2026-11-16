'use client'

import React from 'react'
import { ContractStatus, ContractType } from '@prisma/client'
import { CONTRACT_STATUS_MAP, CONTRACT_TYPE_MAP } from '@/lib/contracts'
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  FileText,
  Ban,
  ShieldCheck,
} from 'lucide-react'

interface ContractStatusBadgeProps {
  status: ContractStatus
  contractType?: ContractType
  daysRemaining?: number | null
  showDays?: boolean
  className?: string
}

export function ContractStatusBadge({
  status,
  daysRemaining,
  showDays = false,
  className = '',
}: ContractStatusBadgeProps) {
  const meta = CONTRACT_STATUS_MAP[status] || {
    label: status,
    color: 'text-slate-600 bg-slate-100 border-slate-200',
  }

  const getStatusIcon = (st: ContractStatus) => {
    switch (st) {
      case ContractStatus.ACTIVE:
        return <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
      case ContractStatus.EXPIRING_SOON:
        return <AlertTriangle className="w-3.5 h-3.5 mr-1 animate-pulse" />
      case ContractStatus.EXPIRED:
        return <XCircle className="w-3.5 h-3.5 mr-1" />
      case ContractStatus.TERMINATED:
        return <Ban className="w-3.5 h-3.5 mr-1" />
      case ContractStatus.DRAFT:
      default:
        return <FileText className="w-3.5 h-3.5 mr-1" />
    }
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.color}`}
      >
        {getStatusIcon(status)}
        {meta.label}
      </span>

      {showDays && daysRemaining !== undefined && daysRemaining !== null && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
            daysRemaining < 0
              ? 'bg-rose-100 text-rose-800'
              : daysRemaining <= 15
                ? 'bg-amber-100 text-amber-800 font-bold'
                : daysRemaining <= 30
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
          }`}
        >
          <Clock className="w-3 h-3 mr-1" />
          {daysRemaining < 0
            ? `Quá ${Math.abs(daysRemaining)} ngày`
            : daysRemaining === 0
              ? 'Hết hạn hôm nay'
              : `Còn ${daysRemaining} ngày`}
        </span>
      )}
    </div>
  )
}

export function ContractTypeBadge({
  contractType,
  className = '',
}: {
  contractType: ContractType
  className?: string
}) {
  const meta = CONTRACT_TYPE_MAP[contractType] || {
    label: contractType,
    color: 'text-slate-700 bg-slate-50 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.color} ${className}`}
    >
      <ShieldCheck className="w-3 h-3 mr-1 opacity-70" />
      {meta.label}
    </span>
  )
}
