import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export const UPLOAD_DIR_NAME = 'uploads/attendance'

/**
 * Ensures that the upload directory exists in public/
 */
export async function ensureUploadDir(): Promise<string> {
  const uploadPath = path.join(process.cwd(), 'public', UPLOAD_DIR_NAME)
  await fs.promises.mkdir(uploadPath, { recursive: true })
  return uploadPath
}

const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Saves a photo from base64 string, Buffer, or File to public/uploads/attendance
 * Returns the public URL path: /uploads/attendance/{filename}
 */
export async function saveAttendancePhoto(
  input: string | Buffer | Uint8Array,
  employeeId: string = 'emp',
  explicitMimeType?: string
): Promise<string> {
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      throw new Error('Dữ liệu ảnh không hợp lệ hoặc rỗng')
    }

    // If it's already an existing relative path to uploads/attendance, sanitize and verify it
    if (trimmed.startsWith(`/${UPLOAD_DIR_NAME}/`)) {
      const normalized = path.normalize(trimmed).replace(/\\/g, '/')
      if (normalized.startsWith(`/${UPLOAD_DIR_NAME}/`) && !normalized.includes('..')) {
        return normalized
      }
      throw new Error('Đường dẫn ảnh uploads không hợp lệ hoặc có dấu hiệu bất thường')
    }

    // Supported external CDN URLs
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
      return trimmed
    }
  }

  const uploadDir = await ensureUploadDir()
  const cleanEmpId = employeeId.replace(/[^a-zA-Z0-9_-]/g, '')
  const randomStr = crypto.randomBytes(4).toString('hex')
  const timestamp = Date.now()

  let buffer: Buffer
  let ext = 'jpg'

  if (typeof input === 'string') {
    const trimmed = input.trim()
    const dataUriMatch = trimmed.match(/^data:([a-zA-Z0-9+/-]+);base64,(.+)$/)

    if (dataUriMatch) {
      const mime = dataUriMatch[1].toLowerCase()
      if (!ALLOWED_MIME_EXTENSIONS[mime]) {
        throw new Error('Định dạng ảnh không được hỗ trợ (chỉ chấp nhận JPG, PNG, WEBP)')
      }
      ext = ALLOWED_MIME_EXTENSIONS[mime]
      buffer = Buffer.from(dataUriMatch[2], 'base64')
    } else {
      // Raw base64 string
      buffer = Buffer.from(trimmed, 'base64')
      if (explicitMimeType && ALLOWED_MIME_EXTENSIONS[explicitMimeType.toLowerCase()]) {
        ext = ALLOWED_MIME_EXTENSIONS[explicitMimeType.toLowerCase()]
      }
    }
  } else if (Buffer.isBuffer(input)) {
    buffer = input
  } else {
    buffer = Buffer.from(input)
  }

  if (buffer.length === 0) {
    throw new Error('Dữ liệu ảnh rỗng hoặc không thể giải mã')
  }

  // Max size: 10MB
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 10MB)')
  }

  // Detect format from explicit MIME or buffer magic bytes if not already determined from data URI
  if (explicitMimeType) {
    const cleanMime = explicitMimeType.toLowerCase()
    if (!ALLOWED_MIME_EXTENSIONS[cleanMime]) {
      throw new Error('Định dạng ảnh không được hỗ trợ (chỉ chấp nhận JPG, PNG, WEBP)')
    }
    ext = ALLOWED_MIME_EXTENSIONS[cleanMime]
  } else if (ext === 'jpg' && buffer.length >= 8) {
    // Check PNG magic bytes: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      ext = 'png'
    } else if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      // WEBP magic bytes: RIFF....WEBP
      ext = 'webp'
    }
  }

  const filename = `selfie_${cleanEmpId}_${timestamp}_${randomStr}.${ext}`
  const filePath = path.join(uploadDir, filename)

  await fs.promises.writeFile(filePath, buffer)

  return `/${UPLOAD_DIR_NAME}/${filename}`
}
