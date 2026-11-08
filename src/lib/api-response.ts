import { NextResponse } from 'next/server'

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: unknown
}

/**
 * Trả về response thành công chuẩn
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Trả về response lỗi chuẩn
 */
export function errorResponse(
  error: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error, message, details }, { status })
}

// Error codes chuẩn
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  ALREADY_CHECKED_OUT: 'ALREADY_CHECKED_OUT',
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE',
  GPS_REQUIRED: 'GPS_REQUIRED',
  GPS_ACCURACY_LOW: 'GPS_ACCURACY_LOW',
  OUTSIDE_WORK_HOURS: 'OUTSIDE_WORK_HOURS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
