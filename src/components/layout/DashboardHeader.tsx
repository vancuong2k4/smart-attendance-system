'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Check,
  Calendar,
  Clock,
  MapPin,
  CheckCheck,
  RotateCw,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSidebarStore } from '@/lib/sidebar-store'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

type HeaderUser = {
  email: string
  role: string
  employee?: {
    id?: string
    fullName: string
    employeeCode: string
    avatarUrl?: string | null
  } | null
}

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  link?: string | null
  createdAt: string
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  BRANCH_ADMIN: 'Quản lý chi nhánh',
  HR_MANAGER: 'HR Manager',
  EMPLOYEE: 'Nhân viên',
}

function formatRelativeTime(dateInput: string | Date | undefined | null) {
  if (!dateInput) return ''
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    return formatDistanceToNow(d, { addSuffix: true, locale: vi })
  } catch {
    return ''
  }
}

export default function DashboardHeader({ user }: { user: HeaderUser }) {
  const router = useRouter()
  const { toggleMobile } = useSidebarStore()

  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingNotifs(true)
      const res = await fetch('/api/notifications?limit=10')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data) {
          setNotifications(json.data.notifications || [])
          setUnreadCount(json.data.unreadCount || 0)
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      if (!silent) setLoadingNotifs(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll notifications silently every 45s
    const interval = setInterval(() => fetchNotifications(true), 45000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Handle click outside to close popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark single notification as read
  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id }),
        })
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    }

    setShowNotifications(false)
    if (notif.link) {
      router.push(notif.link)
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      })
    } catch (err) {
      console.error('Failed to mark all as read:', err)
      fetchNotifications()
    }
  }

  // Icon selector based on notification type
  const renderNotifIcon = (type: string) => {
    if (type.startsWith('LEAVE_')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <Calendar size={16} />
        </div>
      )
    }
    if (type.startsWith('OT_')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
          <Clock size={16} />
        </div>
      )
    }
    if (type.startsWith('ATTENDANCE_')) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <MapPin size={16} />
        </div>
      )
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <Bell size={16} />
      </div>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile hamburger menu button & Brand display */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMobile}
          className="p-2 -ml-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors md:hidden"
          aria-label="Mở thanh điều hướng"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
            SA
          </div>
          <span className="font-semibold text-gray-900 text-sm">Smart Attendance</span>
        </div>
      </div>

      {/* Right: Notifications popover + User menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) fetchNotifications()
            }}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
            aria-label="Thông báo"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 max-w-sm sm:max-w-none bg-white rounded-2xl border border-gray-200 shadow-xl py-2 z-50">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm">Thông báo</h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition"
                    >
                      <CheckCheck size={14} />
                      Đọc tất cả
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fetchNotifications(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded"
                    title="Làm mới"
                  >
                    <RotateCw size={13} className={loadingNotifs ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Notification Items List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
                {loadingNotifs && notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    <RotateCw size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Đang tải thông báo...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    <Bell size={28} className="mx-auto mb-2 opacity-30" />
                    Không có thông báo mới nào
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`px-4 py-3 hover:bg-gray-50 transition cursor-pointer flex items-start gap-3 ${
                        !item.isRead ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {renderNotifIcon(item.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={`text-xs font-semibold truncate ${
                              !item.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {item.title}
                          </p>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] text-gray-600 line-clamp-2 mt-0.5 leading-snug">
                          {item.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm flex items-center justify-center shrink-0">
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

          {/* User Dropdown */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 z-50">
              <div className="px-3.5 py-2 border-b border-gray-100">
                <p className="text-[11px] text-gray-400">Đăng nhập với</p>
                <p className="text-xs font-semibold text-gray-800 truncate">{user.email}</p>
                <span className="inline-block mt-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {roleLabels[user.role] ?? user.role}
                </span>
              </div>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-gray-600 hover:bg-gray-50 transition"
              >
                <User size={14} />
                Thông tin cá nhân
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition font-medium"
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
