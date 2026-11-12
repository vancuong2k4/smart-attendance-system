'use client'

import React, { useState } from 'react'
import {
  Award,
  Lock,
  Sparkles,
  CheckCircle2,
  Users,
  X,
  Flame,
  CalendarCheck,
  Sun,
  ShieldCheck,
  Crown,
} from 'lucide-react'

export interface BadgeItem {
  type: string
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND'
  title: string
  description: string
  icon: string
  points: number
  requirementText: string
  unlockedCount: number
  unlockRatePercent: number
  isUnlockedByMe: boolean
  unlockedAt: string | null
}

interface BadgeGalleryProps {
  badges: BadgeItem[]
}

const TIER_COLORS = {
  BRONZE: {
    bg: 'from-amber-700/10 to-orange-600/10 border-amber-600/30 text-amber-800',
    badge: 'bg-amber-700 text-white',
    iconBg: 'bg-amber-100 text-amber-800',
  },
  SILVER: {
    bg: 'from-slate-400/10 to-zinc-500/10 border-slate-400/30 text-slate-800',
    badge: 'bg-slate-500 text-white',
    iconBg: 'bg-slate-100 text-slate-700',
  },
  GOLD: {
    bg: 'from-amber-400/15 to-yellow-500/15 border-amber-400/40 text-amber-900',
    badge: 'bg-amber-500 text-white',
    iconBg: 'bg-amber-100 text-amber-800',
  },
  DIAMOND: {
    bg: 'from-cyan-400/15 via-blue-500/15 to-indigo-500/15 border-cyan-400/50 text-indigo-950',
    badge: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
    iconBg: 'bg-cyan-100 text-cyan-800',
  },
}

export function BadgeGallery({ badges }: BadgeGalleryProps) {
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null)
  const [tierFilter, setTierFilter] = useState<string>('ALL')

  const filteredBadges = badges.filter((b) => {
    if (tierFilter === 'ALL') return true
    if (tierFilter === 'UNLOCKED') return b.isUnlockedByMe
    return b.tier === tierFilter
  })

  const unlockedCount = badges.filter((b) => b.isUnlockedByMe).length

  const renderBadgeIcon = (iconName: string, className = 'h-6 w-6') => {
    switch (iconName) {
      case 'Sun':
        return <Sun className={className} />
      case 'CalendarCheck':
        return <CalendarCheck className={className} />
      case 'ShieldCheck':
        return <ShieldCheck className={className} />
      case 'Flame':
        return <Flame className={className} />
      case 'Crown':
        return <Crown className={className} />
      case 'Sparkles':
        return <Sparkles className={className} />
      default:
        return <Award className={className} />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Quick Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Bộ Sưu Tập Huy Hiệu Vinh Danh
          </h3>
          <p className="text-xs text-slate-500">
            Bạn đã mở khóa <strong>{unlockedCount}</strong> / {badges.length} huy hiệu thành tích
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'UNLOCKED', 'DIAMOND', 'GOLD', 'SILVER', 'BRONZE'].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                tierFilter === t
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'ALL'
                ? 'Tất cả'
                : t === 'UNLOCKED'
                ? 'Đã mở khóa'
                : t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredBadges.map((badge) => {
          const tierStyle = TIER_COLORS[badge.tier] || TIER_COLORS.BRONZE

          return (
            <div
              key={badge.type}
              onClick={() => setSelectedBadge(badge)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer ${
                badge.isUnlockedByMe
                  ? `bg-gradient-to-br ${tierStyle.bg} hover:shadow-md hover:-translate-y-0.5`
                  : 'border-slate-200 bg-slate-50/70 opacity-75 hover:opacity-100 hover:border-slate-300'
              }`}
            >
              {/* Top Row: Tier badge & Unlock indicator */}
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${tierStyle.badge}`}
                >
                  {badge.tier}
                </span>

                {badge.isUnlockedByMe ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Đã mở
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                    <Lock className="h-3.5 w-3.5" />
                    Chưa mở
                  </span>
                )}
              </div>

              {/* Icon & Title */}
              <div className="my-4 flex flex-col items-center text-center">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-xs transition-transform group-hover:scale-110 ${
                    badge.isUnlockedByMe
                      ? tierStyle.iconBg
                      : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {renderBadgeIcon(badge.icon)}
                </div>

                <h4 className="mt-3 text-sm font-bold text-slate-900 group-hover:text-indigo-600">
                  {badge.title}
                </h4>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {badge.description}
                </p>
              </div>

              {/* Bottom Row: Stats & Points */}
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {badge.unlockRatePercent}% nhân sự
                </span>
                <span className="font-bold text-amber-600">+{badge.points} Điểm</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-3xl shadow-md ${
                  selectedBadge.isUnlockedByMe
                    ? TIER_COLORS[selectedBadge.tier].iconBg
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {renderBadgeIcon(selectedBadge.icon, 'h-10 w-10')}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                    TIER_COLORS[selectedBadge.tier].badge
                  }`}
                >
                  {selectedBadge.tier}
                </span>
                <span className="text-xs font-bold text-amber-600">
                  +{selectedBadge.points} Điểm thưởng
                </span>
              </div>

              <h3 className="mt-2 text-lg font-bold text-slate-900">
                {selectedBadge.title}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {selectedBadge.description}
              </p>

              {/* Condition box */}
              <div className="mt-4 w-full rounded-xl bg-slate-50 p-3.5 text-left border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Điều kiện đạt được:
                </span>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  {selectedBadge.requirementText}
                </p>
              </div>

              {/* Unlock info */}
              <div className="mt-4 w-full flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
                <span>Tỷ lệ đạt toàn công ty:</span>
                <strong className="text-slate-700">
                  {selectedBadge.unlockRatePercent}% ({selectedBadge.unlockedCount} người)
                </strong>
              </div>

              {selectedBadge.isUnlockedByMe && selectedBadge.unlockedAt && (
                <div className="mt-2 w-full flex items-center justify-between text-xs text-emerald-600">
                  <span>Ngày bạn mở khóa:</span>
                  <strong className="font-semibold">
                    {new Date(selectedBadge.unlockedAt).toLocaleDateString('vi-VN')}
                  </strong>
                </div>
              )}

              <button
                onClick={() => setSelectedBadge(null)}
                className="mt-6 w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
