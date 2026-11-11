import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { canManageEmployees } from '@/lib/rbac'
import { errorResponse, ErrorCodes } from '@/lib/api-response'
import { generateEmployeeTemplateBuffer } from '@/lib/employee-excel'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Vui lòng đăng nhập', 401)
    }

    if (!canManageEmployees(session.user.role)) {
      return errorResponse(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tải file mẫu', 403)
    }

    const buffer = generateEmployeeTemplateBuffer()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="mau_danh_sach_nhan_vien.xlsx"',
      },
    })
  } catch (error: any) {
    console.error('Error generating employee template:', error)
    return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Không thể tạo file mẫu Excel', 500)
  }
}
