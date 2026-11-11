import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response'
import { saveAttendancePhoto } from '@/lib/storage'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employee?.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED,
        'Vui lòng đăng nhập bằng tài khoản nhân viên để tải ảnh selfie',
        401
      )
    }

    const contentType = req.headers.get('content-type') || ''
    let photoUrl: string

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = (formData.get('file') || formData.get('photo') || formData.get('image')) as File | null

      if (!file) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Vui lòng tải lên tệp ảnh khuôn mặt selfie',
          422
        )
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      photoUrl = await saveAttendancePhoto(buffer, session.user.employee.id, file.type)
    } else {
      // JSON body
      const body = await req.json().catch(() => ({}))
      const image = body.photo || body.image || body.selfie

      if (!image || typeof image !== 'string' || !image.trim()) {
        return errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Dữ liệu ảnh khuôn mặt selfie không hợp lệ',
          422
        )
      }

      photoUrl = await saveAttendancePhoto(image.trim(), session.user.employee.id)
    }

    return successResponse(
      {
        url: photoUrl,
        message: 'Tải ảnh selfie thành công',
      },
      200
    )
  } catch (error: any) {
    console.error('Error in attendance selfie upload API:', error)
    const isValidation =
      error.message?.includes('không được hỗ trợ') ||
      error.message?.includes('vượt quá') ||
      error.message?.includes('không hợp lệ') ||
      error.message?.includes('rỗng')

    return errorResponse(
      isValidation ? ErrorCodes.VALIDATION_ERROR : ErrorCodes.INTERNAL_ERROR,
      error.message || 'Đã xảy ra lỗi khi lưu ảnh selfie',
      isValidation ? 422 : 500
    )
  }
}
