import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Clock, Users, FileText, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isEmployee = session.user.role === 'EMPLOYEE'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Chào mừng, {session.user.employee?.fullName ?? session.user.email}! 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isEmployee ? (
          <>
            <StatCard icon={<Clock className="text-indigo-600" size={24} />} label="Ngày công tháng này" value="--" bg="bg-indigo-50" />
            <StatCard icon={<TrendingUp className="text-green-600" size={24} />} label="Phép còn lại" value="--" bg="bg-green-50" />
            <StatCard icon={<FileText className="text-orange-600" size={24} />} label="Đơn đang chờ" value="--" bg="bg-orange-50" />
            <StatCard icon={<Clock className="text-purple-600" size={24} />} label="Giờ OT tháng này" value="--" bg="bg-purple-50" />
          </>
        ) : (
          <>
            <StatCard icon={<Users className="text-indigo-600" size={24} />} label="Tổng nhân viên" value="--" bg="bg-indigo-50" />
            <StatCard icon={<Clock className="text-green-600" size={24} />} label="Có mặt hôm nay" value="--" bg="bg-green-50" />
            <StatCard icon={<Clock className="text-red-600" size={24} />} label="Vắng mặt hôm nay" value="--" bg="bg-red-50" />
            <StatCard icon={<FileText className="text-orange-600" size={24} />} label="Đơn chờ duyệt" value="--" bg="bg-orange-50" />
          </>
        )}
      </div>

      {/* Placeholder content */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        <Clock size={48} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">Dashboard đang được phát triển</p>
        <p className="text-sm mt-1">Các tính năng sẽ được cập nhật trong Sprint tiếp theo</p>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string
  bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
