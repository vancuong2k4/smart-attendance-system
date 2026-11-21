import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { holidayCreateSchema } from '@/lib/holiday-validation'
import { HOLIDAY_TYPE_MAP } from '@/lib/holidays'
import { logAuditEvent, AuditActions } from '@/lib/audit'
import { UserRole, HolidayType } from '@prisma/client'

/**
 * GET /api/holidays
 * Lấy danh sách ngày lễ, ngày nghỉ công ty và ngày làm bù
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
    const type = searchParams.get('type') as HolidayType | null
    const branchId = searchParams.get('branchId')
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const where: any = {}

    // Lọc theo năm
    if (!isNaN(year)) {
      where.year = year
    }

    // Lọc theo loại ngày nghỉ
    if (type && Object.values(HolidayType).includes(type)) {
      where.type = type
    }

    // Lọc theo từ khóa
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Phân quyền chi nhánh
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (adminEmp?.branchId) {
        where.OR = [
          ...(where.OR ? where.OR : []),
          { branchId: null },
          { branchId: adminEmp.branchId },
        ]
      }
    } else if (branchId) {
      where.OR = [{ branchId: null }, { branchId }]
    }

    const [total, rawHolidays] = await Promise.all([
      prisma.companyHoliday.count({ where }),
      prisma.companyHoliday.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
        include: {
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
    ])

    const items = rawHolidays.map((h) => ({
      id: h.id,
      name: h.name,
      code: h.code,
      date: h.date instanceof Date ? h.date.toISOString() : h.date,
      endDate: h.endDate instanceof Date ? h.endDate.toISOString() : h.endDate,
      type: h.type,
      typeMeta: HOLIDAY_TYPE_MAP[h.type],
      isPaid: h.isPaid,
      payMultiplier: h.payMultiplier,
      year: h.year,
      branchId: h.branchId,
      branch: h.branch,
      description: h.description,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : h.createdAt,
      updatedAt: h.updatedAt instanceof Date ? h.updatedAt.toISOString() : h.updatedAt,
    }))

    return successResponse({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (error: any) {
    console.error('Error fetching company holidays:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách ngày lễ', 500)
  }
}

/**
 * POST /api/holidays
 * Tạo mới ngày lễ, ngày nghỉ hoặc ngày làm bù
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
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền thiết lập lịch ngày lễ',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = holidayCreateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu ngày lễ không hợp lệ',
        422,
        validation.error.issues
      )
    }

    const data = validation.data

    // Nếu là Branch Admin, chỉ được thiết lập cho chi nhánh của mình
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (!adminEmp?.branchId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản quản lý chưa được gán chi nhánh',
          403
        )
      }
      data.branchId = adminEmp.branchId
    }

    const startDate = new Date(data.date)
    const endDate = data.endDate ? new Date(data.endDate) : null

    // Đảm bảo năm được gán chính xác theo ngày
    const year = data.year || startDate.getFullYear()

    // Kiểm tra trùng lặp mã ngày lễ trong cùng năm và chi nhánh
    const existing = await prisma.companyHoliday.findFirst({
      where: {
        code: data.code,
        year,
        branchId: data.branchId || null,
      },
    })

    if (existing) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Mã ngày lễ "${data.code}" đã tồn tại trong năm ${year}`,
        409
      )
    }

    const newHoliday = await prisma.companyHoliday.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        date: startDate,
        endDate,
        type: data.type,
        isPaid: data.isPaid,
        payMultiplier: data.payMultiplier,
        year,
        branchId: data.branchId || null,
        description: data.description || null,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })

    await logAuditEvent({
      userId: session.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entity: 'CompanyHoliday',
      entityId: newHoliday.id,
      newData: {
        name: newHoliday.name,
        code: newHoliday.code,
        type: newHoliday.type,
        date: newHoliday.date,
        payMultiplier: newHoliday.payMultiplier,
      },
    })

    return successResponse(
      {
        ...newHoliday,
        typeMeta: HOLIDAY_TYPE_MAP[newHoliday.type],
      },
      201
    )
  } catch (error: any) {
    console.error('Error creating company holiday:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Lỗi khi khởi tạo ngày lễ mới',
      500
    )
  }
}
