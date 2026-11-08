'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Clock,
  Users,
  FileText,
  BarChart3,
  Settings,
  Building2,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

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
]

export default function DashboardSidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const filteredItems = navItems.filter((item) => item.roles.includes(userRole))

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
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
      <nav className="flex-1 py-4 px-2 space-y-1">
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
        >
          <ChevronLeft size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>
    </aside>
  )
}
