'use client'

import React, { useState, useMemo } from 'react'
import { Search, Flame, Award, Trophy, User, CheckCircle2, Clock } from 'lucide-react'

export interface RankingRow {
  rank: number
  id: string
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
  totalOnTime: number
  totalLate: number
  totalEarlyLeave: number
  badges: Array<{
    id: string
    title: string
    icon: string
    tier: string
  }>
}

interface LeaderboardTableProps {
  rankings: RankingRow[]
  currentEmployeeId?: string | null
}

export function LeaderboardTable({ rankings, currentEmployeeId }: LeaderboardTableProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRankings = useMemo(() => {
    if (!searchTerm.trim()) return rankings
    const term = searchTerm.toLowerCase().trim()
    return rankings.filter(
      (r) =>
        r.fullName.toLowerCase().includes(term) ||
        r.employeeCode.toLowerCase().includes(term) ||
        (r.branchName && r.branchName.toLowerCase().includes(term)) ||
        (r.departmentName && r.departmentName.toLowerCase().includes(term))
    )
  }, [rankings, searchTerm])

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 font-black text-amber-800 text-xs border border-amber-300 shadow-xs">
          🥇 1
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 font-black text-slate-700 text-xs border border-slate-300 shadow-xs">
          🥈 2
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 font-black text-orange-800 text-xs border border-orange-300 shadow-xs">
          🥉 3
        </span>
      )
    }
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 font-bold text-slate-500 text-xs">
        #{rank}
      </span>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
        <div>
          <h4 className="text-sm font-bold text-slate-800">Bảng Xếp Hạng Chi Tiết</h4>
          <p className="text-xs text-slate-500">
            Hiển thị {filteredRankings.length} nhân viên trong kỳ đánh giá
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã NV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 w-14 text-center">Hạng</th>
              <th className="py-3 px-4">Nhân viên</th>
              <th className="py-3 px-4">Phòng ban / Chi nhánh</th>
              <th className="py-3 px-4 text-center">Điểm chuyên cần</th>
              <th className="py-3 px-4 text-center">Chuỗi Streak</th>
              <th className="py-3 px-4 text-center">Đúng giờ / Muộn</th>
              <th className="py-3 px-4 text-center">Huy hiệu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRankings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Không tìm thấy nhân viên nào phù hợp
                </td>
              </tr>
            ) : (
              filteredRankings.map((row) => {
                const isMe = currentEmployeeId && row.employeeId === currentEmployeeId

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isMe
                        ? 'bg-indigo-50/70 font-medium hover:bg-indigo-50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center">{getRankBadge(row.rank)}</div>
                    </td>

                    {/* Employee info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {row.avatarUrl ? (
                          <img
                            src={row.avatarUrl}
                            alt={row.fullName}
                            className="h-9 w-9 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            {row.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{row.fullName}</span>
                            {isMe && (
                              <span className="rounded-md bg-indigo-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                                Bạn
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {row.employeeCode} {row.position ? `• ${row.position}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Department / Branch */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium line-clamp-1">
                        {row.departmentName || 'Chưa phân bổ'}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {row.branchName || 'Toàn công ty'}
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block font-extrabold text-sm px-2.5 py-0.5 rounded-lg ${
                          row.punctualityScore >= 95
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.punctualityScore >= 80
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {row.punctualityScore.toFixed(1)}
                      </span>
                    </td>

                    {/* Streak */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-xs">
                        <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {row.currentStreak} ngày
                      </div>
                    </td>

                    {/* On-Time / Late Stats */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="flex items-center gap-0.5 text-emerald-600 font-semibold" title="Số ngày đúng giờ">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {row.totalOnTime}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span className="flex items-center gap-0.5 text-rose-500 font-semibold" title="Số lần đi muộn">
                          <Clock className="h-3.5 w-3.5" />
                          {row.totalLate}
                        </span>
                      </div>
                    </td>

                    {/* Badges preview */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {row.badges.length > 0 ? (
                          row.badges.map((b) => (
                            <span
                              key={b.id}
                              title={b.title}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs shadow-xs border border-slate-200"
                            >
                              🏅
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
