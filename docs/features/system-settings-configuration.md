# Cấu hình Hệ thống & Cài đặt Chung (System Settings & Organization Configuration)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Quản lý Cấu hình Toàn cục, Hồ sơ Doanh nghiệp, Quy tắc Điểm danh, Tính lương, Phép năm và Bảo mật cho Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Cấu hình Hệ thống & Cài đặt Chung** là trung tâm điều khiển (Control Plane) của toàn bộ hệ thống doanh nghiệp, mang lại sự linh hoạt tuyệt đối cho Ban quản trị trong việc tùy biến mọi quy tắc vận hành mà không cần chỉnh sửa mã nguồn:

1. **Hồ sơ Doanh nghiệp (Organization Profile)**:
   - Tên pháp lý công ty, mã doanh nghiệp, mã số thuế (Tax Code).
   - Địa chỉ trụ sở, số điện thoại, email liên hệ, URL logo thương hiệu.
   - Thiết lập múi giờ chuẩn (`Asia/Ho_Chi_Minh`) và đơn vị tiền tệ giao dịch (`VND`, `USD`).
2. **Quy tắc Chấm công & Geofence GPS (Attendance & Geofencing Rules)**:
   - Khung giờ hợp lệ cho phép Check-in và Check-out hàng ngày.
   - Ngưỡng thời gian đi muộn và về sớm cho phép (Grace Period Thresholds - tính bằng phút).
   - Bắt buộc kiểm tra Geofence GPS và độ chính xác GPS tối thiểu (10m - 500m).
   - Bắt buộc chụp ảnh khuôn mặt selfie khi chấm công để chống gian lận (anti-proxy attendance).
3. **Chu kỳ Lương & Hệ số Tăng ca (Payroll Cycles & Overtime Rates)**:
   - Ngày bắt đầu và kết thúc kỳ lương hàng tháng (1 - 31).
   - Ngày chốt sổ / khóa dữ liệu công nợ tháng (Attendance Lock Day: 1 - 28).
   - Số ngày công chuẩn của tháng làm việc (mặc định 22 ngày).
   - Hệ số lương làm thêm giờ (OT Rate) phân tầng: Ngày thường (1.5x), Cuối tuần (2.0x), Ngày lễ/Tết (3.0x).
4. **Chính sách Nghỉ phép & Chuyển tiếp (Leave Policies & Carry Over)**:
   - Định mức ngày phép năm có lương mặc định (Default Annual Leave: 12 ngày).
   - Định mức ngày nghỉ ốm hưởng bảo hiểm/lương (Default Sick Leave: 10 ngày).
   - Cho phép chuyển tiếp ngày phép còn dư sang năm tiếp theo, giới hạn số ngày cộng dồn (Max Carry-over Days) và thời hạn chốt hết hiệu lực phép cũ (hết tháng 3 hàng năm).
5. **Thông báo & Bảo mật Hệ thống (Notifications & Security Settings)**:
   - Tự động gửi thông báo khi nhân viên đi muộn hoặc về sớm.
   - Nhắc nhở chấm công đầu ca và cuối ca làm việc.
   - Cấu hình thời gian hết hạn phiên đăng nhập (Session Timeout - tính bằng phút).
   - Cơ chế Khôi phục Cài đặt Gốc (Reset to Defaults) có hộp thoại xác nhận an toàn.
   - Xuất bản chụp cấu hình hệ thống & thông số chẩn đoán toàn diện (JSON Configuration & Diagnostic Snapshot).

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

Hệ thống thiết kế bảng `SystemSetting` với quan hệ 1-1 gắn liền với bảng `Company`:

```prisma
model SystemSetting {
  id                    String   @id @default(uuid())
  companyId             String   @unique
  company               Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  // 1. Attendance & GPS Rules
  checkInWindowStart    String   @default("06:00")
  checkInWindowEnd      String   @default("10:30")
  checkOutWindowStart   String   @default("11:00")
  checkOutWindowEnd     String   @default("23:00")
  defaultLateThreshold  Int      @default(15) // phút
  defaultEarlyThreshold Int      @default(15) // phút
  requireSelfie         Boolean  @default(false)
  requireGps            Boolean  @default(true)
  maxGpsAccuracyMeters  Int      @default(50) // mét

  // 2. Payroll & Cycle Settings
  payrollStartDay       Int      @default(1)
  payrollEndDay         Int      @default(31)
  attendanceLockDay     Int      @default(5)
  standardWorkDaysMonth Float    @default(22.0)
  otRateWeekday         Float    @default(1.5)
  otRateWeekend         Float    @default(2.0)
  otRateHoliday         Float    @default(3.0)

  // 3. Leave Policy Rules
  defaultAnnualLeave    Float    @default(12.0)
  defaultSickLeave      Float    @default(10.0)
  allowCarryOverLeave   Boolean  @default(true)
  maxCarryOverDays      Float    @default(5.0)
  carryOverDeadline     Int      @default(3) // Tháng 3

  // 4. Notifications & Security
  notifyLateArrival     Boolean  @default(true)
  notifyEarlyLeave      Boolean  @default(true)
  checkInReminder       Boolean  @default(true)
  checkOutReminder      Boolean  @default(true)
  sessionTimeoutMinutes Int      @default(1440) // 24 giờ

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

Mọi thay đổi cấu hình hoặc khôi phục cài đặt gốc đều được tự động ghi nhận vào bảng `AuditLog` với `action: "SYSTEM_SETTINGS_UPDATED"`, `"COMPANY_PROFILE_UPDATED"` hoặc `"SYSTEM_SETTINGS_RESET"`, lưu vết đầy đủ `oldData` và `newData`.

---

## 3. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền (RBAC) | Mô tả chi tiết |
|---|---|---|---|
| `GET` | `/api/settings` | `AUTHENTICATED` | Lấy toàn bộ thông tin hồ sơ doanh nghiệp và cấu hình hệ thống |
| `PATCH` | `/api/settings` | `SUPER_ADMIN` | Cập nhật các quy tắc chấm công, chu kỳ lương, phép năm và thông báo |
| `PATCH` | `/api/settings/company` | `SUPER_ADMIN` | Cập nhật thông tin nhận diện doanh nghiệp (tên, thuế, địa chỉ, logo) |
| `POST` | `/api/settings/reset` | `SUPER_ADMIN` | Khôi phục toàn bộ cài đặt hệ thống về trạng thái tiêu chuẩn doanh nghiệp |
| `GET` | `/api/settings/export` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Xuất file JSON chẩn đoán và toàn bộ tham số cấu hình hệ thống |

---

## 4. Chi tiết các API Endpoints

### 4.1 `GET /api/settings`
- **Mục đích**: Lấy thông tin cấu hình phục vụ hiển thị màn hình cài đặt và cung cấp các quy tắc cho luồng chấm công.
- **Phân quyền**: Tất cả người dùng đã đăng nhập (để client đồng bộ các quy tắc như GPS/Selfie).
- **Response mẫu**:
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "cly123456",
      "name": "Smart Attendance Enterprise Corp",
      "code": "SAEC",
      "taxCode": "0102030405",
      "address": "Tòa nhà Landmark 81, TP. HCM",
      "phone": "0901234567",
      "email": "contact@enterprise.com",
      "timezone": "Asia/Ho_Chi_Minh",
      "currency": "VND"
    },
    "settings": {
      "id": "set123456",
      "checkInWindowStart": "06:00",
      "checkInWindowEnd": "10:30",
      "defaultLateThreshold": 15,
      "requireSelfie": true,
      "requireGps": true,
      "maxGpsAccuracyMeters": 50,
      "otRateWeekday": 1.5,
      "defaultAnnualLeave": 12.0
    }
  }
}
```

### 4.2 `PATCH /api/settings`
- **Mục đích**: Chỉnh sửa các tham số quy tắc. Hỗ trợ cập nhật từng phần (Partial Update) theo từng tab giao diện hoặc toàn bộ.
- **Phân quyền**: Chỉ `SUPER_ADMIN`. Người dùng có quyền thấp hơn sẽ nhận lỗi `403 FORBIDDEN`.
- **Validation**:
  - `checkInWindowStart`, `checkInWindowEnd`: Định dạng giờ `HH:mm`.
  - `defaultLateThreshold`, `defaultEarlyThreshold`: Số nguyên từ `0` đến `120`.
  - `maxGpsAccuracyMeters`: Số nguyên từ `10` đến `500`.
  - `otRateWeekday`, `otRateWeekend`, `otRateHoliday`: Số thực từ `1.0` đến `5.0`.
  - `sessionTimeoutMinutes`: Số nguyên từ `15` đến `10080` (7 ngày).

### 4.3 `POST /api/settings/reset`
- **Mục đích**: Khôi phục cài đặt về `DEFAULT_SYSTEM_SETTINGS`.
- **Phân quyền**: Chỉ `SUPER_ADMIN`.
- **Ghi log**: Tạo bản ghi `AuditLog` lưu lại toàn bộ trạng thái trước khi reset.

### 4.4 `GET /api/settings/export`
- **Mục đích**: Tạo file sao lưu cấu hình định dạng JSON kèm theo thông số vận hành (số chi nhánh, số nhân viên, số lịch ca).
- **Phân quyền**: `SUPER_ADMIN` và `BRANCH_ADMIN`.

---

## 5. Giao diện Người dùng (Dashboard UI)

Trang quản lý cấu hình được tổ chức tại đường dẫn `/settings`:

1. **Điều hướng Tab chuyên biệt**:
   - `Hồ sơ công ty`: Tên, mã số thuế, địa chỉ, hotline, email, logo URL, múi giờ và tiền tệ.
   - `Quy tắc Chấm công`: Khung giờ check-in/out, ngưỡng đi muộn/về sớm, GPS Geofencing, độ chính xác GPS và Face Selfie.
   - `Chu kỳ & Tính lương`: Ngày bắt đầu/kết thúc chu kỳ, ngày khóa công nợ, số ngày công chuẩn và hệ số OT 3 cấp.
   - `Chính sách Phép`: Định mức phép năm, phép ốm, chuyển tiếp phép dư và hạn chót sử dụng.
   - `Thông báo & Bảo mật`: Bật/tắt thông báo tự động, thời gian timeout phiên, chức năng Xuất file cấu hình JSON và Khôi phục cài đặt gốc.
2. **Trải nghiệm Người dùng**:
   - Hiển thị Banner cảnh báo màu vàng nếu người dùng chỉ có quyền Xem (`BRANCH_ADMIN`), tự động vô hiệu hóa toàn bộ nút Lưu để ngăn thao tác nhầm.
   - Phản hồi Toast Notification mượt mà khi Lưu thành công hoặc gặp lỗi xác thực.
   - Dialog xác nhận 2 bước khi thực hiện thao tác Khôi phục cài đặt gốc (Reset) tránh mất dữ liệu vô ý.

---

## 6. Kiểm thử Tự động (Automated Testing)

Toàn bộ tính năng được bảo vệ bởi test suite tự động tại `tests/settings.test.ts`:

- **19 Test cases** chuyên sâu:
  - 4 tests kiểm thử Zod validation schemas (hợp lệ, email sai cú pháp, giá trị âm hoặc vượt ngưỡng).
  - 3 tests kiểm thử helper `getOrCreateSystemSettings` (trường hợp đã có data, chưa có company, có company nhưng chưa có settings).
  - 2 tests kiểm thử `GET /api/settings` (xác thực 401, trả về 200).
  - 4 tests kiểm thử `PATCH /api/settings` (401 unauthenticated, 403 forbidden với non-admin, 422 validation error, 200 cập nhật thành công kèm ghi AuditLog).
  - 2 tests kiểm thử `PATCH /api/settings/company` (403 phân quyền, 200 cập nhật hồ sơ doanh nghiệp).
  - 2 tests kiểm thử `POST /api/settings/reset` (403 phân quyền, 200 khôi phục cấu hình mặc định).
  - 2 tests kiểm thử `GET /api/settings/export` (403 với Employee, 200 xuất chẩn đoán cho Admin).

Tất cả **257/257 tests** trên toàn bộ 14 test suites của dự án đều vượt qua 100%.
