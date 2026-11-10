'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Clock,
  FileText,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCw,
  Search,
  Filter,
  Check,
  X,
  Trash2,
  HelpCircle,
} from 'lucide-react'
import { formatVietnamDateDisplay } from '@/lib/attendance'

interface LeaveType {
  id: string
  code: string
  name: string
  isPaid: boolean
  requireApproval: boolean
}

interface LeaveRequestItem {
  id: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  attachmentUrl?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  approvedById?: string | null
  approvedAt?: string | null
  rejectReason?: string | null
  createdAt: string
  leaveType: LeaveType
  employee: {
    id: string
    fullName: string
    employeeCode: string
    position?: string | null
    annualLeaveBalance: number
    sickLeaveBalance: number
    department?: { id: string; name: string } | null
    branch?: { id: string; name: string } | null
  }
}

interface OvertimeRequestItem {
  id: string
  date: string
  startTime: string
  endTime: string
  hours: number
  reason?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  rejectReason?: string | null
  createdAt: string
  employee: {
    id: string
    fullName: string
    employeeCode: string
    department?: { id: string; name: string } | null
    branch?: { id: string; name: string } | null
  }
}

export default function LeavesPage() {
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'my-ot' | 'approval'>('my-leaves')
  const [userRole, setUserRole] = useState<string>('EMPLOYEE')
  const [balances, setBalances] = useState<{ annual: number; sick: number }>({ annual: 12, sick: 10 })

  // Data lists
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [myLeaves, setMyLeaves] = useState<LeaveRequestItem[]>([])
  const [myOts, setMyOts] = useState<OvertimeRequestItem[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequestItem[]>([])
  const [pendingOts, setPendingOts] = useState<OvertimeRequestItem[]>([])

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const [isOtModalOpen, setIsOtModalOpen] = useState(false)
  const [rejectModalData, setRejectModalData] = useState<{
    id: string
    type: 'leave' | 'ot'
  } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Form states
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    totalDays: 1,
    reason: '',
  })

  const [otForm, setOtForm] = useState({
    date: '',
    startTime: '17:30',
    endTime: '19:30',
    hours: 2,
    reason: '',
  })

  const canApprove = ['SUPER_ADMIN', 'HR_MANAGER', 'BRANCH_ADMIN'].includes(userRole)

  // Tự động tính số ngày khi thay đổi startDate hoặc endDate
  useEffect(() => {
    if (leaveForm.startDate && leaveForm.endDate) {
      const start = new Date(leaveForm.startDate)
      const end = new Date(leaveForm.endDate)
      if (end >= start) {
        let count = 0
        const cur = new Date(start)
        while (cur <= end) {
          const day = cur.getDay()
          if (day !== 0 && day !== 6) {
            count++
          }
          cur.setDate(cur.getDate() + 1)
        }
        setLeaveForm((prev) => ({ ...prev, totalDays: Math.max(1, count) }))
      }
    }
  }, [leaveForm.startDate, leaveForm.endDate])

  // Tự động tính số giờ OT
  useEffect(() => {
    if (otForm.startTime && otForm.endTime) {
      const [sh, sm] = otForm.startTime.split(':').map(Number)
      const [eh, em] = otForm.endTime.split(':').map(Number)
      const startMinutes = sh * 60 + sm
      const endMinutes = eh * 60 + em
      if (endMinutes > startMinutes) {
        const diffHours = (endMinutes - startMinutes) / 60
        setOtForm((prev) => ({ ...prev, hours: Math.round(diffHours * 10) / 10 }))
      }
    }
  }, [otForm.startTime, otForm.endTime])

  // Load tất cả dữ liệu
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Lấy thông tin session
      try {
        const sessionRes = await fetch('/api/auth/session')
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json()
          if (sessionData?.user?.role) {
            setUserRole(sessionData.user.role)
          }
        }
      } catch {
        // ignore
      }

      // 2. Lấy danh sách LeaveTypes
      const typesRes = await fetch('/api/leave-types')
      const typesJson = await typesRes.json()
      if (typesJson.success) {
        setLeaveTypes(typesJson.data)
        if (typesJson.data.length > 0 && !leaveForm.leaveTypeId) {
          setLeaveForm((prev) => ({ ...prev, leaveTypeId: typesJson.data[0].id }))
        }
      }

      // 3. Lấy đơn nghỉ cá nhân và số dư
      const leavesRes = await fetch('/api/leaves')
      const leavesJson = await leavesRes.json()
      if (leavesJson.success) {
        setMyLeaves(leavesJson.data.leaves)
        if (leavesJson.data.balances) {
          setBalances(leavesJson.data.balances)
        } else if (leavesJson.data.leaves.length > 0) {
          const emp = leavesJson.data.leaves[0].employee
          if (emp) {
            setBalances({
              annual: emp.annualLeaveBalance ?? 12,
              sick: emp.sickLeaveBalance ?? 10,
            })
          }
        }
        if (leavesJson.data.userRole) {
          setUserRole(leavesJson.data.userRole)
        }
      }

      // 4. Lấy đơn OT cá nhân
      const otRes = await fetch('/api/overtime')
      const otJson = await otRes.json()
      if (otJson.success) {
        setMyOts(otJson.data.requests)
      }

      // 5. Nếu có quyền duyệt, tải danh sách chờ duyệt
      const roleToCheck = leavesJson?.data?.userRole || userRole
      const isAdminOrManager = ['SUPER_ADMIN', 'HR_MANAGER', 'BRANCH_ADMIN'].includes(roleToCheck)
      if (isAdminOrManager) {
        const [pendingLeavesRes, pendingOtRes] = await Promise.all([
          fetch('/api/leaves?status=PENDING'),
          fetch('/api/overtime?status=PENDING'),
        ])
        const [pendingLeavesJson, pendingOtJson] = await Promise.all([
          pendingLeavesRes.json(),
          pendingOtRes.json(),
        ])
        if (pendingLeavesJson.success) {
          setPendingLeaves(pendingLeavesJson.data.leaves)
        }
        if (pendingOtJson.success) {
          setPendingOts(pendingOtJson.data.requests)
        }
      }
    } catch (err) {
      console.error('Error loading leaves page data:', err)
    } finally {
      setLoading(false)
    }
  }, [leaveForm.leaveTypeId, userRole])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Xử lý nộp đơn xin nghỉ phép
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setAlert(null)

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId: leaveForm.leaveTypeId,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          totalDays: Number(leaveForm.totalDays),
          reason: leaveForm.reason || undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setAlert({ type: 'success', message: 'Nộp đơn xin nghỉ phép thành công!' })
        setIsLeaveModalOpen(false)
        setLeaveForm((prev) => ({
          ...prev,
          startDate: '',
          endDate: '',
          totalDays: 1,
          reason: '',
        }))
        loadData()
      } else {
        setAlert({ type: 'error', message: json.message || 'Không thể gửi đơn xin nghỉ' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Lỗi mạng khi gửi đơn' })
    } finally {
      setActionLoading(false)
    }
  }

  // Xử lý đăng ký làm thêm giờ (OT)
  const handleSubmitOt = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setAlert(null)

    try {
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: otForm.date,
          startTime: otForm.startTime,
          endTime: otForm.endTime,
          hours: Number(otForm.hours),
          reason: otForm.reason || undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setAlert({ type: 'success', message: 'Đăng ký làm thêm giờ thành công!' })
        setIsOtModalOpen(false)
        setOtForm((prev) => ({
          ...prev,
          date: '',
          reason: '',
        }))
        loadData()
      } else {
        setAlert({ type: 'error', message: json.message || 'Không thể đăng ký OT' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Lỗi mạng khi đăng ký OT' })
    } finally {
      setActionLoading(false)
    }
  }

  // Hủy đơn cá nhân
  const handleCancelRequest = async (id: string, type: 'leave' | 'ot') => {
    if (!confirm('Bạn có chắc chắn muốn hủy yêu cầu này không?')) return
    setActionLoading(true)
    setAlert(null)

    try {
      const url = type === 'leave' ? `/api/leaves/${id}` : `/api/overtime/${id}`
      const res = await fetch(url, { method: 'DELETE' })
      const json = await res.json()

      if (json.success) {
        setAlert({ type: 'success', message: 'Đã hủy yêu cầu thành công' })
        loadData()
      } else {
        setAlert({ type: 'error', message: json.message || 'Không thể hủy yêu cầu' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Lỗi kết nối khi hủy yêu cầu' })
    } finally {
      setActionLoading(false)
    }
  }

  // Phê duyệt đơn (Approved)
  const handleApprove = async (id: string, type: 'leave' | 'ot') => {
    setActionLoading(true)
    setAlert(null)

    try {
      const url =
        type === 'leave' ? `/api/leaves/${id}/approve` : `/api/overtime/${id}/approve`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED' }),
      })
      const json = await res.json()

      if (json.success) {
        setAlert({ type: 'success', message: 'Đã phê duyệt đơn thành công!' })
        loadData()
      } else {
        setAlert({ type: 'error', message: json.message || 'Lỗi khi phê duyệt đơn' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Lỗi mạng khi phê duyệt đơn' })
    } finally {
      setActionLoading(false)
    }
  }

  // Từ chối đơn (Rejected)
  const handleRejectConfirm = async () => {
    if (!rejectModalData) return
    setActionLoading(true)
    setAlert(null)

    try {
      const { id, type } = rejectModalData
      const url =
        type === 'leave' ? `/api/leaves/${id}/approve` : `/api/overtime/${id}/approve`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', rejectReason }),
      })
      const json = await res.json()

      if (json.success) {
        setAlert({ type: 'success', message: 'Đã từ chối đơn' })
        setRejectModalData(null)
        setRejectReason('')
        loadData()
      } else {
        setAlert({ type: 'error', message: json.message || 'Lỗi khi từ chối đơn' })
      }
    } catch {
      setAlert({ type: 'error', message: 'Lỗi mạng khi từ chối đơn' })
    } finally {
      setActionLoading(false)
    }
  }

  const totalPending = pendingLeaves.length + pendingOts.length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Nghỉ phép & OT</h1>
          <p className="text-gray-500 text-sm mt-1">
            Nộp đơn xin nghỉ, đăng ký làm thêm giờ và theo dõi trạng thái phê duyệt
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition shadow-xs"
          >
            <Plus size={16} />
            <span>Xin nghỉ phép</span>
          </button>
          <button
            onClick={() => setIsOtModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition shadow-xs"
          >
            <Clock size={16} />
            <span>Đăng ký OT</span>
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {alert && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            alert.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Balances summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Phép năm khả dụng</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{balances.annual} ngày</p>
            <p className="text-xs text-gray-400">Tiêu chuẩn: 12 ngày/năm</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Phép ốm khả dụng</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{balances.sick} ngày</p>
            <p className="text-xs text-gray-400">Theo chế độ bảo hiểm</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Đơn đang chờ duyệt</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {myLeaves.filter((l) => l.status === 'PENDING').length +
                myOts.filter((o) => o.status === 'PENDING').length}{' '}
              đơn
            </p>
            <p className="text-xs text-gray-400">Đơn xin nghỉ & làm thêm</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('my-leaves')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'my-leaves'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} />
            <span>Đơn xin nghỉ phép ({myLeaves.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('my-ot')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 shrink-0 ${
              activeTab === 'my-ot'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock size={16} />
            <span>Làm thêm giờ OT ({myOts.length})</span>
          </button>

          {canApprove && (
            <button
              onClick={() => setActiveTab('approval')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 shrink-0 ${
                activeTab === 'approval'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckCircle size={16} />
              <span>Xét duyệt đơn</span>
              {totalPending > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  {totalPending}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* TAB 1: Đơn xin nghỉ phép của tôi */}
      {activeTab === 'my-leaves' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Lịch sử xin nghỉ phép</h3>
            <button
              onClick={loadData}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="Tải lại"
            >
              <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải dữ liệu...</div>
          ) : myLeaves.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <FileText size={40} className="mx-auto mb-2 opacity-40" />
              <p>Bạn chưa có đơn xin nghỉ phép nào</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (md:hidden) */}
              <div className="md:hidden divide-y divide-gray-100">
                {myLeaves.map((item) => (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">
                        {item.leaveType?.name || 'Nghỉ phép'}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-xs text-gray-600 flex items-center justify-between">
                      <span>
                        {formatVietnamDateDisplay(item.startDate)} – {formatVietnamDateDisplay(item.endDate)}
                      </span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                        {item.totalDays} ngày
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        {item.reason}
                      </p>
                    )}
                    {item.rejectReason && (
                      <p className="text-xs text-red-500 italic bg-red-50 p-2 rounded-lg">
                        Lý do từ chối: {item.rejectReason}
                      </p>
                    )}
                    {item.status === 'PENDING' && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleCancelRequest(item.id, 'leave')}
                          className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition"
                        >
                          <Trash2 size={13} />
                          <span>Hủy đơn</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Loại nghỉ</th>
                      <th className="px-6 py-3">Từ ngày</th>
                      <th className="px-6 py-3">Đến ngày</th>
                      <th className="px-6 py-3">Số ngày</th>
                      <th className="px-6 py-3">Lý do</th>
                      <th className="px-6 py-3">Trạng thái</th>
                      <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myLeaves.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {item.leaveType?.name || 'Nghỉ phép'}
                          {item.leaveType?.isPaid ? (
                            <span className="ml-2 text-xs text-green-600 font-normal">
                              (Có lương)
                            </span>
                          ) : (
                            <span className="ml-2 text-xs text-gray-400 font-normal">
                              (Không lương)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">{formatVietnamDateDisplay(item.startDate)}</td>
                        <td className="px-6 py-4">{formatVietnamDateDisplay(item.endDate)}</td>
                        <td className="px-6 py-4 font-semibold text-gray-800">{item.totalDays}</td>
                        <td className="px-6 py-4 max-w-xs truncate" title={item.reason || ''}>
                          {item.reason || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                          {item.rejectReason && (
                            <p className="text-xs text-red-500 mt-1 italic truncate max-w-xs">
                              {item.rejectReason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequest(item.id, 'leave')}
                              className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                              <span>Hủy đơn</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Đơn làm thêm giờ của tôi */}
      {activeTab === 'my-ot' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Lịch sử đăng ký làm thêm giờ (OT)</h3>
            <button
              onClick={loadData}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              title="Tải lại"
            >
              <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải dữ liệu...</div>
          ) : myOts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Clock size={40} className="mx-auto mb-2 opacity-40" />
              <p>Bạn chưa có yêu cầu làm thêm giờ nào</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (md:hidden) */}
              <div className="md:hidden divide-y divide-gray-100">
                {myOts.map((item) => (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">
                        Làm thêm giờ (OT)
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="text-xs text-gray-600 flex items-center justify-between">
                      <span>
                        {formatVietnamDateDisplay(item.date)} ({item.startTime} – {item.endTime})
                      </span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {item.hours}h
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        {item.reason}
                      </p>
                    )}
                    {item.rejectReason && (
                      <p className="text-xs text-red-500 italic bg-red-50 p-2 rounded-lg">
                        Lý do từ chối: {item.rejectReason}
                      </p>
                    )}
                    {item.status === 'PENDING' && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => handleCancelRequest(item.id, 'ot')}
                          className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition"
                        >
                          <Trash2 size={13} />
                          <span>Hủy đơn</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3">Ngày làm</th>
                      <th className="px-6 py-3">Khung giờ</th>
                      <th className="px-6 py-3">Số giờ OT</th>
                      <th className="px-6 py-3">Lý do</th>
                      <th className="px-6 py-3">Trạng thái</th>
                      <th className="px-6 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myOts.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {formatVietnamDateDisplay(item.date)}
                        </td>
                        <td className="px-6 py-4">
                          {item.startTime} – {item.endTime}
                        </td>
                        <td className="px-6 py-4 font-semibold text-indigo-600">{item.hours}h</td>
                        <td className="px-6 py-4 max-w-xs truncate" title={item.reason || ''}>
                          {item.reason || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                          {item.rejectReason && (
                            <p className="text-xs text-red-500 mt-1 italic truncate max-w-xs">
                              {item.rejectReason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancelRequest(item.id, 'ot')}
                              className="text-red-600 hover:text-red-800 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                              <span>Hủy đơn</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Xét duyệt đơn từ (Admin & HR) */}
      {activeTab === 'approval' && (
        <div className="space-y-6">
          {/* Đơn xin nghỉ phép chờ duyệt */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-amber-600" />
                <h3 className="font-semibold text-gray-900 text-sm">
                  Đơn xin nghỉ phép chờ duyệt ({pendingLeaves.length})
                </h3>
              </div>
              <button
                onClick={loadData}
                className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                title="Tải lại"
              >
                <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {pendingLeaves.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500 opacity-60" />
                <p>Không có đơn xin nghỉ phép nào đang chờ duyệt</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards for Pending Leaves (md:hidden) */}
                <div className="md:hidden divide-y divide-gray-100">
                  {pendingLeaves.map((item) => (
                    <div key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.employee.fullName}</p>
                          <p className="text-xs text-gray-400">
                            {item.employee.employeeCode} • {item.employee.department?.name || item.employee.branch?.name}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                          {item.leaveType?.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 flex items-center justify-between">
                        <span>
                          {formatVietnamDateDisplay(item.startDate)} – {formatVietnamDateDisplay(item.endDate)}
                        </span>
                        <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {item.totalDays} ngày
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                          {item.reason}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApprove(item.id, 'leave')}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Check size={14} /> Duyệt đơn
                        </button>
                        <button
                          onClick={() => setRejectModalData({ id: item.id, type: 'leave' })}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3">Nhân viên</th>
                        <th className="px-6 py-3">Phòng ban</th>
                        <th className="px-6 py-3">Loại nghỉ</th>
                        <th className="px-6 py-3">Thời gian</th>
                        <th className="px-6 py-3">Số ngày</th>
                        <th className="px-6 py-3">Lý do</th>
                        <th className="px-6 py-3 text-right">Xét duyệt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingLeaves.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{item.employee.fullName}</p>
                            <p className="text-xs text-gray-400">{item.employee.employeeCode}</p>
                          </td>
                          <td className="px-6 py-4">
                            {item.employee.department?.name || '—'}
                            <p className="text-xs text-gray-400">{item.employee.branch?.name}</p>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {item.leaveType?.name}
                          </td>
                          <td className="px-6 py-4">
                            {formatVietnamDateDisplay(item.startDate)} –{' '}
                            {formatVietnamDateDisplay(item.endDate)}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-800">{item.totalDays}</td>
                          <td className="px-6 py-4 max-w-xs truncate" title={item.reason || ''}>
                            {item.reason || '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(item.id, 'leave')}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition flex items-center gap-1 shadow-xs"
                              >
                                <Check size={14} />
                                <span>Duyệt</span>
                              </button>
                              <button
                                onClick={() => setRejectModalData({ id: item.id, type: 'leave' })}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition flex items-center gap-1"
                              >
                                <X size={14} />
                                <span>Từ chối</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Đơn làm thêm giờ (OT) chờ duyệt */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-purple-50/40">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-purple-600" />
                <h3 className="font-semibold text-gray-900 text-sm">
                  Yêu cầu làm thêm giờ (OT) chờ duyệt ({pendingOts.length})
                </h3>
              </div>
            </div>

            {pendingOts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <CheckCircle size={36} className="mx-auto mb-2 text-green-500 opacity-60" />
                <p>Không có yêu cầu OT nào đang chờ duyệt</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards for Pending OTs (md:hidden) */}
                <div className="md:hidden divide-y divide-gray-100">
                  {pendingOts.map((item) => (
                    <div key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.employee.fullName}</p>
                          <p className="text-xs text-gray-400">
                            {item.employee.employeeCode} • {item.employee.department?.name || item.employee.branch?.name}
                          </p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md">
                          {item.hours}h OT
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 flex items-center justify-between">
                        <span>{formatVietnamDateDisplay(item.date)}</span>
                        <span className="font-medium text-gray-700">{item.startTime} – {item.endTime}</span>
                      </div>
                      {item.reason && (
                        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                          {item.reason}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleApprove(item.id, 'ot')}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Check size={14} /> Duyệt OT
                        </button>
                        <button
                          onClick={() => setRejectModalData({ id: item.id, type: 'ot' })}
                          disabled={actionLoading}
                          className="flex-1 py-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-gray-700 font-semibold text-xs uppercase border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3">Nhân viên</th>
                        <th className="px-6 py-3">Phòng ban</th>
                        <th className="px-6 py-3">Ngày làm</th>
                        <th className="px-6 py-3">Khung giờ</th>
                        <th className="px-6 py-3">Số giờ OT</th>
                        <th className="px-6 py-3">Lý do</th>
                        <th className="px-6 py-3 text-right">Xét duyệt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingOts.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/60">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{item.employee.fullName}</p>
                            <p className="text-xs text-gray-400">{item.employee.employeeCode}</p>
                          </td>
                          <td className="px-6 py-4">
                            {item.employee.department?.name || '—'}
                            <p className="text-xs text-gray-400">{item.employee.branch?.name}</p>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {formatVietnamDateDisplay(item.date)}
                          </td>
                          <td className="px-6 py-4">
                            {item.startTime} – {item.endTime}
                          </td>
                          <td className="px-6 py-4 font-semibold text-purple-600">{item.hours}h</td>
                          <td className="px-6 py-4 max-w-xs truncate" title={item.reason || ''}>
                            {item.reason || '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(item.id, 'ot')}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition flex items-center gap-1 shadow-xs"
                              >
                                <Check size={14} />
                                <span>Duyệt</span>
                              </button>
                              <button
                                onClick={() => setRejectModalData({ id: item.id, type: 'ot' })}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition flex items-center gap-1"
                              >
                                <X size={14} />
                                <span>Từ chối</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal nộp đơn xin nghỉ phép */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nộp đơn xin nghỉ phép</h2>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Loại nghỉ phép *
                </label>
                <select
                  value={leaveForm.leaveTypeId}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {leaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.id}>
                      {lt.name} ({lt.isPaid ? 'Có lương' : 'Không lương'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Từ ngày *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Đến ngày *</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tổng số ngày nghỉ *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="365"
                  required
                  value={leaveForm.totalDays}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, totalDays: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lý do nghỉ</label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Nhập lý do chi tiết..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-60"
                >
                  {actionLoading ? 'Đang gửi...' : 'Nộp đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal đăng ký OT */}
      {isOtModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Đăng ký làm thêm giờ (OT)</h2>
              <button
                onClick={() => setIsOtModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitOt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ngày làm thêm *
                </label>
                <input
                  type="date"
                  required
                  value={otForm.date}
                  onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giờ bắt đầu *
                  </label>
                  <input
                    type="time"
                    required
                    value={otForm.startTime}
                    onChange={(e) => setOtForm({ ...otForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Giờ kết thúc *
                  </label>
                  <input
                    type="time"
                    required
                    value={otForm.endTime}
                    onChange={(e) => setOtForm({ ...otForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tổng số giờ OT *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  required
                  value={otForm.hours}
                  onChange={(e) =>
                    setOtForm({ ...otForm, hours: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nội dung công việc OT
                </label>
                <textarea
                  rows={3}
                  value={otForm.reason}
                  onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                  placeholder="Mô tả công việc cần xử lý ngoài giờ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsOtModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-xs disabled:opacity-60"
                >
                  {actionLoading ? 'Đang gửi...' : 'Đăng ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Từ chối đơn */}
      {rejectModalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900">Xác nhận từ chối đơn</h2>
            <p className="text-sm text-gray-500">
              Vui lòng nhập lý do từ chối để nhân viên nắm được thông tin.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối (bắt buộc hoặc khuyến khích)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-hidden"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalData(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'APPROVED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Đã duyệt
        </span>
      )
    case 'REJECTED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Từ chối
        </span>
      )
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          Đã hủy
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          Chờ duyệt
        </span>
      )
  }
}
