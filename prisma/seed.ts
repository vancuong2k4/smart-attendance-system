import { PrismaClient, UserRole, EmploymentType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Bắt đầu seed database...')

  // ============================================
  // 1. Tạo Company
  // ============================================
  const company = await prisma.company.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: {
      name: 'Demo Company',
      code: 'DEMO',
      taxCode: '0123456789',
      address: 'Hà Nội, Việt Nam',
      phone: '024-1234-5678',
      email: 'info@demo.com',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  })
  console.log('✅ Company:', company.name)

  // ============================================
  // 2. Tạo Branches
  // ============================================
  const branchHN = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HN' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Chi nhánh Hà Nội',
      code: 'HN',
      address: '1 Hà Đông, Hà Nội',
      latitude: 21.028511,
      longitude: 105.834160,
      gpsRadius: 100,
    },
  })

  const branchHCM = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: 'HCM' } },
    update: {},
    create: {
      companyId: company.id,
      name: 'Chi nhánh TP.HCM',
      code: 'HCM',
      address: '123 Nguyễn Huệ, Q1, TP.HCM',
      latitude: 10.776889,
      longitude: 106.700806,
      gpsRadius: 100,
    },
  })
  console.log('✅ Branches:', branchHN.name, '|', branchHCM.name)

  // ============================================
  // 3. Tạo Departments
  // ============================================
  const deptKT_HN = await prisma.department.create({
    data: { branchId: branchHN.id, name: 'Phòng Kỹ thuật', code: 'KT-HN' },
  })
  const deptKD_HN = await prisma.department.create({
    data: { branchId: branchHN.id, name: 'Phòng Kinh doanh', code: 'KD-HN' },
  })
  const deptHR_HN = await prisma.department.create({
    data: { branchId: branchHN.id, name: 'Phòng Nhân sự', code: 'HR-HN' },
  })
  const deptKT_HCM = await prisma.department.create({
    data: { branchId: branchHCM.id, name: 'Phòng Kỹ thuật', code: 'KT-HCM' },
  })
  console.log('✅ Departments tạo xong')

  // ============================================
  // 4. WorkSchedule mặc định
  // ============================================
  await prisma.workSchedule.create({
    data: {
      branchId: branchHN.id,
      name: 'Ca hành chính',
      startTime: '08:00',
      endTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      workDays: [1, 2, 3, 4, 5], // Thứ 2-6
      lateThreshold: 15,
      earlyThreshold: 15,
      isDefault: true,
    },
  })
  await prisma.workSchedule.create({
    data: {
      branchId: branchHCM.id,
      name: 'Ca hành chính',
      startTime: '08:00',
      endTime: '17:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      workDays: [1, 2, 3, 4, 5],
      lateThreshold: 15,
      earlyThreshold: 15,
      isDefault: true,
    },
  })
  console.log('✅ WorkSchedules tạo xong')

  // ============================================
  // 5. LeaveTypes
  // ============================================
  const leaveTypes = [
    { code: 'AL', name: 'Nghỉ phép năm', isPaid: true, maxDaysPerYear: 12, requireApproval: true },
    { code: 'SL', name: 'Nghỉ ốm', isPaid: true, maxDaysPerYear: 10, requireApproval: true },
    { code: 'ML', name: 'Nghỉ thai sản', isPaid: true, maxDaysPerYear: null, requireApproval: true },
    { code: 'UL', name: 'Nghỉ không lương', isPaid: false, maxDaysPerYear: null, requireApproval: true },
    { code: 'PH', name: 'Nghỉ lễ', isPaid: true, maxDaysPerYear: null, requireApproval: false },
    { code: 'WH', name: 'Làm việc tại nhà', isPaid: true, maxDaysPerYear: null, requireApproval: true },
    { code: 'BT', name: 'Công tác', isPaid: true, maxDaysPerYear: null, requireApproval: true },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    })
  }
  console.log('✅ LeaveTypes tạo xong')

  // ============================================
  // 6. Users & Employees
  // ============================================
  const hashedPassword = await bcrypt.hash('Admin@123', 12)

  // Super Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      employee: {
        create: {
          employeeCode: 'ADM001',
          branchId: branchHN.id,
          departmentId: deptHR_HN.id,
          fullName: 'Super Admin',
          position: 'System Administrator',
          startDate: new Date('2020-01-01'),
          employmentType: EmploymentType.FULL_TIME,
        },
      },
    },
  })

  // Branch Admin HN
  await prisma.user.upsert({
    where: { email: 'admin.hn@demo.com' },
    update: {},
    create: {
      email: 'admin.hn@demo.com',
      passwordHash: hashedPassword,
      role: UserRole.BRANCH_ADMIN,
      employee: {
        create: {
          employeeCode: 'ADM002',
          branchId: branchHN.id,
          departmentId: deptHR_HN.id,
          fullName: 'Quản lý HN',
          position: 'Branch Manager',
          startDate: new Date('2021-01-01'),
          employmentType: EmploymentType.FULL_TIME,
        },
      },
    },
  })

  // HR Manager
  await prisma.user.upsert({
    where: { email: 'hr@demo.com' },
    update: {},
    create: {
      email: 'hr@demo.com',
      passwordHash: hashedPassword,
      role: UserRole.HR_MANAGER,
      employee: {
        create: {
          employeeCode: 'HR001',
          branchId: branchHN.id,
          departmentId: deptHR_HN.id,
          fullName: 'HR Manager',
          position: 'Human Resources Manager',
          startDate: new Date('2021-06-01'),
          employmentType: EmploymentType.FULL_TIME,
        },
      },
    },
  })

  // Sample Employees
  const employees = [
    { email: 'nv001@demo.com', code: 'NV001', name: 'Nguyễn Văn A', dept: deptKT_HN.id, branch: branchHN.id },
    { email: 'nv002@demo.com', code: 'NV002', name: 'Trần Thị B', dept: deptKD_HN.id, branch: branchHN.id },
    { email: 'nv003@demo.com', code: 'NV003', name: 'Lê Văn C', dept: deptKT_HN.id, branch: branchHN.id },
    { email: 'nv004@demo.com', code: 'NV004', name: 'Phạm Thị D', dept: deptKT_HCM.id, branch: branchHCM.id },
    { email: 'nv005@demo.com', code: 'NV005', name: 'Hoàng Văn E', dept: deptKT_HCM.id, branch: branchHCM.id },
  ]

  for (const emp of employees) {
    const empPassword = await bcrypt.hash('Nv@123456', 12)
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash: empPassword,
        role: UserRole.EMPLOYEE,
        employee: {
          create: {
            employeeCode: emp.code,
            branchId: emp.branch,
            departmentId: emp.dept,
            fullName: emp.name,
            position: 'Nhân viên',
            startDate: new Date('2022-01-01'),
            employmentType: EmploymentType.FULL_TIME,
          },
        },
      },
    })
  }

  console.log('✅ Users & Employees tạo xong')
  console.log('\n🎉 Seed hoàn thành!')
  console.log('\n📋 Tài khoản demo:')
  console.log('  Super Admin : admin@demo.com    / Admin@123')
  console.log('  Branch Admin: admin.hn@demo.com / Admin@123')
  console.log('  HR Manager  : hr@demo.com       / Admin@123')
  console.log('  Employee    : nv001@demo.com    / Nv@123456')
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
