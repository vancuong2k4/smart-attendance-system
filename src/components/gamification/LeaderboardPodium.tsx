'use client'

import React from 'react'
import { Crown, Flame, Trophy, Award, Sparkles } from 'lucide-react'

export interface PodiumItem {
  rank: number
  employeeId: string
  fullName: string
  employeeCode: string
  avatarUrl?: string | null
  position?: string | null
  branchName?: string
  departmentName?: string
  punctualityScore: number
  currentStreak: number
  longestStreak: number
  badges: Array<{
    id: string
    title: string
    icon: string
    tier: string
  }>
}

interface LeaderboardPodiumProps {
  podium: PodiumItem[]
}

export function LeaderboardPodium({ podium }: LeaderboardPodiumProps) {
  if (!podium || podium.length === 0) {
    return null
  }

  // Sắp xếp theo thứ tự hiển thị bục: [Hạng 2, Hạng 1, Hạng 3]
  const rank1 = podium.find((p) => p.rank === 1)
  const rank2 = podium.find((p) => p.rank === 2)
  const rank3 = podium.find((p) => p.rank === 3)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-slate-100 p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Trophy className="h-5 w-5 text-amber-500" />
            Bục Vinh Danh Top 3 Chuyên Cần
          </h3>
          <p className="text-xs text-slate-500">
            Những gương mặt tiêu biểu dẫn đầu về kỷ luật và sự đúng giờ trong tháng
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-end sm:gap-6 pt-6 pb-2">
        {/* Hạng 2 (Silver) */}
        {rank2 && (
          <div className="order-2 sm:order-1 flex w-full max-w-[220px] flex-col items-center">
            {/* Avatar & Badges */}
            <div className="relative mb-2 flex flex-col items-center">
              <div className="relative">
                {rank2.avatarUrl ? (
                  <img
                    src={rank2.avatarUrl}
                    alt={rank2.fullName}
                    className="h-16 w-16 rounded-full border-4 border-slate-300 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-300 bg-slate-200 font-bold text-slate-700">
                    {rank2.fullName.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-black text-white shadow">
                  #2 BẠC
                </div>
              </div>
              <span className="mt-3 font-bold text-slate-800 text-sm text-center line-clamp-1">
                {rank2.fullName}
              </span>
              <span className="text-[11px] text-slate-500 line-clamp-1">
                {rank2.departmentName || rank2.branchName}
              </span>
            </div>

            {/* Podium Pillar */}
            <div className="flex h-36 w-full flex-col items-center justify-between rounded-t-2xl border-t-4 border-slate-400 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 p-3 shadow-inner">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-slate-700">
                  {rank2.punctualityScore.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase font-semibold text-slate-500">
                  Điểm chuyên cần
                </span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-amber-600 shadow-xs">
                <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {rank2.currentStreak} ngày
              </div>
            </div>
          </div>
        )}

        {/* Hạng 1 (Gold - Ở giữa, cao nhất) */}
        {rank1 && (
          <div className="order-1 sm:order-2 flex w-full max-w-[240px] flex-col items-center -mt-6">
            <div className="relative mb-2 flex flex-col items-center">
              {/* Crown Animation */}
              <Crown className="h-8 w-8 text-amber-500 drop-shadow-md animate-bounce mb-1" />
              <div className="relative">
                {rank1.avatarUrl ? (
                  <img
                    src={rank1.avatarUrl}
                    alt={rank1.fullName}
                    className="h-20 w-20 rounded-full border-4 border-amber-400 ring-4 ring-amber-200/50 object-cover shadow-xl"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-400 ring-4 ring-amber-200/50 bg-amber-100 text-xl font-black text-amber-800">
                    {rank1.fullName.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-0.5 text-[11px] font-black text-amber-950 shadow-md">
                  #1 VÀNG
                </div>
              </div>
              <span className="mt-3 font-extrabold text-slate-900 text-base text-center line-clamp-1">
                {rank1.fullName}
              </span>
              <span className="text-xs font-medium text-amber-700 line-clamp-1">
                {rank1.departmentName || rank1.branchName}
              </span>
            </div>

            {/* Podium Pillar - Highest */}
            <div className="flex h-48 w-full flex-col items-center justify-between rounded-t-2xl border-t-4 border-amber-500 bg-gradient-to-b from-amber-200 via-amber-100 to-amber-200 p-4 shadow-md">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-amber-950">
                  {rank1.punctualityScore.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase font-bold text-amber-800">
                  Điểm chuyên cần
                </span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-orange-600 shadow-sm border border-amber-200">
                <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                Streak: {rank1.currentStreak} ngày
              </div>
            </div>
          </div>
        )}

        {/* Hạng 3 (Bronze) */}
        {rank3 && (
          <div className="order-3 sm:order-3 flex w-full max-w-[220px] flex-col items-center">
            <div className="relative mb-2 flex flex-col items-center">
              <div className="relative">
                {rank3.avatarUrl ? (
                  <img
                    src={rank3.avatarUrl}
                    alt={rank3.fullName}
                    className="h-16 w-16 rounded-full border-4 border-amber-700/40 object-cover shadow-md"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-amber-700/40 bg-orange-100 font-bold text-orange-800">
                    {rank3.fullName.charAt(0)}
                  </div>
                )}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-800 px-2 py-0.5 text-[10px] font-black text-amber-100 shadow">
                  #3 ĐỒNG
                </div>
              </div>
              <span className="mt-3 font-bold text-slate-800 text-sm text-center line-clamp-1">
                {rank3.fullName}
              </span>
              <span className="text-[11px] text-slate-500 line-clamp-1">
                {rank3.departmentName || rank3.branchName}
              </span>
            </div>

            {/* Podium Pillar */}
            <div className="flex h-28 w-full flex-col items-center justify-between rounded-t-2xl border-t-4 border-amber-700 bg-gradient-to-b from-orange-200 via-orange-100 to-orange-200 p-3 shadow-inner">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-amber-950">
                  {rank3.punctualityScore.toFixed(1)}
                </span>
                <span className="text-[10px] uppercase font-semibold text-amber-800">
                  Điểm chuyên cần
                </span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-amber-700 shadow-xs">
                <Flame className="h-3.5 w-3.5 fill-amber-600 text-amber-600" />
                {rank3.currentStreak} ngày
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
