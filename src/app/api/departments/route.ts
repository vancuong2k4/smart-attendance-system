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

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')

    const where: any = {}
    if (branchId) {
      where.branchId = branchId
    }

    const departments = await prisma.department.findMany({
      where,
      select: {
        id: true,
        branchId: true,
        name: true,
        code: true,
      },
      orderBy: { name: 'asc' },
    })

    return successResponse(departments)
  } catch (error: any) {
    console.error('Error fetching departments:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tải danh sách phòng ban', 500)
  }
}
