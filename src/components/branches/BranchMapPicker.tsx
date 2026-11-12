'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import type { BranchMapPickerProps } from './BranchMapPickerInner'

const DynamicBranchMapPicker = dynamic(
  () => import('./BranchMapPickerInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-200 animate-pulse">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-slate-500">Đang khởi tạo bản đồ Geofence...</span>
      </div>
    ),
  }
)

export default function BranchMapPicker(props: BranchMapPickerProps) {
  return <DynamicBranchMapPicker {...props} />
}
