'use client'

import React from 'react'
import {
  Flame,
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface NextMilestone {
  badge: {
    title: string
    description: string
    icon: string
    points: number
  }
  current: number
  target: number
  progressPercent: number
}

interface PersonalStatsProps {
  stats: {
    currentStreak: number
    longestStreak: number
    punctualityScore: number
    totalOnTime: number
    totalLate: number
    totalEarlyLeave: number
    rank: number | null
    branchRank: number | null
    totalEmployees: number
    totalBranchEmployees?: number
  }
  nextMilestone: NextMilestone | null
  employeeName?: string
  avatarUrl?: string | null
}

export function PersonalStreakCard({
  stats,
  nextMilestone,
  employeeName,
  avatarUrl,
}: PersonalStatsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-emerald-600 bg-emerald-50 border-emerald-200'
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-rose-600 bg-rose-50 border-rose-200'
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 p-6 text-white shadow-xl">
      {/* Background glowing decorations */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left Side: Avatar, Streak & Rank */}
        <div className="flex flex-1 items-start gap-5">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={employeeName || 'Avatar'}
                className="h-16 w-16 rounded-2xl border-2 border-white/20 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/20 bg-white/10 text-xl font-bold uppercase backdrop-blur-sm">
                {employeeName ? employeeName.charAt(0) : 'U'}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-indigo-900 bg-amber-400 text-xs font-black text-amber-950 shadow">
              🔥
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Chuỗi đúng giờ hiện tại
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                <Sparkles className="h-3 w-3" />
                Kỷ lục: {stats.longestStreak} ngày
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-white drop-shadow-sm">
                {stats.currentStreak}
              </span>
              <span className="text-lg font-bold text-amber-300">ngày liên tiếp</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {stats.rank ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur-sm border border-amber-300/30">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  Hạng #{stats.rank} / {stats.totalEmployees} toàn công ty
                </span>
              ) : (
                <span className="text-xs text-indigo-300">Chưa xếp hạng</span>
              )}

              {stats.branchRank && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-indigo-200 backdrop-blur-sm">
                  <Award className="h-3.5 w-3.5 text-indigo-300" />
                  Hạng #{stats.branchRank} tại Chi nhánh
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Punctuality Score & Key Metrics */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t border-white/10 pt-4 lg:border-t-0 lg:border-l lg:border-white/10 lg:pl-6 lg:pt-0">
          {/* Punctuality Score Circle Badge */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-4 text-center backdrop-blur-md border border-white/10 min-w-[120px]">
            <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-200">
              Điểm Chuyên Cần
            </span>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-3xl font-extrabold text-white">
                {stats.punctualityScore.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-indigo-300">/100</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {stats.punctualityScore >= 90 ? 'Xuất sắc' : stats.punctualityScore >= 80 ? 'Tốt' : 'Cần cải thiện'}
            </div>
          </div>

          {/* Quick Metrics Breakdown */}
          <div className="grid grid-cols-3 gap-2 min-w-[200px]">
            <div className="flex flex-col items-center rounded-xl bg-white/5 p-2 text-center border border-white/5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-0.5" />
              <span className="text-xs font-bold text-white">{stats.totalOnTime}</span>
              <span className="text-[10px] text-indigo-300">Đúng giờ</span>
            </div>

            <div className="flex flex-col items-center rounded-xl bg-white/5 p-2 text-center border border-white/5">
              <Clock className="h-4 w-4 text-amber-400 mb-0.5" />
              <span className="text-xs font-bold text-white">{stats.totalLate}</span>
              <span className="text-[10px] text-indigo-300">Đi muộn</span>
            </div>

            <div className="flex flex-col items-center rounded-xl bg-white/5 p-2 text-center border border-white/5">
              <AlertCircle className="h-4 w-4 text-rose-400 mb-0.5" />
              <span className="text-xs font-bold text-white">{stats.totalEarlyLeave}</span>
              <span className="text-[10px] text-indigo-300">Về sớm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Next Milestone Progress Bar */}
      {nextMilestone && (
        <div className="relative mt-5 rounded-xl bg-white/10 p-3.5 backdrop-blur-md border border-white/10">
          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-300" />
              <span className="text-indigo-100">
                Mục tiêu tiếp theo: <strong className="text-white">{nextMilestone.badge.title}</strong>
              </span>
            </div>
            <span className="font-bold text-amber-300">
              {nextMilestone.current} / {nextMilestone.target} ngày ({nextMilestone.progressPercent}%)
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, nextMilestone.progressPercent)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
