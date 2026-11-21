# Lịch Nghỉ Lễ & Ngày Làm Bù Toàn Công Ty (Company Holiday Calendar & Special Shift Multipliers)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Quản lý Lịch Nghỉ Lễ Quốc Gia, Ngày Nghỉ Riêng Doanh Nghiệp, Ngày Làm Bù và Hệ thống Tự Động Tính Hệ Số Lương (x300% cho ngày lễ) trong Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Lịch Nghỉ Lễ & Ngày Làm Bù Toàn Công Ty** chuẩn hóa toàn bộ quy định về ngày nghỉ theo Bộ luật Lao động Việt Nam và chính sách riêng của doanh nghiệp:

1. **Phân loại Ngày nghỉ & Ngày làm việc đặc biệt (`HolidayType`)**:
   - `NATIONAL` (Nghỉ lễ Quốc gia): Nghỉ theo Luật Lao động, hưởng nguyên 100% lương (`isPaid: true`), nếu đi làm tính hệ số lương làm thêm giờ lễ tết `payMultiplier: 3.0` (300%).
   - `COMPANY` (Nghỉ riêng Công ty): Nghỉ ngày thành lập công ty, Year-End Party, Teambuilding/Du lịch hè,... Hệ số lương mặc định `2.0` (200%).
   - `COMPENSATORY_WORK` (Ngày làm việc bù): Làm việc vào ngày cuối tuần (Thứ 7/Chủ nhật) để bù cho ngày lễ được hoán đổi. Hệ số lương `1.0` (100%), tính vào ngày công chuẩn thực tế.
   - `SPECIAL_OFF` (Nghỉ sự cố đặc biệt): Nghỉ do thời tiết cực đoan, dịch bệnh hoặc các lý do bất khả kháng có quyết định phê duyệt từ Ban Giám đốc.

2. **Khởi tạo 1-Click Lịch Lễ Quốc Gia (1-Click National Holidays Seeding)**:
   - Tự động nạp sẵn toàn bộ danh mục các ngày nghỉ lễ chính thức của Việt Nam theo từng năm (`getVietnameseNationalHolidays`):
     - Tết Dương lịch (01/01)
     - Tết Nguyên Đán (kỳ nghỉ 5-7 ngày theo âm lịch quy đổi)
     - Giỗ Tổ Hùng Vương (10/03 Âm lịch quy đổi Dương lịch)
     - Ngày Giải phóng miền Nam (30/04) & Quốc tế Lao động (01/05)
     - Quốc khánh nước CHXHCN Việt Nam (02/09 & 03/09)

3. **Công cụ Tính Toán Ngày Công Chuẩn & Hệ Số Lương (Payroll & Attendance Engine Integration)**:
   - `calculateDatePayMultiplier(date, holidays, branchId)`: Đánh giá tức thời hệ số tính lương khi chấm công:
     - Ngày lễ: 300%
     - Chủ nhật: 200%
     - Thứ 7: 150%
     - Ngày làm bù: 100%
     - Ngày thường: 100%
   - `calculateActualWorkingDaysInMonth(year, month, holidays, branchId)`: Tính số ngày công chuẩn hành chính và số ngày công thực tế sau khi khấu trừ ngày lễ có lương và cộng thêm ngày làm bù.

4. **Phát Thông Báo Đa Kênh Tự Động (Multi-Channel Holiday Broadcast)**:
   - Gửi In-app Notification cho toàn thể nhân sự thuộc chi nhánh hoặc toàn công ty.
   - Kích hoạt sự kiện Webhook `HOLIDAY_UPCOMING_REMINDER` đến Telegram Bot, Discord Webhook, Zalo OA.

5. **Giao Diện Bản Đồ Lịch Biểu Trực Quan (Interactive Calendar & Table View)**:
   - Chuyển đổi linh hoạt giữa giao diện Lịch tháng (Calendar View) và Danh sách (Table View).
   - Mã màu trực quan: Đỏ (Lễ quốc gia), Tím (Nghỉ công ty), Vàng (Làm bù), Xám (Cuối tuần).
   - Thanh công cụ điều hướng tháng, nhảy nhanh về ngày hôm nay, bộ lọc theo năm và chi nhánh.

---

## 2. Thiết Kế Cơ Sở Dữ Liệu (Database Schema)

```prisma
enum HolidayType {
  NATIONAL          // Ngày lễ Quốc gia (hưởng nguyên lương, đi làm x3.0)
  COMPANY           // Ngày nghỉ riêng của công ty
  COMPENSATORY_WORK // Ngày làm việc bù
  SPECIAL_OFF       // Ngày nghỉ đặc biệt / sự cố bất khả kháng
}

model CompanyHoliday {
  id            String      @id @default(cuid())
  name          String
  code          String
  date          DateTime
  endDate       DateTime?
  type          HolidayType @default(NATIONAL)
  isPaid        Boolean     @default(true)
  payMultiplier Float       @default(3.0)
  year          Int
  branchId      String?
  description   String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  branch        Branch?     @relation(fields: [branchId], references: [id], onDelete: SetNull)

  @@index([date])
  @@index([year])
  @@index([type])
  @@index([branchId])
}
```

---

## 3. Danh Mục API Endpoints

| Phương thức | Endpoint | Mô tả | Quyền hạn |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/holidays` | Lấy danh sách ngày nghỉ theo năm, chi nhánh, loại ngày nghỉ | Tất cả (Scoped) |
| `POST` | `/api/holidays` | Tạo mới ngày nghỉ / ngày làm bù | Admin, HR |
| `GET` | `/api/holidays/[id]` | Xem chi tiết ngày nghỉ | Tất cả (Scoped) |
| `PATCH` | `/api/holidays/[id]` | Chỉnh sửa ngày nghỉ / hệ số lương | Admin, HR |
| `DELETE` | `/api/holidays/[id]` | Xóa ngày nghỉ | Admin, HR |
| `POST` | `/api/holidays/init-defaults` | Nạp tự động các ngày lễ Quốc gia của Việt Nam theo năm | Super Admin, HR |
| `GET` | `/api/holidays/check` | Kiểm tra ngày cụ thể có phải là ngày lễ / làm bù và lấy hệ số lương | Tất cả |
| `GET` | `/api/holidays/summary` | Thống kê số lượng ngày nghỉ và tính ngày công chuẩn của tháng | Tất cả (Scoped) |
| `POST` | `/api/holidays/broadcast` | Phát thông báo kỳ nghỉ lễ qua In-App & Webhook đa kênh | Admin, HR |

---

## 4. Tích Hợp Webhook & Thông Báo

Khi thông báo kỳ nghỉ lễ được phát qua endpoint `/api/holidays/broadcast`:
- **Webhook Event Name**: `HOLIDAY_UPCOMING_REMINDER`
- **Category**: `Lịch nghỉ lễ`
- **Mẫu Payload**:
```json
{
  "event": "HOLIDAY_UPCOMING_REMINDER",
  "timestamp": "2026-11-21T13:45:00.000Z",
  "data": {
    "holidayId": "clxx123456789",
    "name": "Nghỉ Tết Dương Lịch 2026",
    "code": "NEW_YEAR_2026",
    "type": "NATIONAL",
    "date": "2026-01-01T00:00:00.000Z",
    "endDate": null,
    "isPaid": true,
    "payMultiplier": 3.0,
    "branchName": "Toàn công ty",
    "message": "Công ty xin thông báo lịch Nghỉ Tết Dương Lịch vào ngày 01/01/2026. Hệ số lương đi làm ngày này: 300%."
  }
}
```

---

## 5. Kiểm Thử Tự Động (Automated Testing)

Module đi kèm bộ kiểm thử tự động toàn diện tại `tests/holidays.test.ts` (18 test cases):
- **Kiểm thử logic ngày lễ Quốc gia**: Kiểm tra danh mục các đợt nghỉ lễ chính thức của Việt Nam theo năm.
- **Kiểm thử hệ số lương**: Đánh giá chuẩn xác hệ số 3.0 (ngày lễ), 2.0 (Chủ nhật), 1.5 (Thứ 7), 1.0 (Làm bù / Ngày thường).
- **Kiểm thử tính ngày công tháng**: Đo lường ngày công chuẩn hành chính và ngày công thực tế sau khi hoán đổi ngày nghỉ.
- **Kiểm thử phân quyền RBAC & CRUD**: Ngăn chặn Employee tự tạo ngày nghỉ; xác thực Branch Admin chỉ quản lý chi nhánh mình.
- **Kiểm thử Webhook & Thông báo**: Xác nhận tiến trình gửi In-App Notification và phát sự kiện Webhook.
