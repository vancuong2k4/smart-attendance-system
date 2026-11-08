# 🗄️ Database Design — Thiết kế cơ sở dữ liệu

> Prisma Schema và mô tả chi tiết các bảng dữ liệu.

---

## 1. Entity Relationship Diagram (ERD)

```
Company ──< Branch ──< Department ──< Employee
                │                        │
                │                   AttendanceRecord
                │                        │
           WorkSchedule              LeaveRequest
           (per branch)                  │
                                     LeaveType
                                     
Employee ──< OvertimeRequest
Employee ──< Notification
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════
// ORGANIZATION STRUCTURE
// ═══════════════════════════════════════

model Company {
  id          String   @id @default(cuid())
  name        String
  code        String   @unique        // Mã công ty
  taxCode     String?                 // Mã số thuế
  address     String?
  phone       String?
  email       String?
  logoUrl     String?
  
  // Cấu hình chung
  timezone    String   @default("Asia/Ho_Chi_Minh")
  currency    String   @default("VND")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  branches    Branch[]
}

model Branch {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  code        String                  // Mã chi nhánh (unique trong company)
  address     String?
  phone       String?
  
  // GPS Location
  latitude    Float                   // Tọa độ trung tâm chi nhánh
  longitude   Float
  gpsRadius   Int      @default(100)  // Bán kính cho phép (mét)
  
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company     Company      @relation(fields: [companyId], references: [id])
  departments Department[]
  employees   Employee[]
  schedules   WorkSchedule[]
  
  @@unique([companyId, code])
}

model Department {
  id        String   @id @default(cuid())
  branchId  String
  name      String
  code      String?
  managerId String?  // Employee ID của trưởng phòng
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  branch    Branch     @relation(fields: [branchId], references: [id])
  employees Employee[]
}

// ═══════════════════════════════════════
// USER & EMPLOYEE
// ═══════════════════════════════════════

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  role          UserRole  @default(EMPLOYEE)
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  employee      Employee?
  sessions      Session[]
}

enum UserRole {
  SUPER_ADMIN    // Quản trị toàn hệ thống
  BRANCH_ADMIN   // Quản trị chi nhánh
  HR_MANAGER     // HR - xem báo cáo, duyệt đơn, xuất lương
  EMPLOYEE       // Nhân viên thường
}

model Employee {
  id              String    @id @default(cuid())
  userId          String    @unique
  employeeCode    String    @unique         // Mã nhân viên (NV001, ...)
  branchId        String
  departmentId    String
  
  // Thông tin cá nhân
  fullName        String
  dateOfBirth     DateTime?
  gender          Gender?
  phoneNumber     String?
  address         String?
  avatarUrl       String?
  
  // Thông tin công việc
  position        String?                   // Chức danh
  startDate       DateTime                  // Ngày bắt đầu làm
  endDate         DateTime?                 // Ngày nghỉ việc (null = đang làm)
  employmentType  EmploymentType @default(FULL_TIME)
  
  // Chính sách phép năm
  annualLeaveBalance   Float  @default(12) // Số ngày phép còn lại
  sickLeaveBalance     Float  @default(10)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  user            User          @relation(fields: [userId], references: [id])
  branch          Branch        @relation(fields: [branchId], references: [id])
  department      Department    @relation(fields: [departmentId], references: [id])
  attendances     AttendanceRecord[]
  leaveRequests   LeaveRequest[]
  overtimeRequests OvertimeRequest[]
  notifications   Notification[]
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  PROBATION  // Thử việc
}

// ═══════════════════════════════════════
// WORK SCHEDULE (CA LÀM VIỆC)
// ═══════════════════════════════════════

model WorkSchedule {
  id              String    @id @default(cuid())
  branchId        String
  name            String    // "Hành chính", "Ca sáng", ...
  
  startTime       String    // "08:00" (HH:mm)
  endTime         String    // "17:00"
  lunchStart      String?   // "12:00"
  lunchEnd        String?   // "13:00"
  
  // Ngày làm việc trong tuần (bitmask hoặc JSON)
  workDays        Int[]     // [1,2,3,4,5] = Thứ 2-6 (1=Monday)
  
  // Buffer time (phút)
  lateThreshold   Int       @default(15)   // Muộn ≤ 15 phút: cảnh báo
  earlyThreshold  Int       @default(15)   // Về sớm ≤ 15 phút: cảnh báo
  
  isDefault       Boolean   @default(false)
  isActive        Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  branch          Branch    @relation(fields: [branchId], references: [id])
}

// ═══════════════════════════════════════
// ATTENDANCE (CHẤM CÔNG)
// ═══════════════════════════════════════

model AttendanceRecord {
  id              String            @id @default(cuid())
  employeeId      String
  date            DateTime          @db.Date   // Ngày làm việc
  
  // Check-in data
  checkInTime     DateTime?
  checkInLat      Float?
  checkInLon      Float?
  checkInAccuracy Float?            // Độ chính xác GPS (mét)
  checkInMethod   AttendanceMethod  @default(GPS)
  checkInDevice   String?           // User agent string
  checkInPhoto    String?           // URL ảnh selfie (optional)
  
  // Check-out data
  checkOutTime    DateTime?
  checkOutLat     Float?
  checkOutLon     Float?
  checkOutAccuracy Float?
  checkOutMethod  AttendanceMethod  @default(GPS)
  checkOutDevice  String?
  
  // Computed fields (tính toán sau khi check-out)
  workDuration    Float?            // Giờ làm thực tế
  workDays        Float?            // 0, 0.5, hoặc 1
  isLate          Boolean?          // Đi muộn
  lateMinutes     Int?              // Muộn bao nhiêu phút
  isEarlyLeave    Boolean?          // Về sớm
  earlyMinutes    Int?
  
  status          AttendanceStatus  @default(PRESENT)
  note            String?
  
  // Admin override
  isManualEntry   Boolean           @default(false)
  approvedById    String?
  approvedAt      DateTime?
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  employee        Employee          @relation(fields: [employeeId], references: [id])
  
  @@unique([employeeId, date])      // 1 bản ghi / ngày / nhân viên
  @@index([date])
  @@index([employeeId, date])
}

enum AttendanceMethod {
  GPS           // Chấm công GPS bình thường
  MANUAL        // HR nhập tay
  ADMIN_OVERRIDE // Admin điều chỉnh
}

enum AttendanceStatus {
  PRESENT       // Có mặt
  ABSENT        // Vắng mặt
  LEAVE         // Nghỉ phép (có đơn)
  HOLIDAY       // Ngày lễ
  WEEKEND       // Cuối tuần
  HALF_DAY      // Nửa ngày
}

// ═══════════════════════════════════════
// LEAVE MANAGEMENT (NGHỈ PHÉP)
// ═══════════════════════════════════════

model LeaveType {
  id            String   @id @default(cuid())
  code          String   @unique   // AL, SL, ML, UL, PH, WH, BT
  name          String             // Tên loại nghỉ
  isPaid        Boolean            // Có lương không
  maxDaysPerYear Int?              // Giới hạn ngày/năm
  requireApproval Boolean @default(true)
  
  leaveRequests LeaveRequest[]
}

model LeaveRequest {
  id            String        @id @default(cuid())
  employeeId    String
  leaveTypeId   String
  
  startDate     DateTime      @db.Date
  endDate       DateTime      @db.Date
  totalDays     Float                    // Tính cả nửa ngày
  reason        String?
  attachmentUrl String?                  // File đính kèm (giấy khám bệnh, ...)
  
  status        LeaveStatus   @default(PENDING)
  
  // Approval
  approvedById  String?
  approvedAt    DateTime?
  rejectReason  String?
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  employee      Employee      @relation(fields: [employeeId], references: [id])
  leaveType     LeaveType     @relation(fields: [leaveTypeId], references: [id])
}

enum LeaveStatus {
  PENDING     // Chờ duyệt
  APPROVED    // Đã duyệt
  REJECTED    // Từ chối
  CANCELLED   // Nhân viên hủy
}

// ═══════════════════════════════════════
// OVERTIME (LÀM THÊM GIỜ)
// ═══════════════════════════════════════

model OvertimeRequest {
  id            String        @id @default(cuid())
  employeeId    String
  date          DateTime      @db.Date
  startTime     String        // "17:30"
  endTime       String        // "20:00"
  hours         Float         // Tổng giờ OT
  reason        String?
  
  status        LeaveStatus   @default(PENDING)
  approvedById  String?
  approvedAt    DateTime?
  rejectReason  String?
  
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  employee      Employee      @relation(fields: [employeeId], references: [id])
}

// ═══════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════

model Notification {
  id          String    @id @default(cuid())
  employeeId  String
  type        String    // CHECKIN_SUCCESS, CHECKOUT_REMINDER, LEAVE_APPROVED, ...
  title       String
  message     String
  isRead      Boolean   @default(false)
  link        String?   // Deep link đến trang liên quan
  
  createdAt   DateTime  @default(now())
  
  employee    Employee  @relation(fields: [employeeId], references: [id])
  
  @@index([employeeId, isRead])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  userAgent String?
  ipAddress String?
  
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ═══════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  action      String   // CREATE_ATTENDANCE, APPROVE_LEAVE, ...
  entity      String   // AttendanceRecord, LeaveRequest, ...
  entityId    String
  oldData     Json?    // Dữ liệu trước khi thay đổi
  newData     Json?    // Dữ liệu sau khi thay đổi
  ipAddress   String?
  
  createdAt   DateTime @default(now())
  
  @@index([entity, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

---

## 3. Indexes quan trọng

```sql
-- Query chấm công theo tháng (thường dùng nhất)
CREATE INDEX idx_attendance_employee_month 
  ON attendance_records(employee_id, date);

-- Query báo cáo theo chi nhánh
CREATE INDEX idx_employees_branch 
  ON employees(branch_id);

-- Query notifications chưa đọc
CREATE INDEX idx_notifications_unread 
  ON notifications(employee_id, is_read) 
  WHERE is_read = false;
```

---

## 4. Seed Data mặc định

```typescript
// Seed LeaveTypes
const defaultLeaveTypes = [
  { code: 'AL', name: 'Nghỉ phép năm', isPaid: true, maxDaysPerYear: 12 },
  { code: 'SL', name: 'Nghỉ ốm', isPaid: true, maxDaysPerYear: 10 },
  { code: 'ML', name: 'Nghỉ thai sản', isPaid: true, maxDaysPerYear: null },
  { code: 'UL', name: 'Nghỉ không lương', isPaid: false, maxDaysPerYear: null },
  { code: 'PH', name: 'Nghỉ lễ', isPaid: true, requireApproval: false },
  { code: 'WH', name: 'Làm việc tại nhà', isPaid: true, maxDaysPerYear: null },
  { code: 'BT', name: 'Công tác', isPaid: true, maxDaysPerYear: null },
];
```
