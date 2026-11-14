'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  Users,
  FileText,
  BarChart3,
  Settings,
  Building2,
  ChevronLeft,
  X,
  Trophy,
  ShieldAlert,
  Webhook,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { useSidebarStore } from '@/lib/sidebar-store'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    icon: <LayoutDashboard size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
  },
  {
    href: '/attendance',
    label: 'Chấm công',
    icon: <Clock size={18} />,
    roles: ['EMPLOYEE', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER'],
  },
  {
    href: '/attendance/manage',
    label: 'Quản lý chấm công',
    icon: <Clock size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER'],
  },
  {
    href: '/schedules',
    label: 'Ca làm việc',
    icon: <CalendarDays size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
  },
  {
    href: '/leaderboard',
    label: 'Bảng vinh danh',
    icon: <Trophy size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
  },
  {
    href: '/employees',
    label: 'Nhân viên',
    icon: <Users size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER'],
  },
  {
    href: '/leaves',
    label: 'Nghỉ phép',
    icon: <FileText size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER', 'EMPLOYEE'],
  },
  {
    href: '/reports',
    label: 'Báo cáo',
    icon: <BarChart3 size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN', 'HR_MANAGER'],
  },
  {
    href: '/branches',
    label: 'Chi nhánh',
    icon: <Building2 size={18} />,
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/settings',
    label: 'Cài đặt',
    icon: <Settings size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN'],
  },
  {
    href: '/audit-logs',
    label: 'Nhật ký kiểm toán',
    icon: <ShieldAlert size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN'],
  },
  {
    href: '/webhooks',
    label: 'Webhooks & Tích hợp',
    icon: <Webhook size={18} />,
    roles: ['SUPER_ADMIN', 'BRANCH_ADMIN'],
  },
]

export default function DashboardSidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const { isMobileOpen, closeMobile } = useSidebarStore()

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole))

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMobile()
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = ''
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isMobileOpen, closeMobile])

  return (
    <>
      {/* ========================================================= */}
      {/* MOBILE DRAWER OVERLAY (md:hidden) */}
      {/* ========================================================= */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={closeMobile}
            aria-label="Đóng menu"
          />

          {/* Drawer panel */}
          <aside
            className="relative z-50 w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col transform transition-transform ease-out duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-xs">
                  SA
                </div>
                <div>
                  <span className="font-bold text-gray-900 text-sm tracking-tight block">
                    Smart Attendance
                  </span>
                  <span className="text-[11px] text-gray-400">GPS & Nhân sự</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="p-2 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Đóng sidebar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {filteredItems.map((item) => {
                const hasMoreSpecificMatch = filteredItems.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href.startsWith(item.href + '/') &&
                    (pathname === other.href || pathname.startsWith(other.href + '/'))
                )
                const isActive =
                  pathname === item.href ||
                  (pathname.startsWith(item.href + '/') && !hasMoreSpecificMatch)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                    )}
                  >
                    <span className={cn('shrink-0', isActive ? 'text-indigo-600' : 'text-gray-500')}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/70">
              <div className="text-xs text-gray-500 font-medium">Vai trò người dùng</div>
              <div className="text-xs font-semibold text-gray-800 mt-0.5">{userRole}</div>
            </div>
          </aside>
        </div>
      )}

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (hidden md:flex) */}
      {/* ========================================================= */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
            SA
          </div>
          {!collapsed && (
            <span className="font-semibold text-gray-900 text-sm truncate">Smart Attendance</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const hasMoreSpecificMatch = filteredItems.some(
              (other) =>
                other.href !== item.href &&
                other.href.startsWith(item.href + '/') &&
                (pathname === other.href || pathname.startsWith(other.href + '/'))
            )
            const isActive =
              pathname === item.href ||
              (pathname.startsWith(item.href + '/') && !hasMoreSpecificMatch)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            <ChevronLeft size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
      </aside>
    </>
  )
}
