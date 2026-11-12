'use client'

import React, { useState } from 'react'
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Coins,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export interface CompanyData {
  id: string
  name: string
  code: string
  taxCode?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logoUrl?: string | null
  timezone: string
  currency: string
}

interface CompanyProfileTabProps {
  company: CompanyData
  onSuccess: () => void
  isSuperAdmin: boolean
}

export default function CompanyProfileTab({
  company,
  onSuccess,
  isSuperAdmin,
}: CompanyProfileTabProps) {
  const [formData, setFormData] = useState({
    name: company.name || '',
    taxCode: company.taxCode || '',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    timezone: company.timezone || 'Asia/Ho_Chi_Minh',
    currency: company.currency || 'VND',
  })

  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSuperAdmin) return

    setLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Cập nhật không thành công')
      }

      setSuccessMessage('Hồ sơ doanh nghiệp đã được cập nhật thành công!')
      onSuccess()
    } catch (err: any) {
      setErrorMessage(err.message || 'Đã có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Building2 size={18} className="text-indigo-600" />
          <span>Hồ sơ & Thông tin Doanh nghiệp</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Thông tin pháp nhân, thông tin liên hệ và cài đặt bản địa hóa chung
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name and Code */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên doanh nghiệp <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={!isSuperAdmin}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã hệ thống
            </label>
            <input
              type="text"
              disabled
              value={company.code}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-100 text-slate-400 font-mono font-bold"
            />
          </div>
        </div>

        {/* Tax Code & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mã số thuế (MST)
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={!isSuperAdmin}
                placeholder="VD: 0101234567"
                value={formData.taxCode}
                onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              <FileText size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Số điện thoại liên hệ
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={!isSuperAdmin}
                placeholder="VD: 024-3868-9999"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              <Phone size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Address and Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Địa chỉ trụ sở chính
            </label>
            <div className="relative">
              <input
                type="text"
                disabled={!isSuperAdmin}
                placeholder="VD: Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email liên hệ chính thức
            </label>
            <div className="relative">
              <input
                type="email"
                disabled={!isSuperAdmin}
                placeholder="VD: contact@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              <Mail size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Timezone and Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Múi giờ hệ thống
            </label>
            <div className="relative">
              <select
                disabled={!isSuperAdmin}
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 font-medium"
              >
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+07:00 Hà Nội, Bangkok)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+09:00 Tokyo, Seoul)</option>
                <option value="Asia/Singapore">Asia/Singapore (UTC+08:00 Singapore)</option>
                <option value="UTC">UTC (Giờ phối hợp quốc tế)</option>
              </select>
              <Globe size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Đơn vị tiền tệ
            </label>
            <div className="relative">
              <select
                disabled={!isSuperAdmin}
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 font-medium"
              >
                <option value="VND">VND (Việt Nam Đồng - ₫)</option>
                <option value="USD">USD (Đô la Mỹ - $)</option>
                <option value="EUR">EUR (Euro - €)</option>
                <option value="JPY">JPY (Yên Nhật - ¥)</option>
              </select>
              <Coins size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Submit button */}
        {isSuperAdmin && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Đang lưu...' : 'Lưu thông tin doanh nghiệp'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
