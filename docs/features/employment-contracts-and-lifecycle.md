# Quản Lý Hợp Đồng Lao Động & Vòng Đời Nhân Sự (HR Employment Contracts & Lifecycle)

Tài liệu kỹ thuật và hướng dẫn vận hành module Quản lý Hợp đồng Lao động, Tự động hóa Vòng đời Nhân sự (HR Lifecycle Engine) và Hệ thống Cảnh báo Hết hạn Hợp đồng cho Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Quản lý Hợp đồng Lao động & Vòng đời Nhân sự** số hóa toàn diện quy trình quản trị hồ sơ pháp lý lao động từ lúc nhân viên gia nhập (Onboarding), thử việc (Probation), ký hợp đồng chính thức, điều chỉnh lương / thăng chức (Promotion & Salary Review), cho đến khi kết thúc hợp đồng hoặc nghỉ việc (Offboarding):

1. **Hồ Sơ Hợp Đồng Số Hóa (Digital Employment Contracts)**:
   - Quản lý đa dạng các loại hợp đồng theo Bộ luật Lao động Việt Nam:
     - `PROBATION`: Hợp đồng thử việc (thường từ 30 - 60 ngày).
     - `DEFINITE_TERM`: Hợp đồng xác định thời hạn (12 tháng, 24 tháng, 36 tháng).
     - `INDEFINITE_TERM`: Hợp đồng không xác định thời hạn.
     - `SEASONAL`: Hợp đồng thời vụ / theo công việc nhất định.
     - `INTERNSHIP`: Hợp đồng thực tập sinh.
     - `COLLABORATOR`: Hợp đồng cộng tác viên.
   - Quản lý các chế độ đãi ngộ: Lương Gross, Lương đóng BHXH, Số giờ làm việc tiêu chuẩn trên tuần (mặc định 40 giờ).
   - Tự động sinh mã số hợp đồng chuẩn quy ước: `HDLD-YYYYMM-XXXX`, `HDTV-YYYYMM-XXXX`,...

2. **Công Cụ Tính Hạn & Động Hóa Trạng Thái (Dynamic Status & Expiration Engine)**:
   - Thuật toán `computeContractStatus()` tự động chuyển trạng thái hợp đồng sang `EXPIRING_SOON` khi thời hạn còn lại $\le 30$ ngày, và `EXPIRED` khi đã quá hạn so với thời gian hiện tại.
   - Đánh giá mức độ cấp bách (`ExpirationUrgency`): `CRITICAL` ($\le 15$ ngày hoặc quá hạn), `WARNING` ($\le 30$ ngày), `NORMAL` ($> 30$ ngày), và `INDEFINITE` (hợp đồng vô thời hạn).

3. **Cảnh Báo Hết Hạn Tự Động & Đa Kênh (1-Click Expiration Scanner & Webhook Alerts)**:
   - Cung cấp tính năng quét tự động các hợp đồng sắp hết hạn trong 30 ngày.
   - Tự động gửi thông báo nội bộ (In-app Notification) cho nhân viên và các cấp quản lý (HR Manager, Branch Admin, Super Admin).
   - Phát sự kiện Webhook `CONTRACT_EXPIRING` ra các kênh tích hợp bên ngoài (Telegram Bot, Discord Webhook, ERP).

4. **Dòng Thời Gian Vòng Đời Nhân Sự (Employee Career Lifecycle Timeline)**:
   - Tự động ghi nhận lịch sử các mốc sự kiện phát triển nghề nghiệp:
     - `ONBOARDING`: Tiếp nhận nhân viên vào hệ thống.
     - `PROBATION`: Bắt đầu quá trình thử việc.
     - `OFFICIAL`: Ký kết hợp đồng lao động chính thức.
     - `PROMOTION`: Thăng chức hoặc điều chuyển vị trí.
     - `SALARY_REVIEW`: Tăng hoặc điều chỉnh mức lương.
     - `RESIGNATION_NOTICE`: Tiếp nhận thông báo xin nghỉ việc.
     - `OFFBOARDED`: Hoàn tất thanh lý hợp đồng và thôi việc.
   - Lưu trữ metadata chi tiết (mức lương cũ $\rightarrow$ mới, chức vụ cũ $\rightarrow$ mới, mã HĐ liên kết, người phê duyệt).

5. **Phân Quyền Truy Cập Chặt Chẽ (RBAC Matrix)**:
   - `SUPER_ADMIN` & `HR_MANAGER`: Toàn quyền xem, ký mới, gia hạn, chỉnh sửa và thanh lý hợp đồng toàn công ty; xem timeline của mọi nhân viên.
   - `BRANCH_ADMIN`: Quản lý hợp đồng và xem timeline của nhân sự thuộc chi nhánh mình phụ trách.
   - `EMPLOYEE`: Chỉ xem danh sách hợp đồng, chi tiết hợp đồng và timeline phát triển của chính bản thân.

---

## 2. Thiết Kế Cơ Sở Dữ Liệu (Database Schema)

```prisma
enum ContractType {
  LABOR_DEFINITE     // Xác định thời hạn
  LABOR_INDEFINITE   // Không xác định thời hạn
  PROBATION          // Thử việc
  SEASONAL           // Thời vụ
  INTERNSHIP         // Thực tập
  COLLABORATOR       // Cộng tác viên
}

enum ContractStatus {
  DRAFT              // Bản nháp
  ACTIVE             // Đang hiệu lực
  EXPIRING_SOON      // Sắp hết hạn (còn <= 30 ngày)
  EXPIRED            // Đã hết hạn
  TERMINATED         // Đã thanh lý
  RENEWED            // Đã tái ký
}

enum LifecycleStage {
  ONBOARDING         // Tiếp nhận & Hội nhập
  PROBATION          // Thử việc
  OFFICIAL           // Ký chính thức
  PROMOTION          // Thăng chức / Điều chuyển
  SALARY_REVIEW      // Điều chỉnh lương
  RESIGNATION_NOTICE // Báo trước nghỉ việc
  OFFBOARDED         // Đã thôi việc
}

model EmploymentContract {
  id                  String         @id @default(cuid())
  contractNumber      String         @unique
  employeeId          String
  contractType        ContractType   @default(LABOR_DEFINITE)
  status              ContractStatus @default(ACTIVE)
  jobTitle            String
  signDate            DateTime       @default(now())
  startDate           DateTime
  endDate             DateTime?
  insuranceSalary     Float          @default(0)
  grossSalary         Float          @default(0)
  workingHoursPerWeek Float          @default(40)
  signerName          String?
  signerRole          String?
  fileUrl             String?
  notes               String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  employee            Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  lifecycleEvents     LifecycleEvent[]

  @@index([employeeId])
  @@index([status])
  @@index([contractType])
  @@index([endDate])
}

model LifecycleEvent {
  id                  String              @id @default(cuid())
  employeeId          String
  contractId          String?
  stage               LifecycleStage
  title               String
  description         String?
  eventDate           DateTime            @default(now())
  metadata            Json?
  createdById         String?
  createdAt           DateTime            @default(now())

  employee            Employee            @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  contract            EmploymentContract? @relation(fields: [contractId], references: [id], onDelete: SetNull)
  createdByUser       User?               @relation("LifecycleEventCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([employeeId])
  @@index([stage])
  @@index([eventDate])
}
```

---

## 3. Danh Mục API Endpoints

| Phương thức | Endpoint | Mô tả | Quyền hạn |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/contracts` | Lấy danh sách hợp đồng theo bộ lọc (loại HĐ, trạng thái, chi nhánh, tìm kiếm) | All (Scoped) |
| `POST` | `/api/contracts` | Tạo hợp đồng mới & tự động ghi nhận LifecycleEvent | Admin, HR |
| `GET` | `/api/contracts/[id]` | Lấy chi tiết hợp đồng kèm trạng thái động và số ngày còn lại | All (Scoped) |
| `PATCH` | `/api/contracts/[id]` | Chỉnh sửa hợp đồng, ghi nhận thăng chức/tăng lương | Admin, HR |
| `DELETE` | `/api/contracts/[id]` | Xóa hợp đồng khỏi hệ thống | Super Admin |
| `GET` | `/api/contracts/metrics` | Thống kê số lượng tổng, hiệu lực, thử việc, sắp hết hạn | All (Scoped) |
| `GET` | `/api/employees/[id]/timeline` | Lấy danh sách các mốc sự kiện vòng đời nhân sự theo thứ tự thời gian | All (Scoped) |
| `POST` | `/api/contracts/check-expiring` | Quét hợp đồng sắp hết hạn trong 30 ngày, gửi In-App Alert & Webhook | Admin, HR |

---

## 4. Tự Động Hóa Vòng Đời Nhân Sự (Lifecycle Flow)

```
[Tiếp nhận nhân sự (ONBOARDING)]
         │
         ▼
[Ký HĐ Thử việc (PROBATION)]
         │
         ▼ (Đạt thử việc)
[Ký HĐ Chính thức (OFFICIAL)]
         │
         ├───► [Điều chỉnh Lương / Thăng chức (PROMOTION & SALARY_REVIEW)]
         ├───► [Gia hạn HĐLĐ / Tái ký (RENEWED)]
         │
         ▼ (Kết thúc công tác)
[Báo trước nghỉ việc (RESIGNATION_NOTICE)] ──► [Thanh lý HĐ & Thôi việc (OFFBOARDED)]
```

---

## 5. Tích Hợp Webhook Sự Kiện (Webhook Integration)

Khi chạy quét hợp đồng hoặc có sự kiện hợp đồng lao động sắp hết hạn, hệ thống kích hoạt sự kiện Webhook:
- **Event Name**: `CONTRACT_EXPIRING`
- **Category**: `Hợp đồng`
- **Payload Envelope Mẫu**:
```json
{
  "event": "CONTRACT_EXPIRING",
  "timestamp": "2026-11-17T01:45:00.000Z",
  "data": {
    "contractId": "clxx123456789",
    "contractNumber": "HDLD-202611-1234",
    "employeeId": "emp-001",
    "employeeName": "Nguyễn Văn A",
    "employeeCode": "NV001",
    "branchName": "Chi nhánh Hà Nội",
    "daysRemaining": 12,
    "endDate": "2026-11-29T00:00:00.000Z",
    "urgency": "CRITICAL"
  }
}
```

---

## 6. Kiểm Thử Tự Động (Automated Testing)

Module đi kèm bộ kiểm thử tự động toàn diện tại `tests/contracts.test.ts` (17 test cases):
- **Kiểm thử logic lõi**: Thuật toán tính ngày hết hạn (`calculateDaysRemaining`), xác định trạng thái thực tế (`computeContractStatus`), phân cấp nguy cơ (`getExpirationUrgency`), ghi nhận sự kiện vòng đời (`recordLifecycleEvent`).
- **Kiểm thử Zod Validation**: Xác thực tính hợp lệ của mã hợp đồng, ngày bắt đầu/kết thúc, mức lương.
- **Kiểm thử phân quyền RBAC**: Ngăn chặn Employee tạo/sửa hợp đồng; Branch Admin chỉ truy cập hợp đồng thuộc chi nhánh; Super Admin và HR Manager quản lý toàn diện.
- **Kiểm thử Webhook & Thông báo**: Kiểm tra quá trình quét và phát cảnh báo tự động.
- Chạy kiểm thử:
```bash
pnpm vitest run tests/contracts.test.ts
```
