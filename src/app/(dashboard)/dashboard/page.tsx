import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Clock, Users, FileText, TrendingUp, CheckCircle, ArrowRight, Calendar, AlertCircle } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getTodayDate, formatVietnamTime, formatVietnamDateDisplay } from '@/lib/attendance'
import { getMonthDateRange } from '@/lib/payroll'
import { LeaveStatus, UserRole } from '@prisma/client'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isEmployee = session.user.role === UserRole.EMPLOYEE
  const userRole = session.user.role
  const userEmpId = session.user.employee?.id
  const userBranchId = session.user.employee?.branchId

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const today = getTodayDate()
  const { startDate, endDate } = getMonthDateRange(year, month)

  // Dữ liệu cho nhân viên
  let empWorkDays = 0
  let empLeaveBalance = 0
  let empPendingCount = 0
  let empOtHours = 0
  let empRecentLeaves: any[] = []

  // Dữ liệu cho Admin / HR
  let adminTotalEmployees = 0
  let adminPresentToday = 0
  let adminAbsentToday = 0
  let adminPendingRequests = 0
  let adminRecentPendingLeaves: any[] = []

  if (isEmployee && userEmpId) {
    const [empProfile, monthAttendance, pendingLeaves, pendingOTs, monthOTs, recentLeaves] =
      await Promise.all([
        prisma.employee.findUnique({
          where: { id: userEmpId },
          select: { annualLeaveBalance: true, sickLeaveBalance: true },
        }),
        prisma.attendanceRecord.findMany({
          where: {
            employeeId: userEmpId,
            date: { gte: startDate, lte: endDate },
          },
          select: { workDays: true },
        }),
        prisma.leaveRequest.count({
          where: {
            employeeId: userEmpId,
            status: LeaveStatus.PENDING,
          },
        }),
        prisma.overtimeRequest.count({
          where: {
            employeeId: userEmpId,
            status: LeaveStatus.PENDING,
          },
        }),
        prisma.overtimeRequest.findMany({
          where: {
            employeeId: userEmpId,
            date: { gte: startDate, lte: endDate },
            status: LeaveStatus.APPROVED,
          },
          select: { hours: true },
        }),
        prisma.leaveRequest.findMany({
          where: { employeeId: userEmpId },
          include: { leaveType: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])

    empWorkDays = monthAttendance.reduce((acc, curr) => acc + (curr.workDays || 0), 0)
    empLeaveBalance = empProfile?.annualLeaveBalance ?? 0
    empPendingCount = pendingLeaves + pendingOTs
    empOtHours = monthOTs.reduce((acc, curr) => acc + curr.hours, 0)
    empRecentLeaves = recentLeaves
  } else {
    // Admin / HR
    const branchFilter =
      userRole === UserRole.BRANCH_ADMIN && userBranchId ? { branchId: userBranchId } : {}

    const [totalEmps, presentCount, pendingLeaves, pendingOTs, pendingList] = await Promise.all([
      prisma.employee.count({
        where: {
          ...branchFilter,
          startDate: { lte: endDate },
          OR: [{ endDate: null }, { endDate: { gte: startDate } }],
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          employee: branchFilter,
          date: today,
          checkInTime: { not: null },
        },
      }),
      prisma.leaveRequest.count({
        where: {
          employee: branchFilter,
          status: LeaveStatus.PENDING,
        },
      }),
      prisma.overtimeRequest.count({
        where: {
          employee: branchFilter,
          status: LeaveStatus.PENDING,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employee: branchFilter,
          status: LeaveStatus.PENDING,
        },
        include: {
          employee: {
            select: { fullName: true, employeeCode: true, department: true },
          },
          leaveType: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    adminTotalEmployees = totalEmps
    adminPresentToday = presentCount
    adminAbsentToday = Math.max(0, totalEmps - presentCount)
    adminPendingRequests = pendingLeaves + pendingOTs
    adminRecentPendingLeaves = pendingList
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Chào mừng, {session.user.employee?.fullName ?? session.user.email}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <Link
            href="/attendance"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Clock size={16} />
            <span>Chấm công ngay</span>
          </Link>
          <Link
            href="/leaves"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            <FileText size={16} />
            <span>Đơn từ & Phép</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isEmployee ? (
          <>
            <StatCard
              icon={<Clock className="text-indigo-600" size={24} />}
              label="Ngày công tháng này"
              value={`${Math.round(empWorkDays * 10) / 10} công`}
              subtext={`Tháng ${month}/${year}`}
              bg="bg-indigo-50"
            />
            <StatCard
              icon={<TrendingUp className="text-green-600" size={24} />}
              label="Phép còn lại"
              value={`${empLeaveBalance} ngày`}
              subtext="Phép năm khả dụng"
              bg="bg-green-50"
            />
            <StatCard
              icon={<FileText className="text-orange-600" size={24} />}
              label="Đơn đang chờ"
              value={`${empPendingCount} đơn`}
              subtext="Đang chờ phê duyệt"
              bg="bg-orange-50"
            />
            <StatCard
              icon={<Clock className="text-purple-600" size={24} />}
              label="Giờ OT tháng này"
              value={`${Math.round(empOtHours * 10) / 10} giờ`}
              subtext="Đã được phê duyệt"
              bg="bg-purple-50"
            />
          </>
        ) : (
          <>
            <StatCard
              icon={<Users className="text-indigo-600" size={24} />}
              label="Tổng nhân viên"
              value={`${adminTotalEmployees}`}
              subtext="Nhân viên đang làm việc"
              bg="bg-indigo-50"
            />
            <StatCard
              icon={<CheckCircle className="text-green-600" size={24} />}
              label="Có mặt hôm nay"
              value={`${adminPresentToday}`}
              subtext={`Tỷ lệ: ${adminTotalEmployees > 0 ? Math.round((adminPresentToday / adminTotalEmployees) * 100) : 0}%`}
              bg="bg-green-50"
            />
            <StatCard
              icon={<AlertCircle className="text-red-600" size={24} />}
              label="Vắng mặt hôm nay"
              value={`${adminAbsentToday}`}
              subtext="Chưa check-in hôm nay"
              bg="bg-red-50"
            />
            <StatCard
              icon={<FileText className="text-orange-600" size={24} />}
              label="Đơn chờ duyệt"
              value={`${adminPendingRequests} đơn`}
              subtext="Phép & Làm thêm giờ"
              bg="bg-orange-50"
            />
          </>
        )}
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Access Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <span>{isEmployee ? 'Đơn xin nghỉ gần đây' : 'Đơn cần xử lý gần đây'}</span>
              <Link
                href="/leaves"
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
              >
                Xem tất cả <ArrowRight size={14} />
              </Link>
            </h2>

            {isEmployee ? (
              empRecentLeaves.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Bạn chưa có đơn xin nghỉ phép nào</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {empRecentLeaves.map((leave) => (
                    <div key={leave.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{leave.leaveType.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatVietnamDateDisplay(leave.startDate)} –{' '}
                          {formatVietnamDateDisplay(leave.endDate)} ({leave.totalDays} ngày)
                        </p>
                      </div>
                      <div>
                        <StatusBadge status={leave.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : adminRecentPendingLeaves.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500 opacity-60" />
                <p className="text-sm">Hiện không có đơn nào đang chờ duyệt</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {adminRecentPendingLeaves.map((leave) => (
                  <div key={leave.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {leave.employee.fullName}{' '}
                        <span className="text-xs text-gray-400 font-normal">
                          ({leave.employee.employeeCode})
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {leave.leaveType.name}: {formatVietnamDateDisplay(leave.startDate)} –{' '}
                        {formatVietnamDateDisplay(leave.endDate)} ({leave.totalDays} ngày)
                      </p>
                    </div>
                    <Link
                      href="/leaves"
                      className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                    >
                      Xử lý
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col): Shortcuts & Information */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Lối tắt nhanh</h2>
            <div className="space-y-2">
              <ShortcutLink
                href="/attendance"
                title="Chấm công vị trí GPS"
                desc="Ghi nhận giờ vào/ra tại văn phòng"
                icon={<Clock size={18} className="text-indigo-600" />}
              />
              <ShortcutLink
                href="/leaves"
                title="Quản lý nghỉ phép & OT"
                desc="Nộp đơn xin nghỉ, làm thêm giờ"
                icon={<FileText size={18} className="text-green-600" />}
              />
              {!isEmployee && (
                <>
                  <ShortcutLink
                    href="/attendance/manage"
                    title="Quản lý chấm công"
                    desc="Theo dõi bảng công toàn chi nhánh"
                    icon={<Users size={18} className="text-blue-600" />}
                  />
                  <ShortcutLink
                    href="/reports"
                    title="Báo cáo & Xuất bảng công"
                    desc="Xuất file Excel/CSV tính lương"
                    icon={<TrendingUp size={18} className="text-purple-600" />}
                  />
                </>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-indigo-900 mb-2">Quy định chấm công GPS</h3>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Ca làm việc chuẩn từ 08:00 đến 17:00 (T2-T6). Giờ nghỉ trưa từ 12:00 - 13:00. Bán kính
              chấm công hợp lệ trong vòng 100 mét tính từ tâm vị trí chi nhánh.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtext?: string
  bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtext}</p>}
      </div>
    </div>
  )
}

function ShortcutLink({
  href,
  title,
  desc,
  icon,
}: {
  href: string
  title: string
  desc: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100"
    >
      <div className="p-2 rounded-md bg-gray-100 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 truncate">{desc}</p>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Đã duyệt
        </span>
      )
    case 'REJECTED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Từ chối
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          Đã hủy
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
          Chờ duyệt
        </span>
      )
  }
}
