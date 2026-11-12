import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { geofenceTestSchema } from '@/lib/branch-validation'
import { evaluateGeofenceTest, formatDistance } from '@/lib/geofence'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/branches/[id]/test-geofence
 * Kiểm tra thử nghiệm một cặp tọa độ GPS có nằm trong bán kính Geofence của chi nhánh hay không
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    const { id } = await context.params

    const branch = await prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        latitude: true,
        longitude: true,
        gpsRadius: true,
        isActive: true,
      },
    })

    if (!branch) {
      return errorResponse(ErrorCodes.NOT_FOUND, 'Không tìm thấy chi nhánh yêu cầu', 404)
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return errorResponse(ErrorCodes.BAD_REQUEST, 'Dữ liệu tọa độ không hợp lệ', 400)
    }

    const validation = geofenceTestSchema.safeParse(body)
    if (!validation.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        validation.error.errors[0]?.message || 'Tọa độ không hợp lệ',
        422,
        validation.error.errors
      )
    }

    const { latitude, longitude, accuracy } = validation.data

    const evaluation = evaluateGeofenceTest(
      branch.latitude,
      branch.longitude,
      branch.gpsRadius,
      latitude,
      longitude,
      accuracy
    )

    return successResponse({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      branchCoordinates: {
        latitude: branch.latitude,
        longitude: branch.longitude,
      },
      branchRadius: branch.gpsRadius,
      testCoordinates: {
        latitude,
        longitude,
      },
      accuracy: accuracy ?? null,
      isInside: evaluation.isInside,
      distanceMeters: evaluation.distanceMeters,
      formattedDistance: formatDistance(evaluation.distanceMeters),
      deltaMeters: evaluation.deltaMeters,
      verdict: evaluation.verdict,
      message: evaluation.message,
    })
  } catch (error: any) {
    console.error('Error testing branch geofence:', error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Không thể thực hiện kiểm tra Geofence chi nhánh',
      500
    )
  }
}
