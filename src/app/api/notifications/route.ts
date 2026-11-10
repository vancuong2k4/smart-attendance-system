import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { updateNotificationSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    let employeeId = session.user.employee?.id
    if (!employeeId && session.user.id) {
      const emp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (emp) employeeId = emp.id
    }

    if (!employeeId) {
      return successResponse({
        notifications: [],
        unreadCount: 0,
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      })
    }

    const { searchParams } = new URL(req.url)
    const unreadOnly =
      searchParams.get('unreadOnly') === 'true' || searchParams.get('isRead') === 'false'

    const rawPage = parseInt(searchParams.get('page') || '1', 10)
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1

    const rawLimit = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 20
    const skip = (page - 1) * limit

    const where: Prisma.NotificationWhereInput = {
      employeeId,
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [total, notifications, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: { employeeId, isRead: false },
      }),
    ])

    return successResponse({
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/notifications:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi lấy danh sách thông báo',
      500
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    let employeeId = session.user.employee?.id
    if (!employeeId && session.user.id) {
      const emp = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (emp) employeeId = emp.id
    }

    if (!employeeId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Tài khoản chưa được liên kết với hồ sơ nhân viên',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Dữ liệu không hợp lệ', 400)
    }

    const parsed = updateNotificationSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ',
        422,
        parsed.error.format()
      )
    }

    const { id, markAllAsRead } = parsed.data

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: {
          employeeId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      })

      return successResponse({
        message: 'Đã đánh dấu tất cả thông báo là đã đọc',
        unreadCount: 0,
      })
    }

    if (id) {
      const existing = await prisma.notification.findFirst({
        where: {
          id,
          employeeId,
        },
      })

      if (!existing) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Thông báo không tồn tại', 404)
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      })

      const unreadCount = await prisma.notification.count({
        where: {
          employeeId,
          isRead: false,
        },
      })

      return successResponse({
        message: 'Đã đánh dấu thông báo là đã đọc',
        notification: updated,
        unreadCount,
      })
    }

    return errorResponse(ErrorCodes.VALIDATION_ERROR, 'Yêu cầu không hợp lệ', 400)
  } catch (error: any) {
    console.error('Error in PATCH /api/notifications:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Đã xảy ra lỗi khi cập nhật thông báo',
      500
    )
  }
}
