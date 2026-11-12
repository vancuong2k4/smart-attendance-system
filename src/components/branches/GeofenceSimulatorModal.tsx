'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Compass,
  MapPin,
  LocateFixed,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { formatDistance } from '@/lib/geofence'

export interface SimulatorBranchInfo {
  id: string
  name: string
  code: string
  latitude: number
  longitude: number
  gpsRadius: number
}

interface GeofenceSimulatorModalProps {
  isOpen: boolean
  onClose: () => void
  branch: SimulatorBranchInfo | null
}

// Inner dynamic map for Simulator with polyline support
const DynamicSimulatorMap = dynamic(
  () => import('./GeofenceSimulatorMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[340px] rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2 border border-slate-200">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium text-slate-500">Đang khởi tạo bản đồ thử nghiệm...</span>
      </div>
    ),
  }
)

export default function GeofenceSimulatorModal({
  isOpen,
  onClose,
  branch,
}: GeofenceSimulatorModalProps) {
  if (!isOpen || !branch) return null

  const [testCoords, setTestCoords] = useState<{ lat: number; lng: number }>({
    lat: branch.latitude,
    lng: branch.longitude,
  })

  const [result, setResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Auto-run test whenever testCoords change
  useEffect(() => {
    runGeofenceTest(testCoords.lat, testCoords.lng)
  }, [testCoords, branch])

  const runGeofenceTest = async (lat: number, lng: number, accuracy?: number) => {
    setTesting(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/branches/${branch.id}/test-geofence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: accuracy ?? null,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Không thể kiểm tra tọa độ')
      }

      setResult(json.data)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi gọi API kiểm tra')
    } finally {
      setTesting(false)
    }
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Trình duyệt không hỗ trợ xác định vị trí GPS')
      return
    }

    setLocating(true)
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        const accuracy = Math.round(pos.coords.accuracy)

        setTestCoords({ lat, lng })
        runGeofenceTest(lat, lng, accuracy)
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setErrorMsg('Không thể lấy tọa độ vị trí hiện tại: ' + err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Compass size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">Thử nghiệm Geofence GPS</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {branch.code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Kiểm tra tọa độ bất kỳ hoặc vị trí thực tế xem có nằm trong bán kính chấm công của{' '}
                <strong className="text-slate-700">{branch.name}</strong> ({branch.gpsRadius}m) không
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
              <Info size={14} className="text-indigo-600" />
              <span>Click trực tiếp lên bản đồ để di chuyển điểm thử nghiệm</span>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <LocateFixed size={14} className={locating ? 'animate-spin' : ''} />
              <span>{locating ? 'Đang định vị...' : 'Sử dụng GPS thiết bị hiện tại'}</span>
            </button>
          </div>

          {/* Interactive Map */}
          <div>
            <DynamicSimulatorMap
              branchLat={branch.latitude}
              branchLon={branch.longitude}
              branchRadius={branch.gpsRadius}
              branchName={branch.name}
              testLat={testCoords.lat}
              testLon={testCoords.lng}
              isInside={result?.isInside ?? true}
              onSelectTestPoint={(lat, lng) => setTestCoords({ lat, lng })}
            />
          </div>

          {/* Result Card */}
          {result && (
            <div
              className={`p-4 rounded-xl border transition-all ${
                result.isInside
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      result.isInside
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {result.isInside ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <span>{result.isInside ? 'HỢP LỆ: TRONG VÙNG CHẤM CÔNG' : 'NGOÀI BÁN KÍNH CHO PHÉP'}</span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold ${
                          result.isInside
                            ? 'bg-emerald-200 text-emerald-800'
                            : 'bg-rose-200 text-rose-800'
                        }`}
                      >
                        {result.verdict}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 opacity-90">{result.message}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold opacity-75">Khoảng cách</div>
                  <div className="text-lg font-bold font-mono">
                    {result.distanceMeters} m
                  </div>
                  <div className="text-[10px] opacity-75">
                    Tối đa: {result.branchRadius} m
                  </div>
                </div>
              </div>

              {/* Coordinates comparison */}
              <div className="mt-3 pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 opacity-80">
                  <MapPin size={12} />
                  <span>Tâm chi nhánh: {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-80">
                  <ArrowRight size={12} />
                  <span>Điểm thử: {testCoords.lat.toFixed(6)}, {testCoords.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
