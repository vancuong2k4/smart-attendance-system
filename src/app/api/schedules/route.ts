import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { scheduleCreateSchema } from '@/lib/shift-validation'
import { UserRole, Prisma } from '@prisma/client'

/**
 * GET /api/schedules
 * Danh sách ca làm việc theo chi nhánh và trạng thái
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    const isActive = searchParams.get('isActive')

    const where: Prisma.WorkScheduleWhereInput = {}

    // Phân quyền theo chi nhánh
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      if (userBranchId) {
        where.branchId = userBranchId
      }
    } else if (branchId) {
      where.branchId = branchId
    }

    if (isActive === 'true') {
      where.isActive = true
    } else if (isActive === 'false') {
      where.isActive = false
    }

    const schedules = await prisma.workSchedule.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { startTime: 'asc' }],
    })

    return successResponse(schedules)
  } catch (error: any) {
    console.error('Error fetching work schedules:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải danh sách ca làm việc',
      500
    )
  }
}

/**
 * POST /api/schedules
 * Tạo ca làm việc mới (SUPER_ADMIN hoặc BRANCH_ADMIN của chi nhánh)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN
    const isBranchAdmin = session.user.role === UserRole.BRANCH_ADMIN

    if (!isSuperAdmin && !isBranchAdmin) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền tạo ca làm việc',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = scheduleCreateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu ca làm việc không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const data = validation.data

    // Kiểm tra quyền hạn chi nhánh của BRANCH_ADMIN
    if (isBranchAdmin && session.user.employee?.branchId !== data.branchId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Quản trị viên chỉ được tạo ca làm việc cho chi nhánh của mình',
        403
      )
    }

    // Kiểm tra chi nhánh tồn tại
    const branchExists = await prisma.branch.findUnique({
      where: { id: data.branchId },
    })

    if (!branchExists) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Chi nhánh chỉ định không tồn tại', 404)
    }

    // Nếu đặt ca này là ca mặc định, hủy ca mặc định cũ của chi nhánh
    if (data.isDefault) {
      await prisma.workSchedule.updateMany({
        where: { branchId: data.branchId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const schedule = await prisma.workSchedule.create({
      data: {
        branchId: data.branchId,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        lunchStart: data.lunchStart,
        lunchEnd: data.lunchEnd,
        workDays: data.workDays,
        lateThreshold: data.lateThreshold,
        earlyThreshold: data.earlyThreshold,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    return successResponse(schedule, 201)
  } catch (error: any) {
    console.error('Error creating work schedule:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tạo ca làm việc mới',
      500
    )
  }
}
