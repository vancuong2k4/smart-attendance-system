'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  LogOut,
  LogIn,
  Calendar,
  Building,
  Navigation,
  Info,
} from 'lucide-react'
import AttendanceMap from '@/components/attendance/AttendanceMap'
import { calculateDistance, isWithinRadius } from '@/lib/gps'
import { formatVietnamTime, formatVietnamDateDisplay, formatDuration } from '@/lib/attendance'

interface BranchData {
  id: string
  name: string
  code: string
  address?: string | null
  latitude: number
  longitude: number
  gpsRadius: number
  schedule?: {
    name: string
    startTime: string
    endTime: string
    lunchStart?: string | null
    lunchEnd?: string | null
    lateThreshold: number
    earlyThreshold: number
  } | null
}

interface TodayData {
  date: string
  status: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT'
  checkInTime?: string | null
  checkOutTime?: string | null
  isLate: boolean
  lateMinutes: number
  isEarlyLeave: boolean
  earlyMinutes: number
  workDuration?: number | null
  workDays?: number | null
  record?: any
}

interface HistoryItem {
  id: string
  date: string
  checkInTime?: string | null
  checkOutTime?: string | null
  workDuration?: number | null
  workDays?: number | null
  isLate?: boolean | null
  lateMinutes?: number | null
  isEarlyLeave?: boolean | null
  earlyMinutes?: number | null
  status: string
}

export default function AttendancePage() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [branch, setBranch] = useState<BranchData | null>(null)
  const [todayStatus, setTodayStatus] = useState<TodayData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // GPS state
  const [userLocation, setUserLocation] = useState<{
    latitude: number
    longitude: number
    accuracy?: number
  } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [fetchingGps, setFetchingGps] = useState(false)

  // Notification / Alert message
  const [alert, setAlert] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // Clock ticker
  useEffect(() => {
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch initial data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true)
      const [branchRes, todayRes, historyRes] = await Promise.all([
        fetch('/api/branches/my-branch'),
        fetch('/api/attendance/today'),
        fetch('/api/attendance/history?limit=7'),
      ])

      const [branchJson, todayJson, historyJson] = await Promise.all([
        branchRes.json(),
        todayRes.json(),
        historyRes.json(),
      ])

      if (branchJson.success) {
        setBranch(branchJson.data)
      } else {
        setAlert({
          type: 'error',
          message: branchJson.message || 'Không thể tải thông tin chi nhánh',
        })
      }

      if (todayJson.success) {
        setTodayStatus(todayJson.data)
      }

      if (historyJson.success) {
        setHistory(historyJson.data.records || [])
      }
    } catch (e: any) {
      console.error('Lỗi khi tải dữ liệu ban đầu:', e)
      setAlert({ type: 'error', message: 'Không thể kết nối đến máy chủ' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Get current GPS position
  const getGpsPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS.')
      return
    }

    setFetchingGps(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setFetchingGps(false)
      },
      (err) => {
        let msg = 'Không thể lấy tọa độ GPS.'
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Vui lòng cấp quyền truy cập vị trí trên trình duyệt để chấm công.'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Vị trí hiện không khả dụng. Vui lòng kiểm tra lại thiết bị.'
        } else if (err.code === err.TIMEOUT) {
          msg = 'Hết thời gian chờ lấy vị trí GPS. Vui lòng thử lại.'
        }
        setGpsError(msg)
        setFetchingGps(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    )
  }, [])

  // Auto get GPS when branch is loaded
  useEffect(() => {
    if (branch && !userLocation) {
      getGpsPosition()
    }
  }, [branch, userLocation, getGpsPosition])

  // Distance calculation
  const distance =
    userLocation && branch
      ? Math.round(
          calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            branch.latitude,
            branch.longitude
          )
        )
      : null

  const isWithinGeofence =
    userLocation && branch
      ? isWithinRadius(
          userLocation.latitude,
          userLocation.longitude,
          branch.latitude,
          branch.longitude,
          branch.gpsRadius
        )
      : false

  // Handle Check-in
  const handleCheckIn = async () => {
    if (!userLocation) {
      setAlert({ type: 'error', message: 'Vui lòng đợi hệ thống xác định vị trí GPS của bạn' })
      getGpsPosition()
      return
    }

    if (!isWithinGeofence) {
      setAlert({
        type: 'error',
        message: `Bạn đang cách văn phòng ${distance}m. Vui lòng di chuyển vào khu vực cho phép (${branch?.gpsRadius}m).`,
      })
      return
    }

    try {
      setSubmitting(true)
      setAlert(null)

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
          deviceInfo: navigator.userAgent,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setAlert({ type: 'success', message: json.data.message || 'Check-in thành công!' })
        await loadInitialData()
      } else {
        setAlert({
          type: 'error',
          message: json.message || 'Check-in thất bại. Vui lòng thử lại.',
        })
      }
    } catch (e: any) {
      setAlert({ type: 'error', message: 'Lỗi mạng khi thực hiện check-in' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Check-out
  const handleCheckOut = async () => {
    if (!userLocation) {
      setAlert({ type: 'error', message: 'Vui lòng đợi hệ thống xác định vị trí GPS của bạn' })
      getGpsPosition()
      return
    }

    if (!isWithinGeofence) {
      setAlert({
        type: 'error',
        message: `Bạn đang cách văn phòng ${distance}m. Vui lòng di chuyển vào khu vực cho phép (${branch?.gpsRadius}m).`,
      })
      return
    }

    try {
      setSubmitting(true)
      setAlert(null)

      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          accuracy: userLocation.accuracy,
          deviceInfo: navigator.userAgent,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setAlert({ type: 'success', message: json.data.message || 'Check-out thành công!' })
        await loadInitialData()
      } else {
        setAlert({
          type: 'error',
          message: json.message || 'Check-out thất bại. Vui lòng thử lại.',
        })
      }
    } catch (e: any) {
      setAlert({ type: 'error', message: 'Lỗi mạng khi thực hiện check-out' })
    } finally {
      setSubmitting(false)
    }
  }

  // Simulate Branch GPS for test/demo environments if device is far away
  const handleSimulateAtBranch = () => {
    if (!branch) return
    setUserLocation({
      latitude: branch.latitude + 0.00005,
      longitude: branch.longitude + 0.00005,
      accuracy: 12,
    })
    setGpsError(null)
    setAlert({
      type: 'info',
      message: 'Đã mô phỏng vị trí GPS tại chi nhánh (dành cho chế độ kiểm thử / demo).',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-500">Đang tải thông tin chấm công...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Alert banner */}
      {alert && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : alert.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {alert.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {alert.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          {alert.type === 'info' && <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />}
          <div className="flex-1 font-medium">{alert.message}</div>
          <button
            onClick={() => setAlert(null)}
            className="text-gray-400 hover:text-gray-600 text-xs font-semibold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header with live clock */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-600" />
            Chấm công GPS
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-gray-400" />
            {branch ? `${branch.name} — ${branch.address || 'Không có địa chỉ'}` : 'Đang tải chi nhánh...'}
          </p>
        </div>

        {/* Live Digital Clock */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-3 rounded-xl border border-indigo-100">
          <div className="text-right">
            <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
              {currentTime
                ? currentTime.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : '...'}
            </div>
            <div className="text-2xl font-black font-mono text-gray-900 tracking-tight">
              {currentTime
                ? currentTime.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })
                : '--:--:--'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Check-in Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Map & GPS Info (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-semibold text-gray-900">Bản đồ định vị GPS</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateAtBranch}
                  className="text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg font-medium transition"
                  title="Giả lập vị trí tại văn phòng khi test trên PC"
                >
                  ⚡ Giả lập tại VP
                </button>
                <button
                  type="button"
                  onClick={getGpsPosition}
                  disabled={fetchingGps}
                  className="flex items-center gap-1.5 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${fetchingGps ? 'animate-spin' : ''}`} />
                  {fetchingGps ? 'Đang dò GPS...' : 'Cập nhật GPS'}
                </button>
              </div>
            </div>

            {/* GPS Error Alert */}
            {gpsError && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Map Container */}
            <div className="flex-1 min-h-[260px] sm:min-h-[360px] rounded-xl overflow-hidden">
              {branch ? (
                <AttendanceMap
                  branch={branch}
                  userLocation={userLocation}
                  isWithinGeofence={isWithinGeofence}
                  distance={distance}
                />
              ) : (
                <div className="w-full h-full min-h-[260px] sm:min-h-[360px] bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
                  Đang tải vị trí chi nhánh...
                </div>
              )}
            </div>

            {/* GPS Metrics footer */}
            <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-[11px] text-gray-500 font-medium">Khoảng cách tới VP</div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {distance !== null ? `${distance} m` : 'Đang xác định'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-[11px] text-gray-500 font-medium">Bán kính cho phép</div>
                <div className="text-sm font-bold text-indigo-600 mt-0.5">
                  {branch ? `${branch.gpsRadius} m` : '--'}
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-[11px] text-gray-500 font-medium">Độ chính xác GPS</div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">
                  {userLocation?.accuracy ? `±${Math.round(userLocation.accuracy)} m` : '--'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Attendance Status & Action Button (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Status Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Trạng thái hôm nay
              </h2>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  todayStatus?.status === 'CHECKED_OUT'
                    ? 'bg-blue-100 text-blue-800'
                    : todayStatus?.status === 'CHECKED_IN'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {todayStatus?.status === 'CHECKED_OUT'
                  ? 'Đã hoàn thành'
                  : todayStatus?.status === 'CHECKED_IN'
                    ? 'Đang làm việc'
                    : 'Chưa chấm công'}
              </span>
            </div>

            {/* Time Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                  Giờ vào
                </div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  {todayStatus?.checkInTime ? formatVietnamTime(todayStatus.checkInTime) : '--:--'}
                </div>
                {todayStatus?.checkInTime && (
                  <div className="mt-1">
                    {todayStatus.isLate ? (
                      <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        Muộn {todayStatus.lateMinutes}p
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Đúng giờ
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-blue-600" />
                  Giờ ra
                </div>
                <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                  {todayStatus?.checkOutTime ? formatVietnamTime(todayStatus.checkOutTime) : '--:--'}
                </div>
                {todayStatus?.checkOutTime && (
                  <div className="mt-1">
                    {todayStatus.isEarlyLeave ? (
                      <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        Về sớm {todayStatus.earlyMinutes}p
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Đủ giờ
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Work Duration & Work Days Summary */}
            {todayStatus?.status === 'CHECKED_OUT' && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Tổng thời gian làm việc
                  </div>
                  <div className="text-lg font-bold mt-0.5">
                    {todayStatus.workDuration !== null && todayStatus.workDuration !== undefined
                      ? formatDuration(todayStatus.workDuration)
                      : '--'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Công ghi nhận
                  </div>
                  <div className="text-lg font-bold mt-0.5">
                    {todayStatus.workDays ?? 0} công
                  </div>
                </div>
              </div>
            )}

            {/* Geofence status message */}
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                isWithinGeofence
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span>
                {isWithinGeofence
                  ? `Vị trí hợp lệ: Bạn đang cách văn phòng ${distance}m (trong bán kính ${branch?.gpsRadius}m).`
                  : distance !== null
                    ? `Ngoài phạm vi: Bạn đang cách văn phòng ${distance}m (bán kính cho phép: ${branch?.gpsRadius}m).`
                    : 'Đang xác định khoảng cách tới văn phòng...'}
              </span>
            </div>

            {/* Action Buttons */}
            <div>
              {todayStatus?.status === 'NOT_CHECKED_IN' && (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={submitting || !userLocation || !isWithinGeofence}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xử lý Check-in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Check-in GPS ngay
                    </>
                  )}
                </button>
              )}

              {todayStatus?.status === 'CHECKED_IN' && (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={submitting || !userLocation || !isWithinGeofence}
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xử lý Check-out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      Check-out GPS
                    </>
                  )}
                </button>
              )}

              {todayStatus?.status === 'CHECKED_OUT' && (
                <div className="text-center py-3 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Bạn đã hoàn thành chấm công hôm nay!
                </div>
              )}
            </div>

            {/* Schedule Info footnote */}
            {branch?.schedule && (
              <div className="text-[11px] text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                <div className="font-semibold text-gray-700">Quy định ca làm việc:</div>
                <div className="flex justify-between">
                  <span>Khung giờ: {branch.schedule.startTime} – {branch.schedule.endTime}</span>
                  <span>Nghỉ trưa: {branch.schedule.lunchStart} – {branch.schedule.lunchEnd}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Buffer muộn: {branch.schedule.lateThreshold} phút</span>
                  <span>Buffer về sớm: {branch.schedule.earlyThreshold} phút</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent History Table */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            Lịch sử chấm công các ngày gần nhất
          </h2>
          <span className="text-xs text-gray-500 font-medium">
            Hiển thị tối đa 7 ngày gần đây
          </span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Chưa có lịch sử chấm công nào được ghi nhận.
          </div>
        ) : (
          <>
            {/* Mobile Cards (sm:hidden) */}
            <div className="sm:hidden space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 text-sm">
                      {formatVietnamDateDisplay(record.date)}
                    </span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {record.workDays !== null && record.workDays !== undefined
                        ? `${record.workDays} công`
                        : '--'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400 font-medium">Giờ vào</div>
                      <div className="font-mono font-bold text-gray-800 text-sm mt-0.5">
                        {record.checkInTime ? formatVietnamTime(record.checkInTime) : '--'}
                      </div>
                      {record.isLate ? (
                        <span className="inline-block text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded mt-1">
                          Muộn {record.lateMinutes}p
                        </span>
                      ) : record.checkInTime ? (
                        <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1">
                          Đúng giờ
                        </span>
                      ) : null}
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-gray-100">
                      <div className="text-gray-400 font-medium">Giờ ra</div>
                      <div className="font-mono font-bold text-gray-800 text-sm mt-0.5">
                        {record.checkOutTime ? formatVietnamTime(record.checkOutTime) : '--'}
                      </div>
                      {record.isEarlyLeave && (
                        <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1">
                          Về sớm {record.earlyMinutes}p
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 text-gray-500">
                    <span>Thời gian làm việc:</span>
                    <span className="font-semibold text-gray-700">
                      {record.workDuration !== null && record.workDuration !== undefined
                        ? formatDuration(record.workDuration)
                        : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-600 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Ngày</th>
                    <th className="py-3 px-4 font-semibold">Giờ vào</th>
                    <th className="py-3 px-4 font-semibold">Giờ ra</th>
                    <th className="py-3 px-4 font-semibold">Thời gian làm</th>
                    <th className="py-3 px-4 font-semibold">Số công</th>
                    <th className="py-3 px-4 font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {formatVietnamDateDisplay(record.date)}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700">
                        {record.checkInTime ? formatVietnamTime(record.checkInTime) : '--'}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-700">
                        {record.checkOutTime ? formatVietnamTime(record.checkOutTime) : '--'}
                      </td>
                      <td className="py-3 px-4 text-gray-700">
                        {record.workDuration !== null && record.workDuration !== undefined
                          ? formatDuration(record.workDuration)
                          : '--'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {record.workDays !== null && record.workDays !== undefined
                          ? `${record.workDays} công`
                          : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {record.isLate ? (
                            <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              Muộn {record.lateMinutes}p
                            </span>
                          ) : record.checkInTime ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Đúng giờ
                            </span>
                          ) : null}

                          {record.isEarlyLeave && (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Về sớm {record.earlyMinutes}p
                            </span>
                          )}

                          {record.status === 'HALF_DAY' && (
                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              Nửa ngày
                            </span>
                          )}
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
  )
}
