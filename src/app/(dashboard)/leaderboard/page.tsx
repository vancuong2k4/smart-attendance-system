'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  RefreshCw,
  Filter,
  Calendar,
  Building2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { PersonalStreakCard } from '@/components/gamification/PersonalStreakCard'
import { LeaderboardPodium, PodiumItem } from '@/components/gamification/LeaderboardPodium'
import { LeaderboardTable, RankingRow } from '@/components/gamification/LeaderboardTable'
import { BadgeGallery, BadgeItem } from '@/components/gamification/BadgeGallery'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'BADGES'>('LEADERBOARD')
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const now = new Date()
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [year, setYear] = useState<number>(now.getFullYear())
  const [branchId, setBranchId] = useState<string>('all')
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])

  // State data
  const [myStatsData, setMyStatsData] = useState<any>(null)
  const [leaderboardData, setLeaderboardData] = useState<{
    podium: PodiumItem[]
    rankings: RankingRow[]
    myRank: any
  }>({
    podium: [],
    rankings: [],
    myRank: null,
  })
  const [badgesData, setBadgesData] = useState<BadgeItem[]>([])

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Fetch branches
  useEffect(() => {
    fetch('/api/branches')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setBranches(data.data)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch all gamification data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, lbRes, badgesRes] = await Promise.all([
        fetch(`/api/gamification/my-stats?month=${month}&year=${year}`),
        fetch(`/api/gamification/leaderboard?month=${month}&year=${year}&branchId=${branchId}`),
        fetch('/api/gamification/badges'),
      ])

      const [statsJson, lbJson, badgesJson] = await Promise.all([
        statsRes.json(),
        lbRes.json(),
        badgesRes.json(),
      ])

      if (statsJson.success) {
        setMyStatsData(statsJson.data)
      }
      if (lbJson.success) {
        setLeaderboardData({
          podium: lbJson.data.podium || [],
          rankings: lbJson.data.rankings || [],
          myRank: lbJson.data.myRank || null,
        })
      }
      if (badgesJson.success) {
        setBadgesData(badgesJson.data.badges || [])
      }
    } catch (error) {
      console.error('Failed to load gamification data:', error)
      showToast('Không thể nạp dữ liệu bảng xếp hạng', 'error')
    } finally {
      setLoading(false)
    }
  }, [month, year, branchId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Recalculate trigger
  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const res = await fetch('/api/gamification/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, branchId }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(
          `Cập nhật thành công! Đã tính điểm cho ${data.data.totalProcessed} nhân sự (${data.data.totalNewBadges} huy hiệu mới)`,
          'success'
        )
        fetchData()
      } else {
        showToast(data.message || 'Không thể tính toán điểm', 'error')
      }
    } catch (err) {
      showToast('Có lỗi xảy ra khi tính toán điểm', 'error')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="min-h-screen space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl transition-all ${
            toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black tracking-tight text-slate-900">
            <Trophy className="h-7 w-7 text-amber-500" />
            Bảng Vinh Danh & Đua Top Chuyên Cần
          </h1>
          <p className="text-xs text-slate-500">
            Hệ thống Gamification vinh danh nhân sự đúng giờ, tích lũy chuỗi streak và mở khóa huy hiệu danh dự
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Đang quét...' : 'Cập nhật điểm số'}
          </button>
        </div>
      </div>

      {/* Personal Streak Summary */}
      {myStatsData && myStatsData.isLinkedEmployee && (
        <PersonalStreakCard
          stats={myStatsData.stats}
          nextMilestone={myStatsData.nextMilestone}
          employeeName={myStatsData.employee?.fullName}
          avatarUrl={myStatsData.employee?.avatarUrl}
        />
      )}

      {/* Filter and Tab Navigation Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'LEADERBOARD'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="h-4 w-4" />
            Bảng Xếp Hạng
          </button>
          <button
            onClick={() => setActiveTab('BADGES')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'BADGES'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="h-4 w-4" />
            Huy Hiệu ({badgesData.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <span className="text-slate-300">/</span>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Branch selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="bg-transparent font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-2" />
          <span className="text-xs font-semibold text-slate-500">
            Đang tải dữ liệu thành tích và bảng xếp hạng...
          </span>
        </div>
      ) : activeTab === 'LEADERBOARD' ? (
        <div className="space-y-6">
          {/* Top 3 Podium */}
          <LeaderboardPodium podium={leaderboardData.podium} />

          {/* Detailed Leaderboard Table */}
          <LeaderboardTable
            rankings={leaderboardData.rankings}
            currentEmployeeId={myStatsData?.employee?.id}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <BadgeGallery badges={badgesData} />
        </div>
      )}
    </div>
  )
}
