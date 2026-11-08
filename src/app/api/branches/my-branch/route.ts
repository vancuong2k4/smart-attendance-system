import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employee?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Vui lòng đăng nhập để xem thông tin chi nhánh',
        401
      )
    }

    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employee.id },
      include: {
        branch: {
          include: {
            schedules: {
              where: { isActive: true },
              orderBy: { isDefault: 'desc' },
            },
          },
        },
      },
    })

    if (!employee || !employee.branch) {
      return errorResponse(
        ErrorCodes.NOT_FOUND,
        'Không tìm thấy chi nhánh của nhân viên',
        404
      )
    }

    const branch = employee.branch
    const activeSchedule = branch.schedules[0] || null

    return successResponse({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      latitude: branch.latitude,
      longitude: branch.longitude,
      gpsRadius: branch.gpsRadius,
      schedule: activeSchedule,
    })
  } catch (error: any) {
    console.error('Error in my-branch API:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Đã xảy ra lỗi khi lấy thông tin chi nhánh', 500)
  }
}
