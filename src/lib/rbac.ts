import { UserRole } from '@prisma/client'

/**
 * Kiểm tra user có quyền truy cập theo role không
 */
export function hasRole(userRole: string, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole as UserRole)
}

/**
 * Kiểm tra có phải Admin cấp cao không
 */
export function isSuperAdmin(role: string): boolean {
  return role === UserRole.SUPER_ADMIN
}

/**
 * Kiểm tra có thể quản lý nhân viên không
 */
export function canManageEmployees(role: string): boolean {
  return hasRole(role, [UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN])
}

/**
 * Kiểm tra có thể phê duyệt đơn từ không
 */
export function canApproveRequests(role: string): boolean {
  return hasRole(role, [UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN, UserRole.HR_MANAGER])
}

/**
 * Kiểm tra có thể xuất dữ liệu lương không
 */
export function canExportPayroll(role: string): boolean {
  return hasRole(role, [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER])
}

/**
 * Kiểm tra có thể xem báo cáo tất cả chi nhánh không
 */
export function canViewAllBranches(role: string): boolean {
  return hasRole(role, [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER])
}

/**
 * Kiểm tra có thể chỉnh sửa GPS location không
 */
export function canEditBranchLocation(role: string): boolean {
  return hasRole(role, [UserRole.SUPER_ADMIN, UserRole.BRANCH_ADMIN])
}
