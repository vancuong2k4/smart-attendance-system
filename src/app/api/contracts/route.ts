import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { contractCreateSchema } from '@/lib/contract-validation'
import {
  calculateDaysRemaining,
  computeContractStatus,
  getExpirationUrgency,
  recordLifecycleEvent,
  CONTRACT_TYPE_MAP,
} from '@/lib/contracts'
import { logAuditEvent, AuditActions } from '@/lib/audit'
import { UserRole, ContractType, ContractStatus, LifecycleStage } from '@prisma/client'

/**
 * GET /api/contracts
 * Lấy danh sách hợp đồng lao động theo phân quyền RBAC và bộ lọc
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const contractType = searchParams.get('contractType') as ContractType | null
    const status = searchParams.get('status') as ContractStatus | null
    const branchId = searchParams.get('branchId')
    const employeeId = searchParams.get('employeeId')
    const expiringDays = searchParams.get('expiringDays')
      ? parseInt(searchParams.get('expiringDays')!, 10)
      : null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    const where: any = {}

    // RBAC logic
    if (session.user.role === UserRole.EMPLOYEE) {
      // Nhân viên chỉ được xem hợp đồng của chính mình
      const emp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (!emp) {
        return successResponse({ items: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } })
      }
      where.employeeId = emp.id
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      // Branch Admin chỉ được xem hợp đồng thuộc chi nhánh mình
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId) {
        where.employee = { branchId: adminEmp.branchId }
      }
    } else {
      // SUPER_ADMIN hoặc HR_MANAGER lọc theo branchId nếu có
      if (branchId && branchId !== 'all') {
        where.employee = { branchId }
      }
    }

    if (employeeId) {
      where.employeeId = employeeId
    }

    if (contractType && Object.values(ContractType).includes(contractType)) {
      where.contractType = contractType
    }

    if (status && Object.values(ContractStatus).includes(status)) {
      where.status = status
    }

    // Lọc theo số ngày sắp hết hạn (vd: expiringDays = 30)
    if (expiringDays && expiringDays > 0) {
      const now = new Date()
      const futureDate = new Date(now.getTime() + expiringDays * 24 * 60 * 60 * 1000)
      where.endDate = {
        gte: now,
        lte: futureDate,
      }
      where.status = { notIn: [ContractStatus.TERMINATED, ContractStatus.DRAFT] }
    }

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { jobTitle: { contains: search, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { employeeCode: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    const [total, rawContracts] = await Promise.all([
      prisma.employmentContract.count({ where }),
      prisma.employmentContract.findMany({
        where,
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
        orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ])

    const now = new Date()
    const items = rawContracts.map((c) => {
      const daysRemaining = calculateDaysRemaining(c.endDate, now)
      const computedStatus = computeContractStatus(c.status, c.endDate, now)
      const urgency = getExpirationUrgency(daysRemaining)

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        employeeId: c.employeeId,
        employee: c.employee,
        contractType: c.contractType,
        contractTypeMeta: CONTRACT_TYPE_MAP[c.contractType],
        status: computedStatus,
        rawStatus: c.status,
        jobTitle: c.jobTitle,
        signDate: c.signDate.toISOString(),
        startDate: c.startDate.toISOString(),
        endDate: c.endDate ? c.endDate.toISOString() : null,
        daysRemaining,
        urgency,
        insuranceSalary: c.insuranceSalary,
        grossSalary: c.grossSalary,
        workingHoursPerWeek: c.workingHoursPerWeek,
        signerName: c.signerName,
        signerRole: c.signerRole,
        fileUrl: c.fileUrl,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }
    })

    return successResponse({
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/contracts:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách hợp đồng', 500)
  }
}

/**
 * POST /api/contracts
 * Tạo mới hợp đồng lao động và tự động ghi sự kiện vòng đời
 */
export async function POST(req: NextRequest) {
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
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tạo hợp đồng lao động', 403)
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = contractCreateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu hợp đồng không hợp lệ',
        422,
        validation.error.issues
      )
    }

    const data = validation.data

    // Kiểm tra trùng mã hợp đồng
    const existing = await prisma.employmentContract.findUnique({
      where: { contractNumber: data.contractNumber },
    })
    if (existing) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Mã hợp đồng đã tồn tại trong hệ thống', 422)
    }

    // Kiểm tra nhân viên
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: { branch: true },
    })
    if (!employee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy nhân viên', 404)
    }

    // RBAC: BRANCH_ADMIN chỉ được tạo cho nhân viên chi nhánh mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId !== employee.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Bạn chỉ có quyền tạo hợp đồng cho nhân viên thuộc chi nhánh của mình',
          403
        )
      }
    }

    const signDate = new Date(data.signDate)
    const startDate = new Date(data.startDate)
    const endDate = data.endDate ? new Date(data.endDate) : null

    // Tạo hợp đồng
    const contract = await prisma.employmentContract.create({
      data: {
        contractNumber: data.contractNumber,
        employeeId: data.employeeId,
        contractType: data.contractType,
        status: data.status,
        jobTitle: data.jobTitle,
        signDate,
        startDate,
        endDate,
        insuranceSalary: data.insuranceSalary,
        grossSalary: data.grossSalary,
        workingHoursPerWeek: data.workingHoursPerWeek,
        signerName: data.signerName || null,
        signerRole: data.signerRole || null,
        fileUrl: data.fileUrl || null,
        notes: data.notes || null,
      },
      include: {
        employee: {
          select: { fullName: true, employeeCode: true },
        },
      },
    })

    // Tự động ghi nhận mốc sự kiện vòng đời
    const typeLabel = CONTRACT_TYPE_MAP[data.contractType]?.label || data.contractType
    const stage =
      data.contractType === ContractType.PROBATION
        ? LifecycleStage.PROBATION
        : LifecycleStage.OFFICIAL

    await recordLifecycleEvent({
      employeeId: data.employeeId,
      stage,
      title: `Ký kết hợp đồng ${typeLabel} (${data.contractNumber})`,
      description: `Chức danh: ${data.jobTitle}. Mức lương: ${data.grossSalary.toLocaleString('vi-VN')} VND. Hiệu lực từ ${startDate.toLocaleDateString('vi-VN')}`,
      eventDate: signDate,
      createdById: session.user.id,
      metadata: {
        contractId: contract.id,
        contractType: data.contractType,
        grossSalary: data.grossSalary,
      },
    })

    // Ghi AuditLog
    await logAuditEvent({
      userId: session.user.id,
      action: 'EMPLOYMENT_CONTRACT_CREATED',
      entity: 'EmploymentContract',
      entityId: contract.id,
      newData: contract,
    })

    return successResponse(contract, 201)
  } catch (error: any) {
    console.error('Error creating contract:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tạo hợp đồng', 500)
  }
}
