'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import type { BranchMapInfo, UserLocationInfo } from './AttendanceMapInner'

interface AttendanceMapProps {
  branch: BranchMapInfo
  userLocation: UserLocationInfo | null
  isWithinGeofence: boolean
  distance: number | null
}

const DynamicAttendanceMap = dynamic(
  () => import('./AttendanceMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[340px] rounded-xl bg-gray-100 flex flex-col items-center justify-center text-gray-400 gap-2 border border-gray-200">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Đang tải bản đồ định vị GPS...</span>
      </div>
    ),
  }
)

export default function AttendanceMap(props: AttendanceMapProps) {
  return <DynamicAttendanceMap {...props} />
}
