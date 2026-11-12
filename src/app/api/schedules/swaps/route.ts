import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { shiftSwapCreateSchema } from '@/lib/shift-validation'
import { validateSwapEligibility } from '@/lib/shift-engine'
import { UserRole, Prisma, ShiftSwapStatus, SwapPeerStatus } from '@prisma/client'

/**
 * GET /api/schedules/swaps
 * Lấy danh sách yêu cầu đổi ca làm việc
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as ShiftSwapStatus | null
    const scope = searchParams.get('scope') // 'sent' | 'received' | 'all'

    const where: Prisma.ShiftSwapRequestWhereInput = {}

    // Phân quyền dữ liệu
    if (session.user.role === UserRole.EMPLOYEE) {
      const myEmpId = session.user.employee?.id
      if (!myEmpId) {
        return errorResponse(
          ErrorCodes.FORBIDDEN,
          'Tài khoản chưa được liên kết với nhân viên',
          403
        )
      }

      if (scope === 'sent') {
        where.requesterId = myEmpId
      } else if (scope === 'received') {
        where.targetEmployeeId = myEmpId
      } else {
        where.OR = [
          { requesterId: myEmpId },
          { targetEmployeeId: myEmpId },
        ]
      }
    } else if (session.user.role === UserRole.BRANCH_ADMIN) {
      const userBranchId = session.user.employee?.branchId
      where.requester = { branchId: userBranchId }
    }

    if (status && Object.values(ShiftSwapStatus).includes(status)) {
      where.status = status
    }

    const swapRequests = await prisma.shiftSwapRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            branch: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        },
        targetEmployee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            avatarUrl: true,
            branch: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        },
        requesterSchedule: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
        targetSchedule: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(swapRequests)
  } catch (error: any) {
    console.error('Error fetching shift swap requests:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải danh sách đơn đổi ca',
      500
    )
  }
}

/**
 * POST /api/schedules/swaps
 * Nộp yêu cầu đổi ca làm việc với đồng nghiệp
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const requesterEmpId = session.user.employee?.id
    if (!requesterEmpId) {
      return errorResponse(
        ErrorCodes.FORBIDDEN,
        'Chỉ tài khoản nhân viên mới có thể nộp đơn đổi ca',
        403
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu không hợp lệ', 400)
    }

    const validation = shiftSwapCreateSchema.safeParse(body)
    if (!validation.success) {
      const firstIssue = validation.error.issues?.[0] || validation.error.errors?.[0]
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        firstIssue?.message || 'Dữ liệu đơn đổi ca không hợp lệ',
        422,
        validation.error.issues || validation.error.errors
      )
    }

    const {
      targetEmployeeId,
      requesterDate,
      requesterScheduleId,
      targetDate,
      targetScheduleId,
      reason,
    } = validation.data

    // Kiểm tra tính hợp lệ cơ bản (anti-self-swap, quá khứ)
    const eligibility = validateSwapEligibility(
      requesterEmpId,
      targetEmployeeId,
      requesterDate,
      targetDate
    )
    if (!eligibility.isValid) {
      return errorResponse(ErrorCodes.BAD_REQUEST, eligibility.error || 'Yêu cầu không hợp lệ', 400)
    }

    // Kiểm tra đồng nghiệp mục tiêu có tồn tại
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      select: { id: true, fullName: true, branchId: true },
    })
    if (!targetEmployee) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy đồng nghiệp chỉ định để đổi ca', 404)
    }

    // Kiểm tra 2 ca làm việc có tồn tại
    const [reqSchedule, tgtSchedule] = await Promise.all([
      prisma.workSchedule.findUnique({ where: { id: requesterScheduleId } }),
      prisma.workSchedule.findUnique({ where: { id: targetScheduleId } }),
    ])

    if (!reqSchedule || !tgtSchedule) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Ca làm việc chỉ định không tồn tại', 404)
    }

    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        requesterId: requesterEmpId,
        targetEmployeeId,
        requesterDate: new Date(`${requesterDate}T00:00:00.000Z`),
        requesterScheduleId,
        targetDate: new Date(`${targetDate}T00:00:00.000Z`),
        targetScheduleId,
        reason,
        peerStatus: SwapPeerStatus.PENDING,
        status: ShiftSwapStatus.PENDING_PEER,
      },
      include: {
        requester: { select: { fullName: true, employeeCode: true } },
        targetEmployee: { select: { fullName: true, employeeCode: true } },
        requesterSchedule: { select: { name: true, startTime: true, endTime: true } },
        targetSchedule: { select: { name: true, startTime: true, endTime: true } },
      },
    })

    return successResponse(swapRequest, 201)
  } catch (error: any) {
    console.error('Error creating shift swap request:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể gửi yêu cầu đổi ca',
      500
    )
  }
}
