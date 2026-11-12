# Quản lý Ca làm việc & Đổi ca linh hoạt (Work Shifts & Shift Swap Requests)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Quản lý Ca làm việc, Phân ca lịch biểu và Quy trình Đổi ca linh hoạt trong Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Quản lý Ca làm việc & Đổi ca linh hoạt** cung cấp giải pháp toàn diện cho việc điều phối nhân sự, bao gồm:
1. **Thiết lập danh mục Ca làm việc linh hoạt (Work Schedule Templates)**:
   - Ca hành chính (08:00 - 17:00, trừ nghỉ trưa 12:00 - 13:00).
   - Ca sáng (06:00 - 14:00), Ca chiều (14:00 - 22:00).
   - Ca đêm xuyên ngày (22:00 - 06:00 hôm sau, tự động tính 8 giờ công).
   - Cấu hình ngưỡng cho phép đi muộn / về sớm (Late/Early Thresholds).
   - Đặt ca làm việc mặc định cho từng chi nhánh.
2. **Phân ca lịch biểu nhân sự (Roster Scheduling)**:
   - Phân ca linh hoạt cho một hoặc nhiều nhân viên cùng lúc.
   - Hỗ trợ chọn dải ngày liên tục (From Date &rarr; To Date) với tùy chọn tự động bỏ qua ngày cuối tuần (Thứ 7 & Chủ Nhật).
   - Tự động áp dụng ca mặc định nếu nhân viên chưa được xếp ca riêng.
3. **Quy trình Đổi ca linh hoạt 2 lớp (Two-tier Shift Swap Approval Workflow)**:
   - **Bước 1 (Nhân viên &rarr; Đồng nghiệp)**: Nhân viên A nộp đơn đổi ca chỉ định đồng nghiệp B và 2 khung giờ/ngày muốn hoán đổi.
   - **Bước 2 (Xác nhận từ đồng nghiệp)**: Đồng nghiệp B nhận thông báo và có quyền Đồng ý hoặc Từ chối kèm lý do.
   - **Bước 3 (Xét duyệt từ Quản lý)**: Khi đồng nghiệp B chấp thuận, đơn tự động chuyển lên Quản lý chi nhánh (`BRANCH_ADMIN`) hoặc Super Admin.
   - **Bước 4 (Tự động cập nhật lịch làm việc)**: Khi Quản lý phê duyệt, hệ thống tự động hoán đổi phân ca (`ShiftAssignment`) của cả 2 nhân viên trong 1 transaction an toàn, ghi Audit Log và gửi thông báo kết quả cho cả 2 bên.

---

## 2. Kiến trúc & Mô hình Dữ liệu (Prisma Schema)

### 2.1 Model `WorkSchedule` (Ca làm việc)
- `id`: Định danh duy nhất (CUID).
- `branchId`: Liên kết tới `Branch`.
- `name`: Tên ca (VD: "Ca Hành Chính", "Ca Đêm 1").
- `startTime`, `endTime`: Khung giờ (định dạng `HH:mm`).
- `lunchStart`, `lunchEnd`: Giờ nghỉ trưa (tự động khấu trừ vào giờ làm).
- `workDays`: Danh sách các ngày làm việc trong tuần (`1`: Thứ 2 &rarr; `7`: Chủ Nhật).
- `lateThreshold`, `earlyThreshold`: Ngưỡng đi muộn/về sớm tính bằng phút.
- `isDefault`: Cờ đánh dấu ca mặc định của chi nhánh.

### 2.2 Model `ShiftAssignment` (Phân ca nhân viên)
- `id`: Định danh phân ca.
- `employeeId`: Nhân viên được phân ca.
- `scheduleId`: Ca làm việc áp dụng.
- `date`: Ngày làm việc (`@db.Date`).
- `unique([employeeId, date])`: Đảm bảo 1 nhân viên chỉ có 1 ca làm việc chính thức trong 1 ngày.

### 2.3 Model `ShiftSwapRequest` (Yêu cầu đổi ca)
- `requesterId`: Nhân viên khởi tạo yêu cầu.
- `targetEmployeeId`: Đồng nghiệp được đề nghị đổi ca.
- `requesterDate`, `requesterScheduleId`: Ca của người yêu cầu nhường lại.
- `targetDate`, `targetScheduleId`: Ca của đồng nghiệp muốn nhận về.
- `peerStatus`: `PENDING` | `ACCEPTED` | `REJECTED`.
- `status`: `PENDING_PEER` | `PENDING_MANAGER` | `APPROVED` | `REJECTED` | `CANCELLED`.
- `approvedById`, `approvedAt`, `rejectReason`.

---

## 3. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/schedules` | `AUTHENTICATED` | Lấy danh sách ca làm việc theo chi nhánh |
| `POST` | `/api/schedules` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Tạo ca làm việc mới |
| `GET` | `/api/schedules/[id]` | `AUTHENTICATED` | Chi tiết ca làm việc |
| `PATCH` | `/api/schedules/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Chỉnh sửa ca làm việc |
| `DELETE` | `/api/schedules/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Xóa an toàn ca làm việc (chặn khi có phân ca) |
| `GET` | `/api/schedules/assignments` | `AUTHENTICATED` | Lấy lịch phân ca theo tháng / nhân viên |
| `POST` | `/api/schedules/assignments` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Phân ca hàng loạt theo khoảng ngày |
| `DELETE` | `/api/schedules/assignments/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Hủy phân ca làm việc cụ thể |
| `GET` | `/api/schedules/swaps` | `AUTHENTICATED` | Danh sách đơn đổi ca (sent, received, manage) |
| `POST` | `/api/schedules/swaps` | `EMPLOYEE` | Tạo yêu cầu đổi ca với đồng nghiệp |
| `PATCH` | `/api/schedules/swaps/[id]/peer-response` | `EMPLOYEE (Target)` | Đồng nghiệp chấp thuận hoặc từ chối đổi ca |
| `PATCH` | `/api/schedules/swaps/[id]/approve` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Quản lý duyệt/từ chối đổi ca (tự động hoán đổi) |
| `DELETE` | `/api/schedules/swaps/[id]` | `EMPLOYEE (Requester)` | Hủy đơn đổi ca đang chờ xử lý |

---

## 4. Kiểm thử Tự động (Automated Testing)

Toàn bộ hệ thống quản lý ca và đổi ca được kiểm thử tự động với **20 kịch bản kiểm thử** trong [`tests/shift-management.test.ts`](../../tests/shift-management.test.ts):
- Kiểm thử thuật toán tính giờ làm việc có khấu trừ giờ nghỉ trưa.
- Kiểm thử ca đêm qua 24:00 (Overnight Shifts).
- Kiểm thử quy tắc nghiệp vụ: Chặn tự đổi ca cho chính mình, chặn đổi ca trong quá khứ.
- Kiểm thử Zod schema: Chặn khung giờ sai định dạng, chặn lý do đổi ca quá ngắn.
- Kiểm thử tạo ca làm việc và tự động chuyển đổi ca mặc định (`isDefault`).
- Kiểm thử phân ca hàng loạt trong transaction.
- Kiểm thử quy trình đổi ca 2 lớp (Đồng nghiệp phản hồi &rarr; Quản lý xét duyệt &rarr; Hoán đổi phân ca tự động &rarr; Ghi AuditLog).
- Kiểm thử chặn xóa ca đang có liên kết phân ca.
- Kiểm thử chặn hủy đơn đổi ca khi đã được phê duyệt.
