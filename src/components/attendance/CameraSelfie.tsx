'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  Camera,
  CameraOff,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Timer,
  UploadCloud,
  FlipHorizontal,
  Info,
} from 'lucide-react'

interface CameraSelfieProps {
  onPhotoCaptured: (photoDataUrl: string | null) => void
  capturedPhoto: string | null
  disabled?: boolean
  label?: string
  required?: boolean
}

export default function CameraSelfie({
  onPhotoCaptured,
  capturedPhoto,
  disabled = false,
  label = 'Chụp ảnh khuôn mặt (Selfie)',
  required = false,
}: CameraSelfieProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [isFlashing, setIsFlashing] = useState(false)
  const isInitializingRef = useRef(false)

  // Stop camera tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }, [])

  // Start webcam
  const startCamera = useCallback(async () => {
    if (isInitializingRef.current) return
    isInitializingRef.current = true

    setCameraError(null)
    setPermissionDenied(false)
    stopStream()

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt của bạn không hỗ trợ camera.')
      isInitializingRef.current = false
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setIsStreaming(true)
        }
        await videoRef.current.play().catch(() => {})
        if (videoRef.current.readyState >= 2) {
          setIsStreaming(true)
        }
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      if (
        err.name === 'NotAllowedError' ||
        err.name === 'PermissionDeniedError' ||
        err.message?.includes('denied')
      ) {
        setPermissionDenied(true)
        setCameraError(
          'Quyền truy cập camera đã bị từ chối. Vui lòng cho phép camera trên thanh địa chỉ trình duyệt để tiếp tục.'
        )
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Không tìm thấy thiết bị camera trên thiết bị của bạn.')
      } else {
        setCameraError(`Không thể khởi động camera (${err.name || err.message}).`)
      }
      setIsStreaming(false)
    } finally {
      isInitializingRef.current = false
    }
  }, [facingMode, stopStream])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  // Auto start camera if no photo is captured yet and not disabled
  useEffect(() => {
    if (!capturedPhoto && !disabled && !permissionDenied && !cameraError) {
      startCamera()
    } else if (capturedPhoto) {
      stopStream()
    }
  }, [capturedPhoto, disabled, permissionDenied, cameraError, startCamera, stopStream])

  // Capture instant photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480

    if (video.readyState < 2 || width === 0 || height === 0) {
      setCameraError('Camera đang khởi động, vui lòng đợi trong giây lát rồi chụp lại.')
      return
    }

    const canvas = canvasRef.current || document.createElement('canvas')
    canvasRef.current = canvas

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Flash animation
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 200)

    ctx.save()
    // Mirror image if user facing
    if (facingMode === 'user') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, width, height)
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88)

    onPhotoCaptured(dataUrl)
    stopStream()
  }, [facingMode, onPhotoCaptured, stopStream])

  // Countdown timer capture
  const startCountdown = useCallback(() => {
    if (countdown !== null) return
    setCountdown(3)
  }, [countdown])

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setCountdown(null)
      capturePhoto()
      return
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null))
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, capturePhoto])

  // Retake photo
  const handleRetake = () => {
    onPhotoCaptured(null)
    setCameraError(null)
    setPermissionDenied(false)
    startCamera()
  }

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  // Fallback file upload if camera fails
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onPhotoCaptured(reader.result)
        stopStream()
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-indigo-600" />
          {label}
          {required && <span className="text-rose-500">*</span>}
        </label>
        {capturedPhoto && (
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã chụp ảnh
          </span>
        )}
      </div>

      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-gray-900 rounded-2xl overflow-hidden border border-gray-200 shadow-inner flex items-center justify-center">
        {/* Flash effect overlay */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-200" />
        )}

        {/* 1. Captured Photo Preview */}
        {capturedPhoto ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedPhoto}
              alt="Ảnh selfie chấm công"
              className="w-full h-full object-cover"
            />
            {/* Overlay badge */}
            <div className="absolute top-3 left-3 bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ảnh selfie đã sẵn sàng
            </div>
            {/* Retake button on preview */}
            <button
              type="button"
              onClick={handleRetake}
              disabled={disabled}
              className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              Chụp lại
            </button>
          </div>
        ) : (
          /* 2. Live Camera View */
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              } ${isStreaming ? 'block' : 'hidden'}`}
            />

            {/* Face Oval Overlay Guide */}
            {isStreaming && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                {/* Oval guide */}
                <div className="relative w-48 h-64 sm:w-56 sm:h-72 border-2 border-dashed border-indigo-400/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                  <div className="absolute -top-7 bg-indigo-600/90 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full shadow-sm">
                    Căn chỉnh khuôn mặt
                  </div>
                  {/* Subtle target crosshairs / ticks */}
                  <div className="w-6 h-0.5 bg-indigo-400/60 absolute left-0" />
                  <div className="w-6 h-0.5 bg-indigo-400/60 absolute right-0" />
                  <div className="h-6 w-0.5 bg-indigo-400/60 absolute top-0" />
                  <div className="h-6 w-0.5 bg-indigo-400/60 absolute bottom-0" />
                </div>
              </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center backdrop-blur-xs">
                <div className="text-7xl font-black text-white font-mono animate-ping">
                  {countdown}
                </div>
              </div>
            )}

            {/* Camera controls toolbar on video */}
            {isStreaming && (
              <div className="absolute top-3 right-3 z-15 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Đổi camera trước / sau"
                  className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Camera Error or Permission Denied State */}
            {!isStreaming && (
              <div className="p-6 text-center text-white space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                  <CameraOff className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-100">
                    {permissionDenied ? 'Chưa cấp quyền Camera' : 'Camera chưa khả dụng'}
                  </h4>
                  <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                    {cameraError ||
                      'Vui lòng bật quyền truy cập camera để hệ thống ghi nhận hình ảnh selfie khi chấm công.'}
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Thử lại quyền camera
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Tải ảnh từ thiết bị
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Hidden Canvas & File Input */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Action Buttons underneath camera */}
      {isStreaming && !capturedPhoto && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={startCountdown}
            disabled={disabled || countdown !== null}
            className="py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Timer className="w-4 h-4 text-indigo-600" />
            Hẹn giờ 3s
          </button>

          <button
            type="button"
            onClick={capturePhoto}
            disabled={disabled || countdown !== null}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Chụp selfie ngay
          </button>
        </div>
      )}

      {/* Guide Note */}
      <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100/70 text-[11px] text-indigo-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <span>
          Ảnh selfie ghi lại trực tiếp khuôn mặt nhân viên tại thời điểm chấm công để đối chiếu vị trí GPS và phòng chống gian lận.
        </span>
      </div>
    </div>
  )
}
