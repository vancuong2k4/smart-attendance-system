import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Đăng nhập',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-bold shadow-lg mb-4">
            SA
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Attendance</h1>
          <p className="text-gray-500 text-sm mt-1">Hệ thống chấm công GPS</p>
        </div>
        {children}
      </div>
    </div>
  )
}
