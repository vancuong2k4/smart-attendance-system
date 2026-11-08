import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      employee?: {
        id: string
        fullName: string
        employeeCode: string
        branchId: string
        departmentId: string
        position?: string | null
        avatarUrl?: string | null
      } | null
    }
  }

  interface User {
    role: UserRole
    employee?: {
      id: string
      fullName: string
      employeeCode: string
      branchId: string
      departmentId: string
      position?: string | null
      avatarUrl?: string | null
    } | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    employee?: {
      id: string
      fullName: string
      employeeCode: string
      branchId: string
      departmentId: string
      position?: string | null
      avatarUrl?: string | null
    } | null
  }
}
