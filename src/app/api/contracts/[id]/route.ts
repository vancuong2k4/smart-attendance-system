import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { contractUpdateSchema } from '@/lib/contract-validation'
import {
  calculateDaysRemaining,
  computeContractStatus,
  getExpirationUrgency,
  recordLifecycleEvent,
  CONTRACT_TYPE_MAP,
} from '@/lib/contracts'
import { logAuditEvent } from '@/lib/audit'
import { UserRole, ContractStatus, LifecycleStage } from '@prisma/client'

/**
 * GET /api/contracts/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await params
    const contract = await prisma.employmentContract.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            position: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!contract) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy hợp đồng', 404)
    }

    // RBAC Check
    if (session.user.role === UserRole.EMPLOYEE) {
      const emp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (emp?.id !== contract.employeeId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem hợp đồng này', 403)
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId !== contract.employee.branch?.id) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền xem hợp đồng chi nhánh khác', 403)
      }
    }

    const now = new Date()
    const daysRemaining = calculateDaysRemaining(contract.endDate, now)
    const computedStatus = computeContractStatus(contract.status, contract.endDate, now)
    const urgency = getExpirationUrgency(daysRemaining)

    return successResponse({
      ...contract,
      status: computedStatus,
      rawStatus: contract.status,
      daysRemaining,
      urgency,
      contractTypeMeta: CONTRACT_TYPE_MAP[contract.contractType],
    })
  } catch (error: any) {
    console.error('Error fetching contract detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải chi tiết hợp đồng', 500)
  }
}

/**
 * PATCH /api/contracts/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.HR_MANAGER,
      UserRole.BRANCH_ADMIN,
    ]
    if (!allowedRoles.includes(session.user.role as UserRole)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền cập nhật hợp đồng', 403)
    }

    const { id } = await params
    const existing = await prisma.employmentContract.findUnique({
      where: { id },
      include: {
        employee: { select: { branchId: true } },
      },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy hợp đồng', 404)
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId !== existing.employee.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không thể sửa hợp đồng chi nhánh khác', 403)
      }
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = contractUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu cập nhật không hợp lệ',
        422
      )
    }

    const updateData: any = { ...validation.data }
    if (updateData.signDate) updateData.signDate = new Date(updateData.signDate)
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate)
    if (updateData.endDate !== undefined) {
      updateData.endDate = updateData.endDate ? new Date(updateData.endDate) : null
    }

    const updated = await prisma.employmentContract.update({
      where: { id },
      data: updateData,
    })

    // Tự động ghi nhận LifecycleEvent nếu có sự kiện đặc biệt
    if (updateData.status === ContractStatus.TERMINATED) {
      await recordLifecycleEvent({
        employeeId: existing.employeeId,
        stage: LifecycleStage.OFFBOARDED,
        title: `Thanh lý hợp đồng ${existing.contractNumber}`,
        description: `Hợp đồng đã được chấm dứt hiệu lực vào ngày ${new Date().toLocaleDateString('vi-VN')}`,
        createdById: session.user.id,
      })
    } else if (updateData.grossSalary && updateData.grossSalary !== existing.grossSalary) {
      await recordLifecycleEvent({
        employeeId: existing.employeeId,
        stage: LifecycleStage.PROMOTION,
        title: `Điều chỉnh mức lương hợp đồng (${existing.contractNumber})`,
        description: `Mức lương mới: ${updateData.grossSalary.toLocaleString('vi-VN')} VND (Mức cũ: ${existing.grossSalary.toLocaleString('vi-VN')} VND)`,
        createdById: session.user.id,
      })
    }

    // Ghi AuditLog
    await logAuditEvent({
      userId: session.user.id,
      action: 'EMPLOYMENT_CONTRACT_UPDATED',
      entity: 'EmploymentContract',
      entityId: id,
      oldData: existing,
      newData: updated,
    })

    return successResponse(updated)
  } catch (error: any) {
    console.error('Error updating contract:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật hợp đồng', 500)
  }
}

/**
 * DELETE /api/contracts/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Chỉ Super Admin mới có quyền xóa hợp đồng', 403)
    }

    const { id } = await params
    const existing = await prisma.employmentContract.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy hợp đồng', 404)
    }

    await prisma.employmentContract.delete({
      where: { id },
    })

    await logAuditEvent({
      userId: session.user.id,
      action: 'EMPLOYMENT_CONTRACT_DELETED',
      entity: 'EmploymentContract',
      entityId: id,
      oldData: existing,
    })

    return successResponse({ message: 'Đã xóa hợp đồng thành công', id })
  } catch (error: any) {
    console.error('Error deleting contract:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xóa hợp đồng', 500)
  }
}
