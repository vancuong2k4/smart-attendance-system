# 📝 Đơn Quên Chấm Công / Giải Trình Bù Công (Attendance Adjustment)

Tài liệu thiết kế kiến trúc và hướng dẫn sử dụng tính năng **Đơn giải trình bù công (Attendance Adjustment / Correction Request)** — giải quyết triệt để bài toán nhân viên quên check-in/out, thiết bị hết pin, lỗi tín hiệu GPS hoặc đi công tác đột xuất ngoài văn phòng.

---

## 1. Tổng quan Kiến trúc

```
+-------------------------------------------------------------------------+
|                              NHÂN VIÊN                                  |
|   - Nộp đơn giải trình (Ngày, Lý do, Mốc giờ đề xuất, Minh chứng)       |
|   - Theo dõi trạng thái đơn (Chờ duyệt, Đã duyệt, Đã từ chối, Đã hủy)   |
|   - Chủ động hủy đơn khi còn ở trạng thái PENDING                       |
+------------------------------------+------------------------------------+
                                     |
                                     v
                        POST /api/attendance/adjustments
                                     |
                                     v
+------------------------------------+------------------------------------+
|                         BUSINESS SERVICE LAYER                          |
|   - Validate mốc giờ: check-in < check-out, không nộp ngày tương lai    |
|   - Tính toán giờ công thực tế, tự động trừ 1h nghỉ trưa                |
|   - Xác định đi muộn (lateMinutes), về sớm (earlyMinutes)               |
|   - Trạng thái công: PRESENT (>=1 công), HALF_DAY (0.5 công), ABSENT    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                         PHÊ DUYỆT & ĐỒNG BỘ                             |
|   - PATCH /api/attendance/adjustments/[id]/approve                      |
|   - RBAC: Branch Admin duyệt chi nhánh mình; HR/Super Admin duyệt tất cả|
|   - Prisma $transaction:                                                |
|       1. Cập nhật AttendanceAdjustment (status = APPROVED / REJECTED)   |
|       2. Upsert AttendanceRecord (checkInMethod = MANUAL,               |
|          isManualEntry = true, approvedById, approvedAt)                |
|       3. Ghi vết AuditLog (hành động, người thực hiện, IP, old/new data)|
|       4. Bắn thông báo In-App qua Notification                          |
+-------------------------------------------------------------------------+
```

---

## 2. Mô hình Database & Prisma Schema

### 2.1 Model `AttendanceAdjustment`

```prisma
model AttendanceAdjustment {
  id                String            @id @default(cuid())
  employeeId        String
  date              DateTime          @db.Date
  type              AdjustmentType
  requestedCheckIn  DateTime?
  requestedCheckOut DateTime?
  reason            String
  evidenceUrl       String?
  status            AdjustmentStatus  @default(PENDING)
  approvedById      String?
  approvedAt        DateTime?
  rejectReason      String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId, date])
  @@index([status])
  @@index([date])
}

enum AdjustmentType {
  FORGOT_CHECKIN
  FORGOT_CHECKOUT
  FORGOT_BOTH
  GPS_ERROR
  BUSINESS_OUTSIDE
}

enum AdjustmentStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

---

## 3. Quy tắc Nghiệp vụ (Business Rules)

1. **Ràng buộc thời gian:**
   - Ngày xin giải trình phải là ngày hôm nay hoặc ngày trong quá khứ (`date <= today`). Không cho phép giải trình cho ngày tương lai.
   - Nhân viên chỉ được có **tối đa 1 đơn PENDING** cho cùng một ngày làm việc.
   - Nếu cung cấp cả hai mốc giờ, `requestedCheckIn < requestedCheckOut`.
2. **Khấu trừ giờ nghỉ trưa & tính công:**
   - Trừ tự động thời gian nghỉ trưa theo ca làm việc (mặc định 12:00 - 13:00) nếu ca làm việc đề xuất vắt qua khung giờ nghỉ.
   - `workDays`: `>= 8.0h` = 1.0 công (`PRESENT`); `4.0h - 7.9h` = 0.5 công (`HALF_DAY`); `< 4.0h` = 0 công (`ABSENT`).
3. **Đối soát & Minh bạch:**
   - Khi đơn được duyệt, bản ghi `AttendanceRecord` được upsert với cờ `isManualEntry = true` và `checkInMethod = MANUAL`.
   - Toàn bộ thao tác phê duyệt được ghi nhận vào `AuditLog` với `action: 'APPROVE_ATTENDANCE_ADJUSTMENT'`.

---

## 4. Danh sách API Endpoints

| Method | Endpoint | Quyền hạn (RBAC) | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/attendance/adjustments` | `EMPLOYEE`, `BRANCH_ADMIN`, `HR_MANAGER`, `SUPER_ADMIN` | Nộp đơn giải trình chấm công |
| `GET` | `/api/attendance/adjustments` | Đã đăng nhập (phân quyền dữ liệu theo role) | Lấy danh sách đơn (lọc theo status, branchId, date, v.v.) |
| `GET` | `/api/attendance/adjustments/[id]` | Chính chủ hoặc Quản lý chi nhánh / HR | Xem chi tiết đơn giải trình |
| `PATCH` | `/api/attendance/adjustments/[id]/approve` | `BRANCH_ADMIN` (chi nhánh mình), `HR_MANAGER`, `SUPER_ADMIN` | Phê duyệt hoặc từ chối đơn giải trình |
| `DELETE` | `/api/attendance/adjustments/[id]` | Chính chủ nộp đơn hoặc `SUPER_ADMIN` | Hủy đơn giải trình đang ở trạng thái `PENDING` |

---

## 5. Kiểm thử Tự động (Automated Tests)

Bộ test toàn diện tại `tests/attendance-adjustment.test.ts` gồm **23 test cases** độc lập kiểm thử:
- Chuyển đổi và chuẩn hóa múi giờ Việt Nam (UTC+7 sang UTC Date).
- Kiểm tra validation: thời gian hợp lệ, từ chối giờ ra trước giờ vào, từ chối ngày tương lai.
- Tính toán giờ công, trừ nghỉ trưa và phân loại trạng thái (`PRESENT`, `HALF_DAY`, `ABSENT`).
- Phân quyền RBAC dữ liệu cho Employee, Branch Admin và Super Admin.
- Phê duyệt và transaction cập nhật bản ghi chấm công thủ công + ghi nhận Audit Log.
- Từ chối đơn kèm lý do và quy trình hủy đơn của nhân viên.
