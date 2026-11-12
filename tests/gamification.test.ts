import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { UserRole, BadgeType, BadgeTier } from '@prisma/client'
import {
  calculatePunctualityScore,
  calculateStreaks,
  evaluateEligibleBadges,
  BADGE_DEFINITIONS,
} from '@/lib/gamification'

const { mockSession, mockPrisma } = vi.hoisted(() => {
  const prismaMock: any = {
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    attendanceRecord: {
      findMany: vi.fn(),
    },
    overtimeRequest: {
      findMany: vi.fn(),
    },
    employeeBadge: {
      findMany: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    attendanceStreak: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  }

  prismaMock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === 'function') {
      return cb(prismaMock)
    }
    return Promise.all(cb)
  })

  return {
    mockSession: vi.fn(),
    mockPrisma: prismaMock,
  }
})

vi.mock('@/lib/auth', () => ({
  auth: () => mockSession(),
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import { GET as getMyStatsHandler } from '@/lib/../app/api/gamification/my-stats/route'
import { GET as getLeaderboardHandler } from '@/lib/../app/api/gamification/leaderboard/route'
import { GET as getBadgesHandler } from '@/lib/../app/api/gamification/badges/route'
import { POST as postRecalculateHandler } from '@/lib/../app/api/gamification/recalculate/route'

function createJsonRequest(url: string, method: string, body?: any): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('Gamification & Attendance Leaderboard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Gamification Engine - calculatePunctualityScore', () => {
    it('should return 100 for 0 worked days and 0 absences', () => {
      const score = calculatePunctualityScore({
        totalWorkedDays: 0,
        totalLate: 0,
        totalEarlyLeave: 0,
      })
      expect(score).toBe(100)
    })

    it('should deduct 5 points per late and 3 points per early leave', () => {
      const score = calculatePunctualityScore({
        totalWorkedDays: 20,
        totalLate: 2, // -10
        totalEarlyLeave: 1, // -3
      })
      expect(score).toBe(87)
    })

    it('should deduct 15 points per absent day', () => {
      const score = calculatePunctualityScore({
        totalWorkedDays: 18,
        totalLate: 0,
        totalEarlyLeave: 0,
        totalAbsent: 2, // -30
      })
      expect(score).toBe(70)
    })

    it('should add bonus points for active streak', () => {
      const score = calculatePunctualityScore({
        totalWorkedDays: 20,
        totalLate: 2, // -10
        totalEarlyLeave: 0,
        currentStreak: 6, // +2 bonus
      })
      expect(score).toBe(92)
    })

    it('should cap score within [0, 100]', () => {
      const negativeScore = calculatePunctualityScore({
        totalWorkedDays: 10,
        totalLate: 25,
        totalEarlyLeave: 10,
        totalAbsent: 5,
      })
      expect(negativeScore).toBe(0)

      const bonusScore = calculatePunctualityScore({
        totalWorkedDays: 22,
        totalLate: 0,
        totalEarlyLeave: 0,
        currentStreak: 20, // +5
      })
      expect(bonusScore).toBe(100)
    })
  })

  describe('Gamification Engine - calculateStreaks', () => {
    it('should calculate currentStreak and longestStreak accurately across consecutive on-time records', () => {
      const attendances = [
        { date: new Date('2026-11-01'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-02'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-03'), status: 'LATE', lateMinutes: 15, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-04'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-05'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-06'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
      ]

      const stats = calculateStreaks(attendances as any)
      expect(stats.totalOnTime).toBe(5)
      expect(stats.totalLate).toBe(1)
      expect(stats.longestStreak).toBe(3)
      expect(stats.currentStreak).toBe(3)
    })

    it('should reset streak when employee is absent or leaves early', () => {
      const attendances = [
        { date: new Date('2026-11-01'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-02'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
        { date: new Date('2026-11-03'), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 30 }, // early
      ]

      const stats = calculateStreaks(attendances as any)
      expect(stats.totalEarlyLeave).toBe(1)
      expect(stats.currentStreak).toBe(0)
      expect(stats.longestStreak).toBe(2)
    })
  })

  describe('Gamification Engine - evaluateEligibleBadges', () => {
    it('should award PERFECT_WEEK when streak reaches 5 days', () => {
      const eligible = evaluateEligibleBadges({
        currentStreak: 5,
        longestStreak: 5,
        totalWorkedDays: 5,
        totalLate: 0,
        totalEarlyLeave: 0,
        earlyCheckInCount: 0,
        approvedOvertimeHours: 0,
        punctualityScore: 100,
        existingBadges: [],
      })
      expect(eligible).toContain(BadgeType.PERFECT_WEEK)
    })

    it('should award OVERTIME_CHAMPION when approved overtime >= 20 hours', () => {
      const eligible = evaluateEligibleBadges({
        currentStreak: 2,
        longestStreak: 2,
        totalWorkedDays: 20,
        totalLate: 0,
        totalEarlyLeave: 0,
        earlyCheckInCount: 0,
        approvedOvertimeHours: 22.5,
        punctualityScore: 100,
        existingBadges: [],
      })
      expect(eligible).toContain(BadgeType.OVERTIME_CHAMPION)
    })

    it('should not award badges that employee already possesses', () => {
      const eligible = evaluateEligibleBadges({
        currentStreak: 7,
        longestStreak: 7,
        totalWorkedDays: 7,
        totalLate: 0,
        totalEarlyLeave: 0,
        earlyCheckInCount: 0,
        approvedOvertimeHours: 0,
        punctualityScore: 100,
        existingBadges: [BadgeType.PERFECT_WEEK],
      })
      expect(eligible).not.toContain(BadgeType.PERFECT_WEEK)
    })
  })

  describe('GET /api/gamification/my-stats', () => {
    it('should return 401 when unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/gamification/my-stats', 'GET')
      const res = await getMyStatsHandler(req)
      expect(res.status).toBe(401)
    })

    it('should return 422 if month or year is invalid', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', role: UserRole.EMPLOYEE },
      })
      const req = createJsonRequest('/api/gamification/my-stats?month=15&year=2026', 'GET')
      const res = await getMyStatsHandler(req)
      expect(res.status).toBe(422)
    })

    it('should return empty stats structure when user is not linked to an employee record', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-super', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.employee.findUnique.mockResolvedValueOnce(null)

      const req = createJsonRequest('/api/gamification/my-stats', 'GET')
      const res = await getMyStatsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.isLinkedEmployee).toBe(false)
      expect(body.data.stats.currentStreak).toBe(0)
    })

    it('should return personal gamification stats, streak and badges for linked employee', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-emp-1', role: UserRole.EMPLOYEE },
      })
      const mockEmp = {
        id: 'emp-1',
        fullName: 'Nguyễn Văn Cường',
        employeeCode: 'EMP001',
        avatarUrl: null,
        position: 'Kỹ sư phần mềm',
        branchId: 'branch-1',
        branch: { id: 'branch-1', name: 'Chi nhánh Hà Nội' },
        department: { id: 'dept-1', name: 'Phòng Kỹ thuật' },
      }
      mockPrisma.employee.findUnique.mockResolvedValueOnce(mockEmp)
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([
        { date: new Date(), status: 'PRESENT', lateMinutes: 0, earlyLeaveMinutes: 0 },
      ])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([])
      mockPrisma.employeeBadge.findMany.mockResolvedValue([
        {
          id: 'badge-1',
          employeeId: 'emp-1',
          badgeType: BadgeType.PERFECT_WEEK,
          tier: BadgeTier.BRONZE,
          title: 'Tuần Lễ Hoàn Hảo',
          icon: 'CalendarCheck',
          unlockedAt: new Date(),
        },
      ])
      mockPrisma.attendanceStreak.upsert.mockResolvedValue({
        id: 'streak-1',
        employeeId: 'emp-1',
        currentStreak: 6,
        longestStreak: 12,
        punctualityScore: 98.0,
        totalOnTime: 18,
        totalLate: 0,
        totalEarlyLeave: 0,
      })
      mockPrisma.attendanceStreak.findUnique.mockResolvedValue({
        id: 'streak-1',
        employeeId: 'emp-1',
        currentStreak: 6,
        longestStreak: 12,
        punctualityScore: 98.0,
        totalOnTime: 18,
        totalLate: 0,
        totalEarlyLeave: 0,
      })
      mockPrisma.attendanceStreak.findMany.mockResolvedValue([
        { employeeId: 'emp-1', punctualityScore: 98.0, currentStreak: 6, totalOnTime: 18 },
        { employeeId: 'emp-2', punctualityScore: 95.0, currentStreak: 4, totalOnTime: 15 },
      ])
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }])

      const req = createJsonRequest('/api/gamification/my-stats?month=11&year=2026', 'GET')
      const res = await getMyStatsHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.isLinkedEmployee).toBe(true)
      expect(body.data.employee.fullName).toBe('Nguyễn Văn Cường')
      expect(body.data.stats.currentStreak).toBe(6)
      expect(body.data.stats.rank).toBe(1)
      expect(body.data.badges.length).toBe(1)
    })
  })

  describe('GET /api/gamification/leaderboard', () => {
    it('should return 401 when unauthenticated', async () => {
      mockSession.mockResolvedValueOnce(null)
      const req = createJsonRequest('/api/gamification/leaderboard', 'GET')
      const res = await getLeaderboardHandler(req)
      expect(res.status).toBe(401)
    })

    it('should return leaderboard podium top 3 and rankings list', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', role: UserRole.EMPLOYEE },
      })
      mockPrisma.employee.findUnique.mockResolvedValueOnce({
        id: 'emp-1',
        branchId: 'branch-1',
      })

      const mockStreaks = [
        {
          id: 'streak-1',
          employeeId: 'emp-1',
          punctualityScore: 100,
          currentStreak: 15,
          longestStreak: 15,
          totalOnTime: 20,
          totalLate: 0,
          totalEarlyLeave: 0,
          employee: {
            id: 'emp-1',
            fullName: 'Trần Thị Bích',
            employeeCode: 'EMP001',
            avatarUrl: null,
            position: 'Trưởng phòng',
            branch: { id: 'branch-1', name: 'Chi nhánh 1' },
            department: { id: 'dept-1', name: 'Nhân sự' },
            badges: [],
          },
        },
        {
          id: 'streak-2',
          employeeId: 'emp-2',
          punctualityScore: 95,
          currentStreak: 10,
          longestStreak: 12,
          totalOnTime: 19,
          totalLate: 1,
          totalEarlyLeave: 0,
          employee: {
            id: 'emp-2',
            fullName: 'Lê Văn Cường',
            employeeCode: 'EMP002',
            avatarUrl: null,
            position: 'Chuyên viên',
            branch: { id: 'branch-1', name: 'Chi nhánh 1' },
            department: { id: 'dept-2', name: 'Kỹ thuật' },
            badges: [],
          },
        },
      ]

      mockPrisma.attendanceStreak.findMany.mockResolvedValue(mockStreaks)

      const req = createJsonRequest('/api/gamification/leaderboard?month=11&year=2026', 'GET')
      const res = await getLeaderboardHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.podium.length).toBe(2)
      expect(body.data.podium[0].fullName).toBe('Trần Thị Bích')
      expect(body.data.podium[0].rank).toBe(1)
      expect(body.data.myRank.employeeId).toBe('emp-1')
    })
  })

  describe('GET /api/gamification/badges', () => {
    it('should return all badge definitions and user progress status', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-1', role: UserRole.EMPLOYEE },
      })
      mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 'emp-1' })
      mockPrisma.employee.count.mockResolvedValue(50)
      mockPrisma.employeeBadge.groupBy.mockResolvedValue([
        { badgeType: BadgeType.PERFECT_WEEK, _count: { employeeId: 10 } },
      ])
      mockPrisma.employeeBadge.findMany.mockResolvedValue([
        { badgeType: BadgeType.PERFECT_WEEK, unlockedAt: new Date() },
      ])

      const req = createJsonRequest('/api/gamification/badges', 'GET')
      const res = await getBadgesHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.totalBadges).toBe(Object.keys(BADGE_DEFINITIONS).length)
      expect(body.data.unlockedByMeCount).toBe(1)

      const perfectWeek = body.data.badges.find((b: any) => b.type === BadgeType.PERFECT_WEEK)
      expect(perfectWeek.isUnlockedByMe).toBe(true)
      expect(perfectWeek.unlockRatePercent).toBe(20) // 10/50 = 20%
    })
  })

  describe('POST /api/gamification/recalculate', () => {
    it('should return 403 when user is an EMPLOYEE', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'user-emp', role: UserRole.EMPLOYEE },
      })
      const req = createJsonRequest('/api/gamification/recalculate', 'POST')
      const res = await postRecalculateHandler(req)
      expect(res.status).toBe(403)
    })

    it('should recalculate gamification stats and record audit log for SUPER_ADMIN', async () => {
      mockSession.mockResolvedValueOnce({
        user: { id: 'admin-super', role: UserRole.SUPER_ADMIN },
      })
      mockPrisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', fullName: 'Nhân viên 1' },
      ])
      mockPrisma.attendanceRecord.findMany.mockResolvedValue([])
      mockPrisma.overtimeRequest.findMany.mockResolvedValue([])
      mockPrisma.employeeBadge.findMany.mockResolvedValue([])
      mockPrisma.attendanceStreak.upsert.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })

      const req = createJsonRequest('/api/gamification/recalculate', 'POST', {
        month: 11,
        year: 2026,
      })
      const res = await postRecalculateHandler(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.totalProcessed).toBe(1)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'GAMIFICATION_RECALCULATED',
          }),
        })
      )
    })
  })
})
