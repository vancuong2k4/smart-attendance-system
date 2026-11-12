'use client'

import React, { useState, useEffect } from 'react'
import { X, Building2, MapPin, LocateFixed, Phone, Sliders, CheckCircle2, AlertCircle } from 'lucide-react'
import BranchMapPicker from './BranchMapPicker'

export interface BranchFormData {
  id?: string
  name: string
  code: string
  address: string
  phone: string
  latitude: number
  longitude: number
  gpsRadius: number
  isActive: boolean
}

interface BranchFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: BranchFormData | null
}

const DEFAULT_COORDS = {
  latitude: 21.028511, // Ha Noi
  longitude: 105.854444,
  gpsRadius: 100,
}

const PRESET_RADII = [50, 100, 200, 500]

export default function BranchFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: BranchFormModalProps) {
  const isEditing = !!initialData?.id

  const [formData, setFormData] = useState<BranchFormData>({
    name: '',
    code: '',
    address: '',
    phone: '',
    latitude: DEFAULT_COORDS.latitude,
    longitude: DEFAULT_COORDS.longitude,
    gpsRadius: DEFAULT_COORDS.gpsRadius,
    isActive: true,
  })

  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        name: initialData.name || '',
        code: initialData.code || '',
        address: initialData.address || '',
        phone: initialData.phone || '',
        latitude: initialData.latitude || DEFAULT_COORDS.latitude,
        longitude: initialData.longitude || DEFAULT_COORDS.longitude,
        gpsRadius: initialData.gpsRadius || DEFAULT_COORDS.gpsRadius,
        isActive: initialData.isActive ?? true,
      })
    } else {
      setFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        latitude: DEFAULT_COORDS.latitude,
        longitude: DEFAULT_COORDS.longitude,
        gpsRadius: DEFAULT_COORDS.gpsRadius,
        isActive: true,
      })
    }
    setErrorMessage(null)
  }, [initialData, isOpen])

  if (!isOpen) return null

  // Geolocation button: get current device location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Trình duyệt không hỗ trợ xác định vị trí GPS')
      return
    }

    setLocating(true)
    setErrorMessage(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setErrorMessage('Không thể lấy tọa độ vị trí hiện tại: ' + err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleMapCoordChange = (lat: number, lon: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    try {
      const url = isEditing ? `/api/branches/${initialData.id}` : '/api/branches'
      const method = isEditing ? 'PATCH' : 'POST'

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        gpsRadius: formData.gpsRadius,
        isActive: formData.isActive,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Thao tác thất bại')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isEditing ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập thông tin và cấu hình phạm vi chấm công GPS (Geofence)
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Basic Info Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên chi nhánh <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Trụ sở chính Hà Nội"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã chi nhánh <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: HN-HQ"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={isEditing}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-400 font-mono uppercase"
              />
            </div>
          </div>

          {/* Contact Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Địa chỉ chi tiết
              </label>
              <input
                type="text"
                placeholder="VD: Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số điện thoại liên hệ
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="VD: 024-3868-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <Phone size={15} className="absolute left-3 top-2.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Geofence GPS Coordinates & Controls */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <MapPin size={17} className="text-indigo-600" />
                <span>Tọa độ GPS & Bán kính Geofence</span>
              </div>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors disabled:opacity-50"
              >
                <LocateFixed size={14} className={locating ? 'animate-spin' : ''} />
                <span>{locating ? 'Đang định vị...' : 'Lấy vị trí GPS hiện tại'}</span>
              </button>
            </div>

            {/* Inputs: Lat & Lon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Vĩ độ (Latitude)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.latitude}
                  onChange={(e) =>
                    setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Kinh độ (Longitude)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.longitude}
                  onChange={(e) =>
                    setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Radius Slider & Quick Select Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                  <Sliders size={13} />
                  <span>Bán kính cho phép chấm công:</span>
                  <span className="text-indigo-600 font-bold font-mono text-sm">
                    {formData.gpsRadius} mét
                  </span>
                </label>

                {/* Preset quick buttons */}
                <div className="flex items-center gap-1">
                  {PRESET_RADII.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({ ...formData, gpsRadius: r })}
                      className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                        formData.gpsRadius === r
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r}m
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min="20"
                max="1000"
                step="10"
                value={formData.gpsRadius}
                onChange={(e) =>
                  setFormData({ ...formData, gpsRadius: parseInt(e.target.value, 10) })
                }
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>20m (Cực hẹp)</span>
                <span>100m (Tiêu chuẩn văn phòng)</span>
                <span>500m</span>
                <span>1000m (Khu công nghiệp / Nhà máy)</span>
              </div>
            </div>

            {/* Interactive Leaflet Map Picker */}
            <div>
              <BranchMapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                radius={formData.gpsRadius}
                onChange={handleMapCoordChange}
                branchName={formData.name || 'Vị trí chi nhánh'}
              />
            </div>
          </div>

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-sm font-semibold text-slate-800">Trạng thái hoạt động</p>
              <p className="text-xs text-slate-500">
                Cho phép nhân viên thuộc chi nhánh này thực hiện chấm công và xin nghỉ
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo chi nhánh'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
