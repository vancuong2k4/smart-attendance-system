# ✅ Features Breakdown — Phân rã tính năng & Lộ trình phát triển

---

## 1. Phân rã tính năng theo Module

### Module 1: Authentication & Authorization

| Feature | Mô tả | Priority |
|---|---|---|
| Đăng nhập email/password | Form login với JWT | 🔴 P0 |
| Phân quyền RBAC | 4 roles: Super Admin, Branch Admin, HR, Employee | 🔴 P0 |
| Đổi mật khẩu | Nhân viên tự đổi | 🟡 P1 |
| Quên mật khẩu | Reset qua email | 🟡 P1 |
| Session management | Auto logout sau 8h | 🔴 P0 |

### Module 2: GPS Attendance (Core)

| Feature | Mô tả | Priority |
|---|---|---|
| Check-in GPS | Xác minh vị trí, ghi nhận thời gian | 🔴 P0 |
| Check-out GPS | Tương tự check-in | 🔴 P0 |
| Hiển thị bản đồ | Xem vị trí công ty và vị trí mình trên map | 🟡 P1 |
| Trạng thái real-time | Hiển thị đã check-in / chưa check-in | 🔴 P0 |
| Xử lý GPS lỗi | Thông báo rõ ràng khi GPS không khả dụng | 🔴 P0 |
| Chấm công thủ công | Nộp đơn khi không có GPS, chờ HR duyệt | 🟡 P1 |
| Nhắc nhở check-out | Push notification 17:30 nếu chưa checkout | 🟡 P1 |

### Module 3: Employee Management

| Feature | Mô tả | Priority |
|---|---|---|
| Danh sách nhân viên | Tìm kiếm, lọc theo chi nhánh/phòng ban | 🔴 P0 |
| Thêm nhân viên | Tạo profile + tài khoản đăng nhập | 🔴 P0 |
| Chỉnh sửa thông tin | Cập nhật profile nhân viên | 🔴 P0 |
| Vô hiệu hóa nhân viên | Soft delete, giữ lại lịch sử | 🔴 P0 |
| Import nhân viên | Import từ file Excel | 🟢 P2 |
| Quản lý phòng ban | Thêm/sửa/xóa phòng ban | 🔴 P0 |

### Module 4: Leave Management (Nghỉ phép)

| Feature | Mô tả | Priority |
|---|---|---|
| Nộp đơn xin nghỉ | Form với loại nghỉ, ngày, lý do | 🔴 P0 |
| Phê duyệt / từ chối đơn | Branch Admin / HR duyệt | 🔴 P0 |
| Xem lịch sử đơn | Nhân viên xem đơn của mình | 🔴 P0 |
| Số ngày phép còn lại | Hiển thị balance | 🔴 P0 |
| Lịch nghỉ lễ | Nhập danh sách ngày lễ hàng năm | 🟡 P1 |
| Nộp đơn OT | Đăng ký làm thêm giờ | 🟡 P1 |

### Module 5: Reports & Analytics

| Feature | Mô tả | Priority |
|---|---|---|
| Báo cáo chấm công ngày | Danh sách ai đến / vắng / muộn | 🔴 P0 |
| Báo cáo tháng theo nhân viên | Tổng hợp công tháng | 🔴 P0 |
| Báo cáo theo chi nhánh | Thống kê tỉ lệ chuyên cần | 🟡 P1 |
| Biểu đồ trực quan | Charts cho dashboard | 🟡 P1 |
| Lịch chấm công cá nhân | Calendar view | 🟡 P1 |

### Module 6: Payroll Export (Xuất lương)

| Feature | Mô tả | Priority |
|---|---|---|
| Xuất Excel (.xlsx) | Dữ liệu tháng theo chuẩn | 🔴 P0 |
| Xuất CSV | UTF-8 BOM | 🔴 P0 |
| Xuất JSON | Dùng cho API tích hợp | 🟡 P1 |
| Lọc theo chi nhánh / phòng ban | Xuất một phần | 🔴 P0 |
| Xem trước dữ liệu | Preview trước khi xuất | 🟡 P1 |

### Module 7: Settings & Configuration

| Feature | Mô tả | Priority |
|---|---|---|
| Quản lý chi nhánh | Thêm/sửa chi nhánh, cài GPS | 🔴 P0 |
| Cài đặt ca làm việc | Giờ bắt đầu, kết thúc, buffer | 🔴 P0 |
| Bán kính GPS | Cấu hình radius cho từng chi nhánh | 🔴 P0 |
| Thông báo | Cài đặt loại notification | 🟡 P1 |

---

## 2. Lộ trình phát triển (Roadmap)

### Sprint 1 (2 tuần) — Foundation
- [ ] Setup dự án: Next.js + Prisma + PostgreSQL + Redis
- [ ] Database schema & migrations
- [ ] Authentication (login, session, RBAC middleware)
- [ ] Layout cơ bản: sidebar, header
- [ ] Quản lý nhân viên (CRUD)
- [ ] Quản lý chi nhánh & phòng ban

### Sprint 2 (2 tuần) — Core GPS Attendance
- [ ] GPS check-in / check-out API
- [ ] Trang chấm công UI (nút check-in, map, trạng thái)
- [ ] Xác thực GPS + geofencing logic
- [ ] Lịch sử chấm công cá nhân
- [ ] Xử lý edge cases: GPS lỗi, ngoài giờ, trùng lặp

### Sprint 3 (2 tuần) — Leave & Reporting
- [ ] Leave management (nộp đơn, phê duyệt)
- [ ] Báo cáo chấm công ngày / tháng
- [ ] Xuất Excel / CSV cho tính lương
- [ ] Dashboard tổng quan

### Sprint 4 (1 tuần) — Polish & Testing
- [ ] Notifications (in-app + email)
- [ ] Mobile responsive optimization
- [ ] PWA setup
- [ ] Unit tests + E2E tests
- [ ] Performance optimization
- [ ] Deployment setup

---

## 3. User Stories chính

### Nhân viên

```
US-01: Là nhân viên, tôi muốn check-in bằng GPS để hệ thống ghi nhận 
       tôi có mặt tại văn phòng mà không cần dùng máy chấm công vật lý.

US-02: Là nhân viên, tôi muốn xem lịch sử chấm công của mình theo tháng
       để kiểm tra số ngày công và phát hiện sai sót.

US-03: Là nhân viên, tôi muốn nộp đơn xin nghỉ online để không cần 
       điền form giấy và chờ HR xử lý thủ công.

US-04: Là nhân viên, tôi muốn nhận thông báo khi đơn của tôi được 
       duyệt/từ chối để không cần hỏi HR từng lần.
```

### Branch Admin

```
US-05: Là quản lý chi nhánh, tôi muốn xem danh sách nhân viên vắng mặt 
       hôm nay để có phương án xử lý kịp thời.

US-06: Là quản lý chi nhánh, tôi muốn phê duyệt đơn nghỉ phép trên hệ 
       thống để quản lý lịch làm việc hiệu quả hơn.

US-07: Là quản lý chi nhánh, tôi muốn điều chỉnh vị trí GPS văn phòng 
       để đảm bảo nhân viên check-in đúng địa điểm.
```

### HR Manager

```
US-08: Là HR, tôi muốn xuất file Excel chấm công tháng để upload vào 
       phần mềm tính lương mà không cần nhập tay.

US-09: Là HR, tôi muốn xem báo cáo tổng hợp theo chi nhánh để nắm được
       tình trạng chuyên cần toàn công ty.

US-10: Là HR, tôi muốn điều chỉnh chấm công thủ công (kèm ghi chú) khi 
       nhân viên có lý do đặc biệt chính đáng.
```

---

## 4. Acceptance Criteria cho Core Features

### AC-01: GPS Check-in

**Given** nhân viên đang ở trong phạm vi 100m tính từ chi nhánh  
**And** thời gian hiện tại trong khung 06:00 – 10:00  
**And** nhân viên chưa check-in hôm nay  
**When** nhân viên nhấn nút "Check-in"  
**Then** hệ thống ghi nhận check-in với thời gian chính xác  
**And** hiển thị thông báo thành công  
**And** nút "Check-in" chuyển sang "Check-out"  

---

**Given** nhân viên đang ở ngoài phạm vi 100m  
**When** nhân viên nhấn nút "Check-in"  
**Then** hệ thống hiển thị lỗi với khoảng cách hiện tại  
**And** không ghi nhận bất kỳ bản ghi nào  

### AC-02: Xuất dữ liệu lương

**Given** HR chọn tháng 1/2024 và chi nhánh Hà Nội  
**When** HR nhấn "Xuất Excel"  
**Then** file .xlsx được tải về  
**And** file chứa đúng các cột theo chuẩn đã định nghĩa  
**And** số liệu khớp với dữ liệu chấm công trong hệ thống  
