'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Building2,
  Clock,
  DollarSign,
  FileText,
  Bell,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import CompanyProfileTab, { CompanyData } from '@/components/settings/CompanyProfileTab'
import AttendanceRulesTab, { SystemSettingsData } from '@/components/settings/AttendanceRulesTab'
import PayrollRulesTab from '@/components/settings/PayrollRulesTab'
import LeavePolicyTab from '@/components/settings/LeavePolicyTab'
import NotificationSecurityTab from '@/components/settings/NotificationSecurityTab'

type SettingsTab = 'company' | 'attendance' | 'payroll' | 'leave' | 'notifications'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company')
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [settings, setSettings] = useState<SystemSettingsData | null>(null)
  const [userRole, setUserRole] = useState<string>('SUPER_ADMIN')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch settings and company
      const res = await fetch('/api/settings')
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Không thể tải cấu hình hệ thống')
      }

      setCompany(json.data.company)
      setSettings(json.data.settings)

      // 2. Fetch role
      const meRes = await fetch('/api/branches/my-branch')
      const meJson = await meRes.json()
      if (meRes.ok && meJson.data?.userRole) {
        setUserRole(meJson.data.userRole)
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu cài đặt')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const tabs = [
    { id: 'company' as SettingsTab, label: 'Hồ sơ Doanh nghiệp', icon: <Building2 size={16} /> },
    { id: 'attendance' as SettingsTab, label: 'Quy tắc Chấm công & GPS', icon: <Clock size={16} /> },
    { id: 'payroll' as SettingsTab, label: 'Bảng lương & Làm thêm giờ', icon: <DollarSign size={16} /> },
    { id: 'leave' as SettingsTab, label: 'Chính sách Nghỉ phép', icon: <FileText size={16} /> },
    { id: 'notifications' as SettingsTab, label: 'Thông báo & Bảo mật', icon: <Bell size={16} /> },
  ]

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2.5">
            <Settings className="text-indigo-600" size={26} />
            <span>Cài đặt & Cấu hình Hệ thống</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Thiết lập thông tin pháp nhân, quy tắc chấm công toàn hệ thống, chu kỳ lương và thông báo
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới cài đặt"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Role permission alert banner */}
      {!isSuperAdmin && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
          <ShieldCheck size={18} className="text-amber-600 shrink-0" />
          <span>
            Bạn đang đăng nhập với quyền Quản trị viên chi nhánh (BRANCH_ADMIN). Bạn có thể xem các quy tắc chung nhưng chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền chỉnh sửa cài đặt hệ thống.
          </span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {loading || !company || !settings ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded w-1/2" />
        </div>
      ) : (
        <>
          {activeTab === 'company' && (
            <CompanyProfileTab
              company={company}
              onSuccess={fetchSettings}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceRulesTab
              settings={settings}
              onSuccess={fetchSettings}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === 'payroll' && (
            <PayrollRulesTab
              settings={settings}
              onSuccess={fetchSettings}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === 'leave' && (
            <LeavePolicyTab
              settings={settings}
              onSuccess={fetchSettings}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationSecurityTab
              settings={settings}
              onSuccess={fetchSettings}
              isSuperAdmin={isSuperAdmin}
            />
          )}
        </>
      )}
    </div>
  )
}
