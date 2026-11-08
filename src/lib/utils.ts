import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility để merge Tailwind classes (dùng cho ShadCN)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format số ngày công hiển thị
 */
export function formatWorkDays(days: number): string {
  if (days === 1) return '1 công'
  if (days === 0.5) return '0.5 công'
  return '0 công'
}

/**
 * Format thời gian HH:mm từ Date
 */
export function formatTime(date: Date | string | null): string {
  if (!date) return '--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

/**
 * Format ngày dd/MM/yyyy
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '--'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

/**
 * Format số phút thành "X giờ Y phút"
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} phút`
  if (mins === 0) return `${hours} giờ`
  return `${hours} giờ ${mins} phút`
}

/**
 * Lấy ngày đầu tháng và cuối tháng
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return { start, end }
}
