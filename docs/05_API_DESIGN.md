# 🚀 API Design — Thiết kế API

> RESTful API endpoints cho hệ thống chấm công.
> Base URL: `/api/v1`

---

## 1. Authentication

### POST `/api/auth/login`
Đăng nhập

**Request:**
```json
{
  "email": "nhanvien@company.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "clx123",
    "email": "nhanvien@company.com",
    "role": "EMPLOYEE",
    "employee": {
      "id": "emp123",
      "fullName": "Nguyễn Văn A",
      "employeeCode": "NV001",
      "branch": { "id": "br1", "name": "Chi nhánh Hà Nội" }
    }
  },
  "token": "jwt_token_here"
}
```

### POST `/api/auth/logout`
### POST `/api/auth/change-password`
### POST `/api/auth/forgot-password`

---

## 2. Attendance (Chấm công)

### POST `/api/attendance/check-in`
**🔐 Role:** EMPLOYEE

**Request:**
```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 15.5,
  "deviceInfo": "Mozilla/5.0 Chrome/120"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "att123",
    "checkInTime": "2024-01-15T08:02:35+07:00",
    "isLate": false,
    "lateMinutes": 0,
    "distanceFromBranch": 45.2,
    "message": "Check-in thành công lúc 08:02"
  }
}
```

**Response 400 — Ngoài vùng GPS:**
```json
{
  "success": false,
  "error": "OUTSIDE_GEOFENCE",
  "message": "Bạn đang cách văn phòng 350m. Vui lòng di chuyển vào khu vực cho phép (100m).",
  "data": {
    "distance": 350,
    "allowedRadius": 100
  }
}
```

**Response 400 — Đã check-in:**
```json
{
  "success": false,
  "error": "ALREADY_CHECKED_IN",
  "message": "Bạn đã check-in lúc 08:02 hôm nay."
}
```

### POST `/api/attendance/check-out`
**🔐 Role:** EMPLOYEE

**Request:**
```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 20.0,
  "deviceInfo": "Mozilla/5.0 Chrome/120"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "checkOutTime": "2024-01-15T17:05:00+07:00",
    "workDuration": 8.08,
    "workDays": 1,
    "isEarlyLeave": false,
    "message": "Check-out thành công. Thời gian làm việc: 8 giờ 5 phút"
  }
}
```

### GET `/api/attendance/today`
**🔐 Role:** EMPLOYEE
Lấy trạng thái chấm công hôm nay của nhân viên đang đăng nhập.

**Response:**
```json
{
  "date": "2024-01-15",
  "checkInTime": "08:02",
  "checkOutTime": null,
  "status": "CHECKED_IN",
  "isLate": false,
  "workDuration": null
}
```

### GET `/api/attendance/history`
**🔐 Role:** EMPLOYEE
Query params: `?from=2024-01-01&to=2024-01-31&page=1&limit=20`

### GET `/api/attendance/records`
**🔐 Role:** BRANCH_ADMIN, HR_MANAGER, SUPER_ADMIN
Query params: `?branchId=&departmentId=&employeeId=&from=&to=&status=&page=&limit=`

### PATCH `/api/attendance/:id`
**🔐 Role:** BRANCH_ADMIN, HR_MANAGER
Điều chỉnh chấm công thủ công (ghi nhận audit log).

### POST `/api/attendance/adjustments`
**🔐 Role:** ALL (Nhân viên nộp đơn giải trình quên chấm công / lỗi GPS / công tác ngoài)

### GET `/api/attendance/adjustments`
**🔐 Role:** ALL (Phân quyền theo RBAC: Employee xem cá nhân, Branch Admin xem chi nhánh, HR/Super Admin xem toàn bộ)

### GET `/api/attendance/adjustments/:id`
**🔐 Role:** ALL (Xem chi tiết đơn giải trình)

### PATCH `/api/attendance/adjustments/:id/approve`
**🔐 Role:** BRANCH_ADMIN, HR_MANAGER, SUPER_ADMIN (Phê duyệt hoặc từ chối giải trình kèm cập nhật AttendanceRecord & ghi nhận AuditLog)

### DELETE `/api/attendance/adjustments/:id`
**🔐 Role:** EMPLOYEE (chính chủ), SUPER_ADMIN (Hủy đơn đang chờ duyệt)

---

## 3. Employees (Nhân viên)

### GET `/api/employees`
**🔐 Role:** BRANCH_ADMIN, HR_MANAGER, SUPER_ADMIN
Query params: `?branchId=&departmentId=&status=active&search=&page=&limit=`

### POST `/api/employees`
**🔐 Role:** BRANCH_ADMIN (chi nhánh mình), SUPER_ADMIN
Tạo nhân viên mới kèm tài khoản user.

### GET `/api/employees/:id`
### PATCH `/api/employees/:id`
### DELETE `/api/employees/:id` (Soft delete — set endDate)

---

## 4. Leave Management (Nghỉ phép)

### POST `/api/leaves`
**🔐 Role:** EMPLOYEE
Nộp đơn xin nghỉ.

**Request:**
```json
{
  "leaveTypeId": "lt_AL",
  "startDate": "2024-01-20",
  "endDate": "2024-01-22",
  "totalDays": 3,
  "reason": "Nghỉ phép cá nhân"
}
```

### GET `/api/leaves`
**🔐 Role:** EMPLOYEE (xem của mình), BRANCH_ADMIN/HR (xem tất cả)
Query params: `?employeeId=&status=PENDING&from=&to=`

### PATCH `/api/leaves/:id/approve`
**🔐 Role:** BRANCH_ADMIN, HR_MANAGER
```json
{ "action": "APPROVED" | "REJECTED", "rejectReason": "..." }
```

### DELETE `/api/leaves/:id`
**🔐 Role:** EMPLOYEE (hủy đơn của mình khi còn PENDING)

---

## 5. Reports & Export (Báo cáo)

### GET `/api/reports/summary`
**🔐 Role:** HR_MANAGER, SUPER_ADMIN
Query params: `?branchId=&year=2024&month=1`

**Response:**
```json
{
  "period": { "year": 2024, "month": 1 },
  "summary": {
    "totalWorkdays": 23,
    "totalEmployees": 85,
    "averageAttendanceRate": 96.5,
    "totalAbsences": 12,
    "totalLate": 34,
    "totalOTHours": 120.5
  },
  "byBranch": [...]
}
```

### GET `/api/reports/payroll-export`
**🔐 Role:** HR_MANAGER, SUPER_ADMIN
Query params: `?branchId=&year=2024&month=1&format=xlsx|csv|json`

**Response:** File download (Excel/CSV) hoặc JSON array

**Cấu trúc dữ liệu xuất:**
```json
[
  {
    "employee_code": "NV001",
    "employee_name": "Nguyễn Văn A",
    "department": "Kỹ thuật",
    "branch": "Chi nhánh Hà Nội",
    "work_days": 22.5,
    "absent_days": 0.5,
    "paid_leave_days": 1,
    "late_count": 2,
    "ot_hours": 8.5,
    "period_start": "2024-01-01",
    "period_end": "2024-01-31"
  }
]
```

---

## 6. Branches & Settings

### GET `/api/branches`
### POST `/api/branches`
### PATCH `/api/branches/:id`
### GET `/api/branches/:id/location` — Lấy GPS location của chi nhánh
### PATCH `/api/branches/:id/location` — Cập nhật GPS location

---

## 7. Error Response Format (Chuẩn)

```json
{
  "success": false,
  "error": "ERROR_CODE",        // Machine-readable error code
  "message": "Mô tả lỗi",      // Human-readable message (tiếng Việt)
  "details": {}                  // Optional: extra context
}
```

**Common Error Codes:**

| Code | HTTP | Mô tả |
|---|---|---|
| `UNAUTHORIZED` | 401 | Chưa đăng nhập |
| `FORBIDDEN` | 403 | Không có quyền |
| `NOT_FOUND` | 404 | Không tìm thấy |
| `ALREADY_CHECKED_IN` | 400 | Đã chấm công vào |
| `ALREADY_CHECKED_OUT` | 400 | Đã chấm công ra |
| `OUTSIDE_GEOFENCE` | 400 | Ngoài vùng GPS |
| `GPS_REQUIRED` | 400 | Cần bật GPS |
| `OUTSIDE_WORK_HOURS` | 400 | Ngoài giờ làm việc |
| `VALIDATION_ERROR` | 422 | Dữ liệu không hợp lệ |
| `INTERNAL_ERROR` | 500 | Lỗi server |

---

## 8. Rate Limiting

| Endpoint | Giới hạn |
|---|---|
| POST `/api/attendance/check-in` | 5 req / 5 phút / user |
| POST `/api/attendance/check-out` | 5 req / 5 phút / user |
| POST `/api/auth/login` | 10 req / 15 phút / IP |
| GET `/api/reports/*` | 20 req / phút / user |
