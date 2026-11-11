'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  RotateCw,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building,
  Briefcase,
  Calendar,
  Mail,
  Phone,
  Key,
  Shield,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Unlock,
} from 'lucide-react'

interface BranchOption {
  id: string
  name: string
  code: string
}

interface DepartmentOption {
  id: string
  branchId: string
  name: string
  code?: string | null
}

interface EmployeeItem {
  id: string
  userId: string
  employeeCode: string
  fullName: string
  dateOfBirth?: string | null
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null
  phoneNumber?: string | null
  address?: string | null
  avatarUrl?: string | null
  position?: string | null
  startDate: string
  endDate?: string | null
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'PROBATION'
  annualLeaveBalance: number
  sickLeaveBalance: number
  createdAt: string
  user: {
    id: string
    email: string
    role: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'HR_MANAGER' | 'EMPLOYEE'
    isActive: boolean
    lastLoginAt?: string | null
  }
  branch: {
    id: string
    name: string
    code: string
  }
  department: {
    id: string
    name: string
    code?: string | null
  }
}

interface StatsData {
  total: number
  active: number
  probation: number
  inactive: number
}

export default function EmployeesPage() {
  const [userRole, setUserRole] = useState<string>('EMPLOYEE')
  const [userBranchId, setUserBranchId] = useState<string>('')
  const [employees, setEmployees] = useState<EmployeeItem[]>([])
  const [stats, setStats] = useState<StatsData>({ total: 0, active: 0, probation: 0, inactive: 0 })
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')

  // Metadata options
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])

  // Modal: Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    position: '',
    branchId: '',
    departmentId: '',
    employmentType: 'FULL_TIME',
    role: 'EMPLOYEE',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isActive: true,
  })

  // Modal: Import Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<{
    total: number
    importedCount: number
    skippedCount: number
    errors: Array<{ row: number; error: string }>
  } | null>(null)

  // Tải thông tin Session & Metadata ban đầu
  useEffect(() => {
    async function initData() {
      try {
        const [sessionRes, branchesRes, deptsRes] = await Promise.all([
          fetch('/api/auth/session').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/branches').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/departments').then((r) => (r.ok ? r.json() : null)),
        ])

        if (sessionRes?.user?.role) {
          setUserRole(sessionRes.user.role)
        }
        if (sessionRes?.user?.employee?.branchId) {
          setUserBranchId(sessionRes.user.employee.branchId)
        }
        if (branchesRes?.data) {
          setBranches(branchesRes.data)
        }
        if (deptsRes?.data) {
          setDepartments(deptsRes.data)
        }
      } catch (err) {
        console.error('Lỗi khi tải metadata:', err)
      }
    }
    initData()
  }, [])

  // Lọc phòng ban theo chi nhánh được chọn trong form
  const availableFormDepartments = useMemo(() => {
    if (!formData.branchId) return departments
    return departments.filter((d) => d.branchId === formData.branchId)
  }, [departments, formData.branchId])

  // Lọc phòng ban theo chi nhánh được chọn trong bộ lọc
  const availableFilterDepartments = useMemo(() => {
    if (!selectedBranch) return departments
    return departments.filter((d) => d.branchId === selectedBranch)
  }, [departments, selectedBranch])

  // Tải danh sách nhân viên
  const fetchEmployees = useCallback(
    async (pageToLoad = pagination.page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(pageToLoad))
        params.set('limit', String(pagination.limit))

        if (search.trim()) params.set('search', search.trim())
        if (selectedBranch) params.set('branchId', selectedBranch)
        if (selectedDepartment) params.set('departmentId', selectedDepartment)
        if (selectedStatus && selectedStatus !== 'ALL') params.set('status', selectedStatus)

        const res = await fetch(`/api/employees?${params.toString()}`)
        const json = await res.json()

        if (json.success && json.data) {
          setEmployees(json.data.employees || [])
          if (json.data.pagination) {
            setPagination(json.data.pagination)
          }
          if (json.data.stats) {
            setStats(json.data.stats)
          }
        } else {
          setAlert({ type: 'error', message: json.message || 'Không thể tải danh sách nhân viên' })
        }
      } catch (err: any) {
        console.error('Lỗi tải danh sách nhân viên:', err)
        setAlert({ type: 'error', message: 'Lỗi mạng khi tải dữ liệu nhân viên' })
      } finally {
        setLoading(false)
      }
    },
    [pagination.limit, pagination.page, search, selectedBranch, selectedDepartment, selectedStatus]
  )

  useEffect(() => {
    fetchEmployees(1)
  }, [search, selectedBranch, selectedDepartment, selectedStatus])

  // Tự ẩn thông báo sau 4 giây
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [alert])

  // Mở modal Thêm mới
  const handleOpenAddModal = () => {
    setEditingEmployee(null)
    const initialBranchId =
      userRole === 'BRANCH_ADMIN' && userBranchId
        ? userBranchId
        : (branches[0]?.id || '')
    const branchDepts = departments.filter((d) => d.branchId === initialBranchId)

    setFormData({
      employeeCode: '',
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      position: '',
      branchId: initialBranchId,
      departmentId: branchDepts[0]?.id || '',
      employmentType: 'FULL_TIME',
      role: 'EMPLOYEE',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isActive: true,
    })
    setIsModalOpen(true)
  }

  // Mở modal Sửa
  const handleOpenEditModal = (emp: EmployeeItem) => {
    setEditingEmployee(emp)
    setFormData({
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      email: emp.user.email,
      password: '',
      phoneNumber: emp.phoneNumber || '',
      position: emp.position || '',
      branchId: emp.branch.id,
      departmentId: emp.department.id,
      employmentType: emp.employmentType,
      role: emp.user.role,
      startDate: emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : '',
      endDate: emp.endDate ? new Date(emp.endDate).toISOString().split('T')[0] : '',
      isActive: emp.user.isActive,
    })
    setIsModalOpen(true)
  }

  // Submit Form Thêm / Sửa
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormSubmitting(true)

    try {
      if (editingEmployee) {
        // Cập nhật
        const payload: any = {
          fullName: formData.fullName,
          employeeCode: formData.employeeCode,
          email: formData.email,
          phoneNumber: formData.phoneNumber || null,
          position: formData.position || null,
          branchId: formData.branchId,
          departmentId: formData.departmentId,
          employmentType: formData.employmentType,
          role: formData.role,
          startDate: formData.startDate,
          endDate: formData.endDate ? formData.endDate : null,
          isActive: formData.isActive,
        }
        if (formData.password && formData.password.trim()) {
          payload.password = formData.password.trim()
        }

        const res = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()

        if (json.success) {
          setAlert({ type: 'success', message: 'Cập nhật thông tin nhân viên thành công!' })
          setIsModalOpen(false)
          fetchEmployees()
        } else {
          setAlert({ type: 'error', message: json.message || 'Cập nhật thất bại' })
        }
      } else {
        // Thêm mới
        const payload: any = {
          fullName: formData.fullName,
          employeeCode: formData.employeeCode,
          email: formData.email,
          phoneNumber: formData.phoneNumber || undefined,
          position: formData.position || undefined,
          branchId: formData.branchId,
          departmentId: formData.departmentId,
          employmentType: formData.employmentType,
          role: formData.role,
          startDate: formData.startDate,
        }
        if (formData.password && formData.password.trim()) {
          payload.password = formData.password.trim()
        }

        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()

        if (json.success) {
          setAlert({ type: 'success', message: 'Thêm nhân viên mới thành công!' })
          setIsModalOpen(false)
          fetchEmployees(1)
        } else {
          setAlert({ type: 'error', message: json.message || 'Thêm nhân viên thất bại' })
        }
      }
    } catch (err: any) {
      console.error('Lỗi lưu nhân viên:', err)
      setAlert({ type: 'error', message: 'Đã xảy ra lỗi khi lưu thông tin nhân viên' })
    } finally {
      setFormSubmitting(false)
    }
  }

  // Khóa / Mở khóa hoặc Cho thôi việc mềm
  const handleToggleActive = async (emp: EmployeeItem) => {
    const isCurrentlyActive = emp.user.isActive
    const actionText = isCurrentlyActive ? 'khóa tài khoản / cho thôi việc' : 'kích hoạt lại tài khoản'

    if (!confirm(`Bạn có chắc chắn muốn ${actionText} cho nhân viên ${emp.fullName} (${emp.employeeCode})?`)) {
      return
    }

    try {
      if (isCurrentlyActive) {
        // Soft delete endpoint
        const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) {
          setAlert({ type: 'success', message: `Đã cho thôi việc nhân viên ${emp.fullName}` })
          fetchEmployees()
        } else {
          setAlert({ type: 'error', message: json.message || 'Thao tác thất bại' })
        }
      } else {
        // Kích hoạt lại
        const res = await fetch(`/api/employees/${emp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true, endDate: null }),
        })
        const json = await res.json()
        if (json.success) {
          setAlert({ type: 'success', message: `Đã kích hoạt lại tài khoản cho ${emp.fullName}` })
          fetchEmployees()
        } else {
          setAlert({ type: 'error', message: json.message || 'Thao tác thất bại' })
        }
      }
    } catch (err) {
      console.error('Lỗi khi thay đổi trạng thái nhân viên:', err)
      setAlert({ type: 'error', message: 'Lỗi mạng khi thay đổi trạng thái' })
    }
  }

  // Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    window.location.href = '/api/employees/template'
  }

  // Xử lý Import Excel
  const handleImportExcel = async () => {
    if (!importFile) {
      setAlert({ type: 'error', message: 'Vui lòng chọn file Excel trước khi tiến hành nhập' })
      return
    }

    setImporting(true)
    setImportReport(null)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', importFile)

      const res = await fetch('/api/employees/import', {
        method: 'POST',
        body: formDataUpload,
      })
      const json = await res.json()

      if (json.success && json.data) {
        setImportReport(json.data)
        if (json.data.importedCount > 0) {
          fetchEmployees(1)
        }
      } else {
        setAlert({ type: 'error', message: json.message || 'Không thể nhập file Excel' })
      }
    } catch (err: any) {
      console.error('Lỗi import excel:', err)
      setAlert({ type: 'error', message: 'Lỗi mạng khi tải lên file Excel' })
    } finally {
      setImporting(false)
    }
  }

  const getStatusBadge = (emp: EmployeeItem) => {
    if (!emp.user.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <UserX size={12} /> Đã nghỉ việc
        </span>
      )
    }
    if (emp.employmentType === 'PROBATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} /> Thử việc
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <UserCheck size={12} /> Đang làm việc
      </span>
    )
  }

  const getEmploymentTypeLabel = (type: string) => {
    switch (type) {
      case 'FULL_TIME':
        return 'Chính thức'
      case 'PART_TIME':
        return 'Bán thời gian'
      case 'PROBATION':
        return 'Thử việc'
      case 'CONTRACT':
        return 'Hợp đồng vụ việc'
      default:
        return type
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Quản trị cấp cao'
      case 'HR_MANAGER':
        return 'Quản lý Nhân sự'
      case 'BRANCH_ADMIN':
        return 'Quản trị Chi nhánh'
      default:
        return 'Nhân viên'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Thông báo Alert */}
      {alert && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-xs transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {alert.type === 'success' ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-medium">{alert.message}</p>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header & Các nút Hành động */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Quản lý Nhân sự & Hồ sơ Nhân viên
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh sách nhân sự, phân quyền tài khoản và nhập dữ liệu hàng loạt từ Excel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 shadow-xs transition-colors"
            title="Tải file mẫu Excel chuẩn để nhập dữ liệu"
          >
            <Download size={16} className="text-gray-500" />
            Tải file mẫu Excel
          </button>

          <button
            onClick={() => {
              setImportReport(null)
              setImportFile(null)
              setIsImportModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 shadow-xs transition-colors"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            Nhập từ Excel
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors"
          >
            <UserPlus size={16} />
            Thêm nhân viên
          </button>
        </div>
      </div>

      {/* Thẻ Thống kê Nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng nhân sự</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Đang làm việc</div>
            <div className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.active}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Thử việc</div>
            <div className="text-2xl font-bold text-amber-600 mt-0.5">{stats.probation}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <UserX size={24} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Đã nghỉ việc</div>
            <div className="text-2xl font-bold text-rose-600 mt-0.5">{stats.inactive}</div>
          </div>
        </div>
      </div>

      {/* Bộ Lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, mã NV, email hoặc SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lọc Chi nhánh (cho Quản trị viên & HR) */}
          {['SUPER_ADMIN', 'HR_MANAGER'].includes(userRole) && (
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
                setSelectedDepartment('')
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả Chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}

          {/* Lọc Phòng ban */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả Phòng ban</option>
            {availableFilterDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Lọc Trạng thái */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả Trạng thái</option>
            <option value="ACTIVE">Đang làm việc</option>
            <option value="PROBATION">Thử việc</option>
            <option value="INACTIVE">Đã nghỉ việc</option>
          </select>

          <button
            onClick={() => fetchEmployees()}
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            title="Làm mới dữ liệu"
          >
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Bảng Danh sách Nhân viên */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Nhân viên</th>
                <th className="py-3.5 px-4">Mã NV</th>
                <th className="py-3.5 px-4">Liên hệ</th>
                <th className="py-3.5 px-4">Phòng ban / Chi nhánh</th>
                <th className="py-3.5 px-4">Chức vụ & Loại HĐ</th>
                <th className="py-3.5 px-4">Vai trò</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading && employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <RotateCw className="animate-spin inline-block mr-2 text-blue-600" size={20} />
                    Đang tải dữ liệu nhân viên...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    Không tìm thấy nhân viên nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Cột Tên & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-xs shrink-0 uppercase">
                          {emp.fullName
                            .split(' ')
                            .map((w) => w[0])
                            .slice(-2)
                            .join('')}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.fullName}</div>
                          <div className="text-xs text-gray-500">
                            Ngày vào: {new Date(emp.startDate).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cột Mã NV */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                        {emp.employeeCode}
                      </span>
                    </td>

                    {/* Cột Liên hệ */}
                    <td className="py-3.5 px-4">
                      <div className="text-gray-900">{emp.user.email}</div>
                      <div className="text-xs text-gray-500">{emp.phoneNumber || '—'}</div>
                    </td>

                    {/* Cột Phòng ban / Chi nhánh */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-gray-900">{emp.department.name}</div>
                      <div className="text-xs text-gray-500">{emp.branch.name}</div>
                    </td>

                    {/* Cột Chức vụ & Loại HĐ */}
                    <td className="py-3.5 px-4">
                      <div className="text-gray-900">{emp.position || 'Nhân viên'}</div>
                      <div className="text-xs text-gray-500">{getEmploymentTypeLabel(emp.employmentType)}</div>
                    </td>

                    {/* Cột Vai trò */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-700 font-medium">
                        <Shield size={12} className="text-blue-500" />
                        {getRoleLabel(emp.user.role)}
                      </span>
                    </td>

                    {/* Cột Trạng thái */}
                    <td className="py-3.5 px-4">{getStatusBadge(emp)}</td>

                    {/* Cột Thao tác */}
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Chỉnh sửa hồ sơ"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => handleToggleActive(emp)}
                        className={`p-1.5 rounded-md transition-colors ${
                          emp.user.isActive
                            ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={emp.user.isActive ? 'Cho thôi việc / Khóa tài khoản' : 'Kích hoạt lại tài khoản'}
                      >
                        {emp.user.isActive ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <div>
            Hiển thị{' '}
            <span className="font-medium text-gray-900">
              {employees.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            -{' '}
            <span className="font-medium text-gray-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            trong tổng số <span className="font-medium text-gray-900">{pagination.total}</span> nhân viên
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEmployees(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-gray-700">
              Trang {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchEmployees(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh sửa Nhân viên */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {editingEmployee ? <Edit2 size={18} className="text-blue-600" /> : <UserPlus size={18} className="text-blue-600" />}
                {editingEmployee ? 'Chỉnh sửa hồ sơ nhân viên' : 'Thêm nhân viên mới'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung Form */}
            <form onSubmit={handleSaveEmployee} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ tên */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Mã nhân viên */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Mã nhân viên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })}
                    placeholder="NV001"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Email tài khoản <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@company.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Mật khẩu */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>{editingEmployee ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu khởi tạo'}</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingEmployee ? '••••••••' : 'Mặc định: Nv@123456'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Chức danh / Vị trí */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Chức danh / Vị trí
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Chuyên viên Kinh doanh"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Chi nhánh */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Chi nhánh <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    disabled={userRole === 'BRANCH_ADMIN'}
                    value={formData.branchId}
                    onChange={(e) => {
                      const newBranchId = e.target.value
                      setFormData((prev) => {
                        const deptsForNewBranch = departments.filter((d) => d.branchId === newBranchId)
                        return {
                          ...prev,
                          branchId: newBranchId,
                          departmentId: deptsForNewBranch[0]?.id || '',
                        }
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phòng ban */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Phòng ban <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {availableFormDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loại hợp đồng */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Loại hợp đồng
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="FULL_TIME">Chính thức (Toàn thời gian)</option>
                    <option value="PROBATION">Thử việc</option>
                    <option value="PART_TIME">Bán thời gian</option>
                    <option value="CONTRACT">Hợp đồng vụ việc</option>
                  </select>
                </div>

                {/* Vai trò */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Vai trò hệ thống
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="EMPLOYEE">Nhân viên (EMPLOYEE)</option>
                    {['SUPER_ADMIN', 'HR_MANAGER'].includes(userRole) && (
                      <>
                        <option value="BRANCH_ADMIN">Quản trị Chi nhánh (BRANCH_ADMIN)</option>
                        <option value="HR_MANAGER">Quản lý Nhân sự (HR_MANAGER)</option>
                      </>
                    )}
                    {userRole === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Quản trị Cấp cao (SUPER_ADMIN)</option>
                    )}
                  </select>
                </div>

                {/* Ngày vào làm */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Ngày vào làm
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ngày nghỉ việc (chỉ hiển thị khi sửa) */}
                {editingEmployee && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Ngày thôi việc (nếu có)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Trạng thái hoạt động (khi sửa) */}
              {editingEmployee && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Tài khoản đang hoạt động</span>
                  </label>
                </div>
              )}

              {/* Nút hành động trong Modal */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {formSubmitting && <RotateCw className="animate-spin" size={16} />}
                  {editingEmployee ? 'Lưu thay đổi' : 'Tạo nhân viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Nhân viên từ Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-600" />
                Nhập danh sách nhân viên từ Excel
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nội dung Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Box chọn file */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) {
                    setImportFile(file)
                    setImportReport(null)
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/75 scale-[1.01]'
                    : 'border-gray-200 hover:border-emerald-500 bg-gray-50/50'
                }`}
              >
                <Upload size={36} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-sm font-medium text-gray-800">
                  Kéo thả file Excel (.xlsx) vào đây, hoặc click để chọn file
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Đảm bảo sử dụng file theo đúng định dạng mẫu để hệ thống nhận diện chính xác
                </p>

                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImportFile(file)
                      setImportReport(null)
                    }
                  }}
                  className="hidden"
                  id="excel-file-input"
                />

                <div className="mt-4 flex items-center justify-center gap-3">
                  <label
                    htmlFor="excel-file-input"
                    className="cursor-pointer px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 shadow-xs transition-colors"
                  >
                    Chọn file từ máy tính
                  </label>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 text-emerald-700 bg-emerald-50 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download size={14} /> Tải file mẫu
                  </button>
                </div>

                {importFile && (
                  <div className="mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 py-1.5 px-3 rounded-md inline-block">
                    File đã chọn: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {/* Báo cáo kết quả Import */}
              {importReport && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Kết quả xử lý file
                  </h3>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                      <div className="text-xs text-gray-500">Tổng số dòng</div>
                      <div className="text-lg font-bold text-gray-900 mt-0.5">{importReport.total}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <div className="text-xs text-emerald-700">Thành công</div>
                      <div className="text-lg font-bold text-emerald-700 mt-0.5">{importReport.importedCount}</div>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
                      <div className="text-xs text-rose-700">Bị bỏ qua / Lỗi</div>
                      <div className="text-lg font-bold text-rose-700 mt-0.5">{importReport.skippedCount}</div>
                    </div>
                  </div>

                  {/* Danh sách lỗi chi tiết nếu có */}
                  {importReport.errors.length > 0 && (
                    <div className="mt-3 border border-rose-200 rounded-xl overflow-hidden">
                      <div className="bg-rose-50/75 px-3 py-2 text-xs font-bold text-rose-800 uppercase tracking-wider border-b border-rose-200">
                        Chi tiết các dòng bị lỗi ({importReport.errors.length})
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-rose-100 bg-white">
                        {importReport.errors.map((err, idx) => (
                          <div key={idx} className="p-2.5 text-xs flex items-start gap-2">
                            <span className="font-semibold text-rose-700 shrink-0">Dòng {err.row}:</span>
                            <span className="text-gray-700">{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleImportExcel}
                disabled={!importFile || importing}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {importing && <RotateCw className="animate-spin" size={16} />}
                Tiến hành nhập dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
