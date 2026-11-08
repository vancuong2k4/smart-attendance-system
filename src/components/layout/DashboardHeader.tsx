'use client'

import { signOut } from 'next-auth/react'
import { Bell, LogOut, User, ChevronDown } from 'lucide-react'
import { useState } from 'react'

type HeaderUser = {
  email: string
  role: string
  employee?: {
    fullName: string
    employeeCode: string
    avatarUrl?: string | null
  } | null
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  BRANCH_ADMIN: 'Quản lý chi nhánh',
  HR_MANAGER: 'HR Manager',
  EMPLOYEE: 'Nhân viên',
}

export default function DashboardHeader({ user }: { user: HeaderUser }) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      {/* Left: breadcrumb or title placeholder */}
      <div />

      {/* Right: notifications + user menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex items-center justify-center">
              {(user.employee?.fullName ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 leading-tight">
                {user.employee?.fullName ?? user.email}
              </p>
              <p className="text-xs text-gray-400">{roleLabels[user.role] ?? user.role}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* Dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-400">Đăng nhập với</p>
                <p className="text-sm font-medium text-gray-700 truncate">{user.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <User size={14} />
                Thông tin cá nhân
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
