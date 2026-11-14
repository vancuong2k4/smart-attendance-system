import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { webhookUpdateSchema } from '@/lib/webhook-validation'
import { UserRole } from '@prisma/client'

/**
 * GET /api/webhooks/[id]
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

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền truy cập', 403)
    }

    const { id } = await params
    const subscription = await prisma.webhookSubscription.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    if (!subscription) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy webhook', 404)
    }

    return successResponse(subscription)
  } catch (error: any) {
    console.error('Error fetching webhook detail:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải webhook', 500)
  }
}

/**
 * PATCH /api/webhooks/[id]
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

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền chỉnh sửa webhook', 403)
    }

    const { id } = await params
    const existing = await prisma.webhookSubscription.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy webhook', 404)
    }

    // RBAC check cho BRANCH_ADMIN
    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (existing.branchId && existing.branchId !== adminEmployee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không thể sửa webhook chi nhánh khác', 403)
      }
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = webhookUpdateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu cập nhật không hợp lệ',
        422
      )
    }

    const updated = await prisma.webhookSubscription.update({
      where: { id },
      data: validation.data,
      include: {
        branch: { select: { id: true, name: true } },
      },
    })

    return successResponse(updated)
  } catch (error: any) {
    console.error('Error updating webhook:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể cập nhật webhook', 500)
  }
}

/**
 * DELETE /api/webhooks/[id]
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

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      session.user.role !== UserRole.BRANCH_ADMIN
    ) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Không có quyền xóa webhook', 403)
    }

    const { id } = await params
    const existing = await prisma.webhookSubscription.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy webhook', 404)
    }

    if (session.user.role === UserRole.BRANCH_ADMIN) {
      const adminEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { branchId: true },
      })
      if (existing.branchId && existing.branchId !== adminEmployee?.branchId) {
        return errorResponse(ErrorCodes.FORBIDDEN, 'Không thể xóa webhook chi nhánh khác', 403)
      }
    }

    await prisma.webhookSubscription.delete({
      where: { id },
    })

    return successResponse({ message: 'Đã xóa webhook thành công', id })
  } catch (error: any) {
    console.error('Error deleting webhook:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể xóa webhook', 500)
  }
}
