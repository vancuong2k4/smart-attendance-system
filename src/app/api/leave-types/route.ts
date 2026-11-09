import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const leaveTypes = await prisma.leaveType.findMany({
      orderBy: { code: 'asc' },
    })

    return successResponse(leaveTypes)
  } catch (error: any) {
    console.error('Error fetching leave types:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể tải danh sách loại nghỉ phép',
      500
    )
  }
}
