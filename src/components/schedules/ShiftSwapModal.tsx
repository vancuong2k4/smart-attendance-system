'use client'

import React, { useState } from 'react'
import {
  X,
  ArrowLeftRight,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'

export interface ShiftSwapModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  peers: Array<{
    id: string
    fullName: string
    employeeCode: string
    position?: string | null
    department?: { name: string } | null
  }>
  schedules: Array<{
    id: string
    name: string
    startTime: string
    endTime: string
  }>
  currentEmployeeId: string
}

export default function ShiftSwapModal({
  isOpen,
  onClose,
  onSuccess,
  peers,
  schedules,
  currentEmployeeId,
}: ShiftSwapModalProps) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Eligible peers (excluding self)
  const eligiblePeers = peers.filter((p) => p.id !== currentEmployeeId)

  const [targetEmployeeId, setTargetEmployeeId] = useState(eligiblePeers[0]?.id || '')
  const [requesterDate, setRequesterDate] = useState(tomorrow)
  const [requesterScheduleId, setRequesterScheduleId] = useState(schedules[0]?.id || '')
  const [targetDate, setTargetDate] = useState(tomorrow)
  const [targetScheduleId, setTargetScheduleId] = useState(schedules[0]?.id || '')
  const [reason, setReason] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    if (!targetEmployeeId) {
      setErrorMessage('Vui lòng chọn đồng nghiệp muốn đổi ca')
      setLoading(false)
      return
    }

    if (reason.trim().length < 5) {
      setErrorMessage('Lý do đổi ca phải có ít nhất 5 ký tự')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/schedules/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmployeeId,
          requesterDate,
          requesterScheduleId,
          targetDate,
          targetScheduleId,
          reason: reason.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Không thể tạo đơn đổi ca')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi gửi đơn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tạo yêu cầu đổi ca làm việc</h2>
              <p className="text-xs text-slate-500">
                Thỏa thuận đổi lịch ca với đồng nghiệp và gửi lên Quản lý xét duyệt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Select Target Peer */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Đồng nghiệp muốn đổi ca <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={targetEmployeeId}
              onChange={(e) => setTargetEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {eligiblePeers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.employeeCode}) {p.department ? `- ${p.department.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Side by side comparison: My Shift vs Peer Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* My shift */}
            <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
              <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} />
                <span>Ca của bạn cần nhường</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Ngày làm việc</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={requesterDate}
                  onChange={(e) => setRequesterDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Ca làm việc</label>
                <select
                  required
                  value={requesterScheduleId}
                  onChange={(e) => setRequesterScheduleId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Peer Shift */}
            <div className="p-3.5 rounded-xl bg-violet-50/50 border border-violet-100 space-y-2.5">
              <div className="text-xs font-bold text-violet-700 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowLeftRight size={13} />
                <span>Ca đồng nghiệp muốn nhận</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Ngày làm việc</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Ca làm việc</label>
                <select
                  required
                  value={targetScheduleId}
                  onChange={(e) => setTargetScheduleId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium"
                >
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Lý do đổi ca <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="VD: Có việc bận gia đình đột xuất, cần đổi ca sáng lấy ca chiều với bạn..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Workflow Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] space-y-1">
            <p className="font-semibold text-slate-700">Quy trình xử lý đơn đổi ca:</p>
            <p>1. Sau khi gửi, đồng nghiệp sẽ nhận được thông báo để xác nhận.</p>
            <p>2. Khi đồng nghiệp đồng ý, đơn sẽ chuyển lên Quản lý chi nhánh phê duyệt.</p>
            <p>3. Khi Quản lý duyệt, hệ thống sẽ tự động cập nhật lịch ca cho cả hai bạn.</p>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang gửi...' : 'Gửi yêu cầu đổi ca'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
