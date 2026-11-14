# Trung Tâm Nhật Ký Kiểm Toán & Giám Sát Bảo Mật (Audit Log Viewer & Security Monitoring)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Quản lý Nhật ký Kiểm toán, Lưu vết Thao tác Người dùng, So sánh Thay đổi Dữ liệu (State Diff Viewer), Phân tích Chỉ số An ninh và Xuất Báo cáo Tuân thủ (Compliance Export) cho Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Trung Tâm Nhật Ký Kiểm Toán & Giám Sát Bảo Mật** đóng vai trò là "hộp đen" toàn diện của doanh nghiệp, đảm bảo tính minh bạch, trách nhiệm giải trình (Accountability) và an toàn thông tin:

1. **Lưu vết Tự động & Bất biến (Immutable Audit Trail)**:
   - Tự động ghi lại mọi thao tác quan trọng: Cập nhật cài đặt hệ thống, xóa/thêm chi nhánh, sửa công, đổi ca, duyệt đơn phép/OT, điều chỉnh giờ công, thao tác nhân sự và cảnh báo đăng nhập thất bại.
   - Lưu trữ địa chỉ IP thực tế của Client (`extractClientIp`) và chuỗi nhận dạng thiết bị (`extractUserAgent`).
2. **Phân cấp Mức độ Nghiêm trọng (Severity Levels)**:
   - **`CRITICAL`**: Hành vi có tính chất phá hủy hoặc ảnh hưởng nghiêm trọng đến vận hành (Khôi phục cài đặt gốc, Xóa chi nhánh, Vô hiệu hóa tài khoản nhân sự, Đăng nhập thất bại liên tiếp).
   - **`SECURITY`**: Các sự kiện xác thực, đổi mật khẩu, phân quyền quản trị.
   - **`WARNING`**: Các thay đổi cấu hình, từ chối duyệt đơn, sửa đổi giờ công trực tiếp.
   - **`INFO`**: Thao tác tác nghiệp thường nhật (Chấm công thành công, nộp đơn, duyệt ca).
3. **Phân tích Số liệu Giám sát An ninh (Security Analytics & Metrics)**:
   - 4 thẻ KPI chỉ số tức thời: Tổng sự kiện, Thao tác trong 24 giờ qua, Số lượng sự kiện nghiêm trọng (Critical), Cảnh báo giám sát (Warning).
   - Biểu đồ xu hướng 7 ngày (Timeline Trend) phản ánh mật độ hoạt động và tỷ lệ rủi ro bảo mật theo ngày.
   - Bảng xếp hạng Top 5 người dùng thực hiện nhiều thao tác nhạy cảm nhất.
4. **Bộ So sánh Trạng thái Thay đổi (JSON Diff Viewer)**:
   - Cửa sổ Modal hiển thị trực quan so sánh 2 cột song song giữa trạng thái trước (`oldData`) và sau (`newData`).
   - Phân biệt rõ các thao tác Tạo mới, Cập nhật từng trường, hoặc Xóa dữ liệu.
5. **Xuất Báo cáo Tuân thủ Đa định dạng (Compliance Export)**:
   - Hỗ trợ xuất tệp **CSV** có gắn UTF-8 Byte Order Mark (`\uFEFF`) để mở trực tiếp trên Microsoft Excel và Google Sheets mà không bị lỗi font tiếng Việt.
   - Hỗ trợ xuất tệp **JSON** chuẩn hóa để tích hợp với các hệ thống SIEM (Security Information and Event Management) hoặc sao lưu ngoại vi (Cold Storage).
6. **Kiểm soát Truy cập Dựa trên Vai trò (RBAC)**:
   - `SUPER_ADMIN`: Toàn quyền tra cứu và phân tích logs trên toàn bộ hệ thống.
   - `BRANCH_ADMIN`: Giới hạn tra cứu và xuất logs trong phạm vi chi nhánh trực thuộc, ngăn ngừa rò rỉ dữ liệu chéo giữa các chi nhánh.
   - `EMPLOYEE` & `HR_MANAGER`: Bị chặn truy cập (HTTP 403 Forbidden).

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

Hệ thống nâng cấp mô hình `AuditLog` và liên kết với `User` trong Prisma:

```prisma
enum AuditSeverity {
  INFO
  WARNING
  CRITICAL
  SECURITY
}

enum AuditStatus {
  SUCCESS
  FAILURE
  DENIED
}

model AuditLog {
  id        String        @id @default(cuid())
  userId    String
  action    String
  entity    String
  entityId  String
  oldData   Json?
  newData   Json?
  ipAddress String?
  userAgent String?
  severity  AuditSeverity @default(INFO)
  status    AuditStatus   @default(SUCCESS)
  metadata  Json?
  createdAt DateTime      @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([entity, entityId])
  @@index([userId])
  @@index([action])
  @@index([severity])
  @@index([createdAt])
}
```

---

## 3. Danh mục Hành động & Phân loại Mức độ

| Mã hành động (`action`) | Danh mục | Mức độ (`severity`) | Mô tả |
|---|:---:|:---:|---|
| `SYSTEM_SETTINGS_RESET` | Cài đặt | **CRITICAL** | Khôi phục toàn bộ cài đặt hệ thống về mặc định |
| `SYSTEM_SETTINGS_UPDATED` | Cài đặt | **WARNING** | Chỉnh sửa quy tắc chấm công, chu kỳ lương, phép |
| `BRANCH_DELETED` | Chi nhánh | **CRITICAL** | Xóa một chi nhánh khỏi cơ sở dữ liệu |
| `BRANCH_CREATED` / `BRANCH_UPDATED` | Chi nhánh | **INFO / WARNING** | Thêm mới hoặc sửa đổi tọa độ GPS, Geofence chi nhánh |
| `EMPLOYEE_DEACTIVATED` | Nhân sự | **CRITICAL** | Vô hiệu hóa tài khoản và quyền truy cập của nhân viên |
| `ATTENDANCE_ADJUSTMENT_APPROVED` | Chấm công | **INFO** | Phê duyệt đơn xin giải trình / sửa giờ chấm công |
| `ATTENDANCE_ADJUSTMENT_REJECTED` | Chấm công | **WARNING** | Từ chối đơn xin sửa giờ chấm công của nhân viên |
| `SECURITY_LOGIN_FAILED` | Bảo mật | **CRITICAL** | Cảnh báo đăng nhập thất bại / sai mật khẩu |
| `GAMIFICATION_RECALCULATED` | Cài đặt | **INFO** | Kích hoạt quét tính điểm chuyên cần toàn hệ thống |

---

## 4. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền (RBAC) | Mô tả |
|---|---|---|---|
| `GET` | `/api/audit-logs` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Lấy danh sách nhật ký kiểm toán, hỗ trợ phân trang và đa bộ lọc |
| `GET` | `/api/audit-logs/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Lấy chi tiết một sự kiện kiểm toán kèm `oldData`, `newData` và `metadata` |
| `GET` | `/api/audit-logs/metrics` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Thống kê chỉ số KPI bảo mật, xu hướng 7 ngày và Top người dùng hoạt động |
| `GET` | `/api/audit-logs/export` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Xuất file dữ liệu kiểm toán định dạng CSV (UTF-8 BOM) hoặc JSON |

---

## 5. Giao diện Người dùng (UI Components)

- **Thẻ Chỉ số An ninh ([AuditMetricsCards.tsx](file:///d:/github/smart-attendance-system/src/components/audit/AuditMetricsCards.tsx))**:
  - 4 khối thẻ KPI phản hồi nhanh, trực quan hóa mức độ rủi ro với màu sắc phân biệt.
- **Biểu đồ Hoạt động & Top Người dùng ([SecurityTrendChart.tsx](file:///d:/github/smart-attendance-system/src/components/audit/SecurityTrendChart.tsx))**:
  - Biểu đồ thanh HTML/CSS responsive thể hiện tổng thao tác và tỷ lệ cảnh báo nguy cơ trong 7 ngày gần nhất.
- **Thanh Công cụ Bộ lọc ([AuditFilterBar.tsx](file:///d:/github/smart-attendance-system/src/components/audit/AuditFilterBar.tsx))**:
  - Tìm kiếm toàn văn, lọc theo Severity, Thực thể, Ngày bắt đầu/kết thúc, và 2 nút Xuất CSV / JSON một chạm.
- **Bảng Nhật ký Kiểm toán ([AuditLogTable.tsx](file:///d:/github/smart-attendance-system/src/components/audit/AuditLogTable.tsx))**:
  - Hiển thị danh sách sự kiện kèm thời gian, địa chỉ IP, User Agent, huy hiệu mức độ và nút xem chi tiết.
- **Hộp thoại So sánh Diff ([AuditDetailModal.tsx](file:///d:/github/smart-attendance-system/src/components/audit/AuditDetailModal.tsx))**:
  - Cửa sổ Modal hiển thị so sánh dữ liệu trước (`oldData`) và sau (`newData`) với highlight màu trực quan.
- **Trang Điều Khiển Trung Tâm ([page.tsx](file:///d:/github/smart-attendance-system/src/app/(dashboard)/audit-logs/page.tsx))**:
  - Tích hợp toàn diện các thành phần tại route `/audit-logs`.
- **Điều hướng Sidebar ([DashboardSidebar.tsx](file:///d:/github/smart-attendance-system/src/components/layout/DashboardSidebar.tsx))**:
  - Thêm mục menu "Nhật ký kiểm toán" với icon `ShieldAlert` cho Admin.

---

## 6. Kiểm thử Tự động (Automated Testing)

File test suite tại `tests/audit-logs.test.ts` bao gồm **16 test cases** chuyên sâu:
- 4 tests kiểm thử giải thuật suy luận mức độ nghiêm trọng `inferAuditSeverity`.
- 3 tests kiểm thử hàm ghi log an toàn `logAuditEvent`, trích xuất `extractClientIp` và xử lý ngoại lệ database.
- 4 tests kiểm thử API danh sách `GET /api/audit-logs` (401, 403, 200 pagination, RBAC branch scoping).
- 2 tests kiểm thử API chi tiết `GET /api/audit-logs/[id]` (404 not found, 200 state diff payload).
- 1 test kiểm thử API chỉ số `GET /api/audit-logs/metrics` (tính toán summary, topActors, timeline trend).
- 2 tests kiểm thử API xuất dữ liệu `GET /api/audit-logs/export` (định dạng CSV UTF-8 BOM, định dạng JSON).

Kết quả: **292 / 292 tests** trên toàn bộ 16 test suites của dự án đều vượt qua 100%.
