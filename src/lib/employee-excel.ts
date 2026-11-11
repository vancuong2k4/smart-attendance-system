import * as XLSX from 'xlsx'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { EmploymentType, UserRole } from '@prisma/client'

export interface ParsedEmployeeRow {
  rowNumber: number
  employeeCode: string
  fullName: string
  email: string
  phoneNumber?: string
  position?: string
  branchIdentifier: string
  departmentIdentifier: string
  employmentType: EmploymentType
  startDate: Date
  role: UserRole
}

export interface ImportErrorItem {
  row: number
  error: string
}

export interface ImportReport {
  total: number
  importedCount: number
  skippedCount: number
  errors: ImportErrorItem[]
}

/**
 * Chuẩn hoá tên cột: loại bỏ các ghi chú bắt buộc, ký tự đặc biệt, khoảng trắng
 */
function cleanColumnKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/\((?:bắt buộc|bat buoc|required|\*)\)/gi, '')
    .replace(/[\s*_():-]/g, '')
    .trim()
}

/**
 * Tìm giá trị từ hàng theo các tên cột khả dĩ (không phân biệt hoa thường, khoảng trắng)
 */
export function getFieldValue(row: Record<string, any>, ...aliases: string[]): any {
  const rowKeys = Object.keys(row)

  for (const alias of aliases) {
    // 1. Khớp chính xác key gốc trước
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return row[alias]
    }

    const cleanAlias = cleanColumnKey(alias)

    // 2. Khớp chính xác theo key đã chuẩn hóa (bỏ dấu ngoặc, sao, khoảng trắng)
    const matchingKey = rowKeys.find((key) => {
      return cleanColumnKey(key) === cleanAlias
    })

    if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
      const val = row[matchingKey]
      if (String(val).trim() !== '') return val
    }
  }

  return undefined
}

/**
 * Parse chuỗi ngày hoặc số ngày Excel sang Date
 */
export function parseExcelDate(val: any): Date | null {
  if (!val) return null

  // Nếu là Date object sẵn
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val
  }

  // Nếu là số serial Excel (ví dụ 45300)
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000))
    return isNaN(date.getTime()) ? null : date
  }

  const str = String(val).trim()
  if (!str) return null

  // Định dạng DD/MM/YYYY hoặc DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10) - 1
    const year = parseInt(dmyMatch[3], 10)
    const d = new Date(Date.UTC(year, month, day))
    return isNaN(d.getTime()) ? null : d
  }

  // Định dạng YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10) - 1
    const day = parseInt(ymdMatch[3], 10)
    const d = new Date(Date.UTC(year, month, day))
    return isNaN(d.getTime()) ? null : d
  }

  // Thử parse qua Date.parse
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Chuẩn hoá loại hợp đồng
 */
export function normalizeEmploymentType(rawVal: any): EmploymentType {
  if (!rawVal) return EmploymentType.FULL_TIME
  const val = String(rawVal).trim().toUpperCase()

  if (val.includes('THỬ VIỆC') || val.includes('THU VIEC') || val === 'PROBATION') {
    return EmploymentType.PROBATION
  }
  if (val.includes('BÁN THỜI GIAN') || val.includes('BAN THOI GIAN') || val === 'PART_TIME' || val === 'PARTTIME') {
    return EmploymentType.PART_TIME
  }
  if (val.includes('HỢP ĐỒNG') || val.includes('HOP DONG') || val === 'CONTRACT') {
    return EmploymentType.CONTRACT
  }
  return EmploymentType.FULL_TIME
}

/**
 * Chuẩn hoá vai trò người dùng
 */
export function normalizeRole(rawVal: any): UserRole {
  if (!rawVal) return UserRole.EMPLOYEE
  const val = String(rawVal).trim().toUpperCase()

  if (val.includes('SUPER_ADMIN') || val.includes('QUẢN TRỊ CẤP CAO') || val.includes('QUAN TRI CAP CAO')) {
    return UserRole.SUPER_ADMIN
  }
  if (val.includes('BRANCH_ADMIN') || val.includes('QUẢN TRỊ CHI NHÁNH') || val.includes('QUAN TRI CHI NHANH')) {
    return UserRole.BRANCH_ADMIN
  }
  if (val.includes('HR_MANAGER') || val.includes('QUẢN LÝ NHÂN SỰ') || val.includes('QUAN LY NHAN SU')) {
    return UserRole.HR_MANAGER
  }
  return UserRole.EMPLOYEE
}

/**
 * Tạo file mẫu Excel danh sách nhân viên
 */
export function generateEmployeeTemplateBuffer(): Buffer {
  const headers = [
    'Mã nhân viên (*)',
    'Họ và tên (*)',
    'Email (*)',
    'Số điện thoại',
    'Chức vụ',
    'Mã chi nhánh (*)',
    'Mã phòng ban (*)',
    'Loại hợp đồng',
    'Ngày vào làm (YYYY-MM-DD)',
    'Vai trò (EMPLOYEE/HR_MANAGER/BRANCH_ADMIN)',
  ]

  const sampleRows = [
    [
      'NV001',
      'Nguyễn Văn An',
      'an.nguyen@company.com',
      '0901234567',
      'Chuyên viên Kinh doanh',
      'CN-HN',
      'PB-KD',
      'Chính thức',
      '2024-01-15',
      'EMPLOYEE',
    ],
    [
      'NV002',
      'Trần Thị Bình',
      'binh.tran@company.com',
      '0912345678',
      'Kỹ sư phần mềm',
      'CN-HCM',
      'PB-IT',
      'Thử việc',
      '2024-02-01',
      'EMPLOYEE',
    ],
    [
      'NV003',
      'Lê Văn Cường',
      'cuong.le@company.com',
      '0987654321',
      'Trưởng phòng Nhân sự',
      'CN-HN',
      'PB-HR',
      'Chính thức',
      '2023-06-01',
      'HR_MANAGER',
    ],
  ]

  const data = [headers, ...sampleRows]
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Độ rộng các cột
  worksheet['!cols'] = [
    { wch: 18 }, // Mã nhân viên
    { wch: 25 }, // Họ và tên
    { wch: 28 }, // Email
    { wch: 16 }, // SĐT
    { wch: 24 }, // Chức vụ
    { wch: 18 }, // Mã chi nhánh
    { wch: 18 }, // Mã phòng ban
    { wch: 18 }, // Loại HĐ
    { wch: 24 }, // Ngày vào làm
    { wch: 30 }, // Vai trò
  ]

  // Sheet hướng dẫn
  const guideHeaders = ['Cột', 'Bắt buộc', 'Mô tả / Giá trị hợp lệ']
  const guideRows = [
    ['Mã nhân viên', 'Có', 'Mã định danh duy nhất (2-20 ký tự, ví dụ: NV001)'],
    ['Họ và tên', 'Có', 'Họ và tên đầy đủ của nhân viên'],
    ['Email', 'Có', 'Email đăng nhập hệ thống (duy nhất, đúng định dạng)'],
    ['Số điện thoại', 'Không', 'Số điện thoại liên hệ'],
    ['Chức vụ', 'Không', 'Chức danh, vị trí công việc'],
    ['Mã chi nhánh', 'Có', 'Mã chi nhánh (code) hoặc Tên chi nhánh đã có trong hệ thống'],
    ['Mã phòng ban', 'Có', 'Mã phòng ban (code) hoặc Tên phòng ban thuộc chi nhánh đã chọn'],
    ['Loại hợp đồng', 'Không', 'Chính thức (mặc định), Thử việc, Bán thời gian, Hợp đồng'],
    ['Ngày vào làm', 'Không', 'Định dạng YYYY-MM-DD hoặc DD/MM/YYYY. Mặc định là ngày hiện tại'],
    ['Vai trò', 'Không', 'EMPLOYEE (mặc định), HR_MANAGER, BRANCH_ADMIN'],
  ]
  const guideSheet = XLSX.utils.aoa_to_sheet([guideHeaders, ...guideRows])
  guideSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 60 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách nhân viên')
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Hướng dẫn điền')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

/**
 * Đọc mảng các bản ghi từ buffer file Excel
 */
export function parseExcelWorkbook(buffer: Buffer | ArrayBuffer): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel không có sheet nào hợp lệ hoặc dữ liệu bị hỏng')
  }

  // Ưu tiên sheet chứa dữ liệu nhân viên nếu file có nhiều sheet (tránh đọc nhầm sheet hướng dẫn)
  let targetSheetName = workbook.SheetNames[0]
  const employeeSheetKeywords = ['danh sách nhân viên', 'danh sach nhan vien', 'nhân viên', 'nhan vien', 'employee', 'sheet1']

  for (const name of workbook.SheetNames) {
    const clean = name.toLowerCase().trim()
    if (employeeSheetKeywords.some((k) => clean.includes(k))) {
      targetSheetName = name
      break
    }
  }

  // Nếu sheet đầu tiên là sheet hướng dẫn nhưng có sheet khác, ưu tiên sheet khác
  const lowerTarget = targetSheetName.toLowerCase()
  if (
    (lowerTarget.includes('hướng dẫn') || lowerTarget.includes('huong dan') || lowerTarget.includes('guide')) &&
    workbook.SheetNames.length > 1
  ) {
    const alternativeSheet = workbook.SheetNames.find((n) => {
      const lower = n.toLowerCase()
      return !lower.includes('hướng dẫn') && !lower.includes('huong dan') && !lower.includes('guide')
    })
    if (alternativeSheet) {
      targetSheetName = alternativeSheet
    }
  }

  const worksheet = workbook.Sheets[targetSheetName]
  if (!worksheet) return []

  return XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' })
}
