import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { branchCreateSchema } from '@/lib/branch-validation'
import { UserRole, Prisma } from '@prisma/client'

/**
 * GET /api/branches
 * Danh sách chi nhánh kèm bộ lọc tìm kiếm, trạng thái và thống kê số lượng nhân sự/phòng ban
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim()
    const status = searchParams.get('status') || 'all'
    const includeCounts = searchParams.get('includeCounts') === 'true'

    const where: Prisma.BranchWhereInput = {}

    // Lọc theo trạng thái hoạt động
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    // Tìm kiếm theo tên, mã hoặc địa chỉ
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ]
    }

    const branches = await prisma.branch.findMany({
      where,
      select: {
        id: true,
        companyId: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        gpsRadius: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ...(includeCounts && {
          _count: {
            select: {
              employees: true,
              departments: true,
              schedules: true,
            },
          },
        }),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })

    return successResponse(branches)
  } catch (error: any) {
    console.error('Error fetching branches:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách chi nhánh', 500)
  }
}

/**
 * POST /api/branches
 * Tạo chi nhánh mới kèm cấu hình GPS Geofence (Chỉ dành cho SUPER_ADMIN)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (session.user.role !== UserRole.SUPER_ADMIN) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ Quản trị viên cấp cao (SUPER_ADMIN) mới có quyền tạo chi nhánh mới',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu yêu cầu không hợp lệ', 400)
    }

    const validation = branchCreateSchema.safeParse(body)
    if (!validation.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.errors[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        validation.error.errors
      )
    }

    const data = validation.data

    // Xác định companyId (lấy theo request hoặc lấy công ty mặc định)
    let targetCompanyId = data.companyId
    if (!targetCompanyId) {
      let defaultCompany = await prisma.company.findFirst()
      if (!defaultCompany) {
        defaultCompany = await prisma.company.create({
          data: {
            name: 'Tổng công ty',
            code: 'HQ',
            address: 'Hà Nội, Việt Nam',
          },
        })
      }
      targetCompanyId = defaultCompany.id
    } else {
      const companyExists = await prisma.company.findUnique({
        where: { id: targetCompanyId },
      })
      if (!companyExists) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Công ty chỉ định không tồn tại', 404)
      }
    }

    // Kiểm tra trùng lặp mã chi nhánh trong cùng một công ty
    const existingBranch = await prisma.branch.findUnique({
      where: {
        companyId_code: {
          companyId: targetCompanyId,
          code: data.code,
        },
      },
    })

    if (existingBranch) {
      return errorResponse(
        ErrorCodes.BAD_REQUEST,
        `Mã chi nhánh "${data.code}" đã được sử dụng. Vui lòng chọn mã khác.`,
        409
      )
    }

    const branch = await prisma.branch.create({
      data: {
        companyId: targetCompanyId,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        latitude: data.latitude,
        longitude: data.longitude,
        gpsRadius: data.gpsRadius,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
            schedules: true,
          },
        },
      },
    })

    return successResponse(branch, 'Tạo chi nhánh mới thành công', 201)
  } catch (error: any) {
    console.error('Error creating branch:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tạo chi nhánh mới', 500)
  }
}
