# Tích Hợp Webhook & Thông Báo Đa Kênh (Multi-Channel Webhooks & Bot Integration)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Tích hợp Webhook, Phát thông báo tự động về Telegram Bot, Discord Webhook, Zalo ZNS và Custom Webhook Server cho Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Tích Hợp Webhook & Thông Báo Đa Kênh** mở rộng năng lực thông báo thời gian thực của hệ thống, giúp Ban quản trị, Quản lý chi nhánh và Nhân sự nhận được cảnh báo tức thời qua các nền tảng chat phổ biến:

1. **Hỗ trợ Đa Kênh Tích Hợp (Multi-Channel Support)**:
   - **Telegram Bot**: Định dạng tin nhắn HTML sinh động, emoji trực quan, gửi trực tiếp vào nhóm quản lý hoặc kênh thông báo nội bộ.
   - **Discord Webhook**: Định dạng Rich Embeds với mã màu phân cấp (Xanh lá cho check-in, xanh dương cho check-out, vàng khi đi muộn, đỏ khi có cảnh báo an ninh).
   - **Zalo ZNS**: Tích hợp với dịch vụ thông báo Zalo Official Account.
   - **Custom Webhook (Generic JSON)**: Gửi HTTP POST JSON envelope chuẩn kèm chữ ký bảo mật **HMAC-SHA256** qua header `X-Signature-SHA256` để tích hợp với hệ thống ERP, CRM hoặc Microservices nội bộ.
2. **Bộ Sự Kiện Đăng Ký Linh Hoạt (Granular Event Subscriptions)**:
   - `ATTENDANCE_CHECK_IN`: Nhân viên hoàn tất chấm công vào ca.
   - `ATTENDANCE_CHECK_OUT`: Nhân viên hoàn tất chấm công ra ca.
   - `ATTENDANCE_LATE_ALERT`: Phát cảnh báo khi nhân viên đi muộn vượt ngưỡng.
   - `LEAVE_REQUESTED`: Có đơn xin nghỉ phép mới cần phê duyệt.
   - `LEAVE_STATUS_CHANGED`: Cập nhật trạng thái đơn nghỉ phép (được duyệt hoặc từ chối).
   - `SHIFT_SWAP_REQUESTED`: Có yêu cầu đổi ca làm việc giữa các nhân viên.
   - `SECURITY_CRITICAL_ALERT`: Cảnh báo các sự kiện bảo mật nghiêm trọng hoặc khôi phục cài đặt gốc từ Nhật ký kiểm toán.
3. **Phân Vùng Chi Nhánh Thông Minh (Branch Scoping)**:
   - Cho phép cấu hình Webhook áp dụng cho Toàn công ty hoặc chỉ áp dụng riêng cho một Chi nhánh cụ thể.
4. **Bộ Giả Lập & Kiểm Tra Kết Nối Trực Tiếp (Test Webhook Simulator)**:
   - Cung cấp nút "Gửi Thử Nghiệm" trên giao diện để gửi gói tin mẫu và phản hồi trực tiếp mã HTTP status, thời gian phản hồi (ms) và nội dung phản hồi từ máy chủ đích.
5. **Nhật Ký Phát Webhook (Delivery Logs)**:
   - Lưu trữ lịch sử 50 lượt phát gần nhất, đo độ trễ (latency), phát hiện lỗi kết nối (Timeout, 404, 500) và xem lại payload đã gửi.

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

```prisma
enum WebhookChannel {
  TELEGRAM
  DISCORD
  GENERIC_WEBHOOK
  ZALO_ZNS
}

model WebhookSubscription {
  id          String         @id @default(cuid())
  name        String
  channel     WebhookChannel @default(GENERIC_WEBHOOK)
  url         String
  secret      String?
  events      String[]
  isActive    Boolean        @default(true)
  branchId    String?
  metadata    Json?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  branch      Branch?        @relation(fields: [branchId], references: [id], onDelete: SetNull)
  deliveries  WebhookDeliveryLog[]

  @@index([channel])
  @@index([isActive])
  @@index([branchId])
}

model WebhookDeliveryLog {
  id             String              @id @default(cuid())
  subscriptionId String
  event          String
  payload        Json
  responseStatus Int?
  responseBody   String?
  durationMs     Int                 @default(0)
  isSuccess      Boolean             @default(false)
  errorMessage   String?
  createdAt      DateTime            @default(now())

  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@index([event])
  @@index([isSuccess])
  @@index([createdAt])
}
```

---

## 3. Kiến trúc Bảo Mật & Ký HMAC-SHA256

Đối với kênh `GENERIC_WEBHOOK` và `ZALO_ZNS`, khi cấu hình có `secret`, hệ thống sẽ tự động tính toán chữ ký số và đính kèm vào HTTP Request Headers:

- `X-Signature-SHA256`: Chữ ký số băm HMAC-SHA256 của toàn bộ chuỗi JSON payload với `secret`.
- `X-Event`: Mã định danh sự kiện (ví dụ: `ATTENDANCE_CHECK_IN`).
- `User-Agent`: `SmartAttendance-Webhook-Dispatcher/2.5`.

Mã xác thực chữ ký mẫu cho máy chủ nhận webhook (Node.js):
```javascript
const crypto = require('crypto');

function verifyWebhook(payloadRaw, signatureHeader, secret) {
  const calculated = crypto
    .createHmac('sha256', secret)
    .update(payloadRaw)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(calculated));
}
```

---

## 4. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền (RBAC) | Mô tả |
|---|---|---|---|
| `GET` | `/api/webhooks` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Lấy danh sách Webhook Subscriptions kèm tỷ lệ thành công |
| `POST` | `/api/webhooks` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Tạo mới một cấu hình Webhook |
| `GET` | `/api/webhooks/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Lấy chi tiết thông tin Webhook |
| `PATCH` | `/api/webhooks/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Cập nhật cấu hình, sự kiện hoặc bật/tắt Webhook |
| `DELETE` | `/api/webhooks/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Xóa cấu hình Webhook và toàn bộ lịch sử phát liên quan |
| `POST` | `/api/webhooks/[id]/test` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Gửi gói tin thử nghiệm (Test Ping) tức thì |
| `GET` | `/api/webhooks/[id]/deliveries` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Lấy 50 bản ghi nhật ký phát webhook gần nhất |

---

## 5. Hướng dẫn Cấu hình Các Kênh

### 5.1 Cấu hình Telegram Bot
1. Mở ứng dụng Telegram, tìm kiếm bot `@BotFather` và gửi lệnh `/newbot` để tạo bot mới.
2. Sao chép chuỗi **HTTP API Token** (ví dụ: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
3. Nhập URL vào hệ thống: `https://api.telegram.org/bot<TOKEN>`.
4. Thêm Bot vào nhóm Telegram cần nhận thông báo.
5. Lấy **Chat ID** của nhóm bằng cách thêm bot `@RawDataBot` vào nhóm hoặc gọi API `https://api.telegram.org/bot<TOKEN>/getUpdates`.
6. Điền Chat ID (thường có tiền tố dấu `-` đối với nhóm, ví dụ: `-1001234567890`) vào ô Chat ID.

### 5.2 Cấu hình Discord Webhook
1. Mở Discord > Chọn Kênh chat cần nhận thông báo > Nhấp vào biểu tượng Bánh răng (Chỉnh sửa kênh).
2. Chọn mục **Tích hợp (Integrations)** > Nhấp **Tạo Webhook (Webhooks)**.
3. Sao chép **URL Webhook** (dạng `https://discord.com/api/webhooks/...`).
4. Dán URL vào hệ thống và chọn kênh Discord Webhook.

---

## 6. Kiểm thử Tự động (Automated Testing)

File test suite tại `tests/webhooks.test.ts` bao gồm **15 test cases** phủ kín:
- Ký HMAC-SHA256 bảo mật.
- Format định dạng tin nhắn HTML cho Telegram và Rich Embed cho Discord.
- Cơ chế `deliverWebhook` và `dispatchWebhookEvent`.
- API CRUD Webhooks (`GET`, `POST`, `PATCH`, `DELETE`).
- API Test Ping và API Lịch sử phát `deliveries`.

Toàn bộ **307 / 307 tests** trên toàn bộ 17 test suites của dự án đều vượt qua 100%.
