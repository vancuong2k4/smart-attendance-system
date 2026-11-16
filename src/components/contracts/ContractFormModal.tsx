'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  FileText,
  User,
  Calendar,
  DollarSign,
  Briefcase,
  Clock,
  Sparkles,
  AlertCircle,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { ContractType, ContractStatus } from '@prisma/client'
import { CONTRACT_TYPE_MAP, CONTRACT_STATUS_MAP } from '@/lib/contracts'

export interface ContractFormData {
  id?: string
  contractNumber: string
  employeeId: string
  contractType: ContractType
  status: ContractStatus
  jobTitle: string
  signDate: string
  startDate: string
  endDate?: string | null
  grossSalary: number
  insuranceSalary: number
  workingHoursPerWeek: number
  signerName?: string | null
  signerRole?: string | null
  fileUrl?: string | null
  notes?: string | null
}

interface EmployeeOption {
  id: string
  fullName: string
  employeeCode: string
  position?: string
  branch?: { name: string }
}

interface ContractFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialData?: Partial<ContractFormData> | null
  isRenewal?: boolean
}

export function ContractFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  isRenewal = false,
}: ContractFormModalProps) {
  const isEditing = !!initialData?.id && !isRenewal

  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState<ContractFormData>({
    contractNumber: '',
    employeeId: '',
    contractType: ContractType.DEFINITE_TERM,
    status: ContractStatus.ACTIVE,
    jobTitle: '',
    signDate: new Date().toISOString().split('T')[0],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    grossSalary: 10000000,
    insuranceSalary: 5000000,
    workingHoursPerWeek: 40,
    signerName: '',
    signerRole: 'Giám đốc Nhân sự',
    fileUrl: '',
    notes: '',
  })

  // Sinh mã hợp đồng ngẫu nhiên chuẩn
  const generateContractNumber = (type: ContractType) => {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const random = Math.floor(1000 + Math.random() * 9000)
    const prefix =
      type === ContractType.PROBATION
        ? 'HDTV'
        : type === ContractType.SEASONAL
          ? 'HDTVU'
          : type === ContractType.INTERNSHIP
            ? 'HDTT'
            : 'HDLD'
    return `${prefix}-${year}${month}-${random}`
  }

  // Tải danh sách nhân viên
  useEffect(() => {
    if (isOpen) {
      setLoadingEmployees(true)
      fetch('/api/employees?limit=200')
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data?.employees)) {
            setEmployees(json.data.employees)
          } else if (Array.isArray(json.data)) {
            setEmployees(json.data)
          }
        })
        .catch((err) => console.error('Failed to load employees:', err))
        .finally(() => setLoadingEmployees(false))
    }
  }, [isOpen])

  // Cập nhật formData khi initialData thay đổi
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      if (initialData) {
        setFormData({
          id: isRenewal ? undefined : initialData.id,
          contractNumber: isRenewal
            ? generateContractNumber(
                initialData.contractType || ContractType.DEFINITE_TERM
              )
            : initialData.contractNumber ||
              generateContractNumber(ContractType.DEFINITE_TERM),
          employeeId: initialData.employeeId || '',
          contractType:
            initialData.contractType || ContractType.DEFINITE_TERM,
          status: isRenewal
            ? ContractStatus.ACTIVE
            : initialData.status || ContractStatus.ACTIVE,
          jobTitle: initialData.jobTitle || '',
          signDate:
            initialData.signDate?.substring(0, 10) ||
            new Date().toISOString().split('T')[0],
          startDate:
            initialData.startDate?.substring(0, 10) ||
            new Date().toISOString().split('T')[0],
          endDate: initialData.endDate ? initialData.endDate.substring(0, 10) : '',
          grossSalary: initialData.grossSalary ?? 10000000,
          insuranceSalary: initialData.insuranceSalary ?? 5000000,
          workingHoursPerWeek: initialData.workingHoursPerWeek ?? 40,
          signerName: initialData.signerName || '',
          signerRole: initialData.signerRole || 'Giám đốc Nhân sự',
          fileUrl: initialData.fileUrl || '',
          notes: initialData.notes || '',
        })
      } else {
        setFormData({
          contractNumber: generateContractNumber(ContractType.DEFINITE_TERM),
          employeeId: '',
          contractType: ContractType.DEFINITE_TERM,
          status: ContractStatus.ACTIVE,
          jobTitle: '',
          signDate: new Date().toISOString().split('T')[0],
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          grossSalary: 10000000,
          insuranceSalary: 5000000,
          workingHoursPerWeek: 40,
          signerName: '',
          signerRole: 'Giám đốc Nhân sự',
          fileUrl: '',
          notes: '',
        })
      }
    }
  }, [isOpen, initialData, isRenewal])

  // Tự động gợi ý ngày kết thúc theo loại hợp đồng
  const applyDurationPreset = (months: number | null) => {
    if (months === null) {
      setFormData((prev) => ({ ...prev, endDate: '' }))
      return
    }
    const start = formData.startDate ? new Date(formData.startDate) : new Date()
    const end = new Date(start)
    end.setMonth(end.getMonth() + months)
    end.setDate(end.getDate() - 1)
    setFormData((prev) => ({
      ...prev,
      endDate: end.toISOString().split('T')[0],
    }))
  }

  // Khi chọn nhân viên, tự điền chức danh nếu còn trống
  const handleEmployeeChange = (empId: string) => {
    const selected = employees.find((e) => e.id === empId)
    setFormData((prev) => ({
      ...prev,
      employeeId: empId,
      jobTitle: prev.jobTitle || selected?.position || '',
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!formData.employeeId) {
      setErrorMessage('Vui lòng chọn nhân sự áp dụng hợp đồng')
      return
    }
    if (!formData.contractNumber.trim()) {
      setErrorMessage('Mã hợp đồng không được để trống')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        ...formData,
        grossSalary: Number(formData.grossSalary),
        insuranceSalary: Number(formData.insuranceSalary),
        workingHoursPerWeek: Number(formData.workingHoursPerWeek),
        endDate: formData.endDate ? formData.endDate : null,
      }

      const url =
        isEditing && formData.id
          ? `/api/contracts/${formData.id}`
          : '/api/contracts'
      const method = isEditing && formData.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Lỗi khi lưu thông tin hợp đồng')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isRenewal
                  ? 'Gia hạn Hợp đồng Lao động'
                  : isEditing
                    ? 'Cập nhật Hợp đồng Lao động'
                    : 'Tạo mới Hợp đồng Lao động'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRenewal
                  ? 'Ký tiếp hoặc nâng hạng hợp đồng mới cho nhân sự'
                  : 'Điền đầy đủ các điều khoản hợp đồng và thông tin lương'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Thông tin cơ bản */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Thông tin pháp lý & Nhân sự
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nhân viên */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nhân viên áp dụng <span className="text-rose-500">*</span>
                </label>
                <select
                  disabled={isEditing || isRenewal}
                  value={formData.employeeId}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
                >
                  <option value="">-- Chọn nhân sự --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode})
                      {emp.branch?.name ? ` - ${emp.branch.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mã hợp đồng */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Số hợp đồng <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        contractNumber: generateContractNumber(prev.contractType),
                      }))
                    }
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Tự sinh mã
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.contractNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, contractNumber: e.target.value })
                  }
                  placeholder="HDLD-202611-0001"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Loại hợp đồng */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Loại hợp đồng <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.contractType}
                  onChange={(e) => {
                    const ct = e.target.value as ContractType
                    setFormData((prev) => ({
                      ...prev,
                      contractType: ct,
                      contractNumber: generateContractNumber(ct),
                    }))
                    if (ct === ContractType.INDEFINITE_TERM) {
                      applyDurationPreset(null)
                    } else if (ct === ContractType.PROBATION) {
                      applyDurationPreset(2)
                    } else if (ct === ContractType.DEFINITE_TERM) {
                      applyDurationPreset(12)
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {Object.entries(CONTRACT_TYPE_MAP).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chức danh công việc */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chức danh / Vị trí đảm nhiệm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, jobTitle: e.target.value })
                  }
                  placeholder="Kỹ sư phần mềm / Chuyên viên Marketing"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Thời hạn hợp đồng */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Thời hạn & Ngày ký
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Gợi ý hạn:</span>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(2)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                >
                  2 tháng
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(12)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                >
                  1 năm
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(36)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                >
                  3 năm
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(null)}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px]"
                >
                  Vô thời hạn
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ngày ký hợp đồng
                </label>
                <input
                  type="date"
                  value={formData.signDate}
                  onChange={(e) =>
                    setFormData({ ...formData, signDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ngày có hiệu lực <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ngày hết hạn (để trống nếu vô thời hạn)
                </label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Chế độ đãi ngộ & Lương */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Mức lương & Giờ làm việc
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tổng mức lương (Gross) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="500000"
                  min="0"
                  value={formData.grossSalary}
                  onChange={(e) =>
                    setFormData({ ...formData, grossSalary: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500 font-medium">
                  {formData.grossSalary.toLocaleString('vi-VN')} ₫/tháng
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Lương đóng BHXH
                </label>
                <input
                  type="number"
                  step="500000"
                  min="0"
                  value={formData.insuranceSalary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      insuranceSalary: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500 font-medium">
                  {formData.insuranceSalary.toLocaleString('vi-VN')} ₫/tháng
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Giờ làm việc / Tuần
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.workingHoursPerWeek}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      workingHoursPerWeek: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">Tiêu chuẩn: 40 giờ/tuần</p>
              </div>
            </div>
          </div>

          {/* Section 4: Đại diện ký & Ghi chú */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Đại diện người sử dụng lao động & Trạng thái
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Họ tên người ký
                </label>
                <input
                  type="text"
                  value={formData.signerName || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, signerName: e.target.value })
                  }
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chức vụ người ký
                </label>
                <input
                  type="text"
                  value={formData.signerRole || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, signerRole: e.target.value })
                  }
                  placeholder="Giám đốc Điều hành / Trưởng phòng HC-NS"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Trạng thái hợp đồng
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as ContractStatus,
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value={ContractStatus.ACTIVE}>Đang hiệu lực (ACTIVE)</option>
                  <option value={ContractStatus.DRAFT}>Bản nháp (DRAFT)</option>
                  <option value={ContractStatus.TERMINATED}>Đã thanh lý (TERMINATED)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ghi chú điều khoản bổ sung
              </label>
              <textarea
                rows={2}
                value={formData.notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Điều khoản bảo mật, phụ cấp ăn trưa, công tác phí,..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Ký hợp đồng'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default ContractFormModal
