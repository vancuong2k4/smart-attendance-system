import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { UserRole, ContractType, ContractStatus } from '@prisma/client'
import { computeContractStatus } from '@/lib/contracts'

/**
 * GET /api/contracts/metrics
 * Tổng hợp số liệu thống kê hợp đồng lao động theo quyền hạn
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')

    const employeeWhere: any = {}

    if (session.user.role === UserRole.EMPLOYEE) {
      const emp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (!emp) {
        return successResponse({
          totalContracts: 0,
          activeContracts: 0,
          probationContracts: 0,
          expiringSoonContracts: 0,
          expiredContracts: 0,
          byType: {},
          byStatus: {},
        })
      }
      employeeWhere.id = emp.id
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId) {
        employeeWhere.branchId = adminEmp.branchId
      }
    } else if (branchId) {
      employeeWhere.branchId = branchId
    }

    const contracts = await prisma.employmentContract.findMany({
      where: {
        employee: employeeWhere,
      },
      select: {
        id: true,
        contractType: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    })

    const now = new Date()
    let totalContracts = contracts.length
    let activeContracts = 0
    let probationContracts = 0
    let expiringSoonContracts = 0
    let expiredContracts = 0

    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}

    // Khởi tạo các nhóm giá trị
    Object.values(ContractType).forEach((t) => {
      byType[t] = 0
    })
    Object.values(ContractStatus).forEach((s) => {
      byStatus[s] = 0
    })

    contracts.forEach((c) => {
      byType[c.contractType] = (byType[c.contractType] || 0) + 1

      const computed = computeContractStatus(c.status, c.endDate, now)
      byStatus[computed] = (byStatus[computed] || 0) + 1

      if (computed === ContractStatus.ACTIVE) {
        activeContracts++
      } else if (computed === ContractStatus.EXPIRING_SOON) {
        expiringSoonContracts++
        activeContracts++
      } else if (computed === ContractStatus.EXPIRED) {
        expiredContracts++
      }

      if (
        c.contractType === ContractType.PROBATION &&
        (computed === ContractStatus.ACTIVE || computed === ContractStatus.EXPIRING_SOON)
      ) {
        probationContracts++
      }
    })

    return successResponse({
      totalContracts,
      activeContracts,
      probationContracts,
      expiringSoonContracts,
      expiredContracts,
      byType,
      byStatus,
    })
  } catch (error) {
    console.error('Error fetching contract metrics:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Lỗi khi lấy dữ liệu thống kê hợp đồng', 500)
  }
}
