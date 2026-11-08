# 📋 Smart Attendance System — Tổng quan dự án

> **Tài liệu tham chiếu chính** — Đọc file này trước khi làm bất kỳ feature nào.

---

## 1. Mô tả dự án

**Smart Attendance System** là ứng dụng web chấm công thông minh sử dụng GPS cho doanh nghiệp vừa và nhỏ. Hệ thống cho phép nhân viên check-in/check-out qua trình duyệt web bằng định vị GPS, quản lý đa chi nhánh và xuất dữ liệu sang phần mềm tính lương bên thứ ba.

## 2. Phạm vi dự án

| Tiêu chí | Giá trị |
|---|---|
| Quy mô nhân viên | 50 – 200 người |
| Phương thức chấm công | GPS (Geolocation API) |
| Giờ làm việc | Hành chính (mặc định 8:00 – 17:00) |
| Ngày làm việc | Thứ 2 – Thứ 6 |
| Cơ cấu tổ chức | 1 công ty mẹ, nhiều chi nhánh |
| Tích hợp | Xuất dữ liệu sang phần mềm tính lương (CSV / Excel / API) |

## 3. Các bên liên quan (Stakeholders)

| Vai trò | Mô tả |
|---|---|
| **Super Admin** | Quản trị toàn hệ thống, quản lý tất cả chi nhánh |
| **Branch Admin** | Quản trị chi nhánh, quản lý nhân viên trong chi nhánh |
| **HR Manager** | Xem báo cáo, phê duyệt đơn từ, xuất dữ liệu lương |
| **Employee** | Chấm công, xem lịch sử, nộp đơn xin phép |

## 4. Mục tiêu kinh doanh

- ✅ Thay thế chấm công giấy / máy quẹt thẻ
- ✅ Chống gian lận chấm công (GPS + thời gian thực)
- ✅ Giảm tải công việc thủ công cho bộ phận HR
- ✅ Truy xuất dữ liệu chấm công nhanh chóng, chính xác
- ✅ Tự động tính toán giờ công, giờ làm thêm, đi muộn, về sớm

## 5. Giới hạn phạm vi (Out of Scope)

- ❌ Tính lương trực tiếp trong hệ thống (chỉ xuất dữ liệu)
- ❌ Chấm công bằng vân tay / khuôn mặt / thẻ từ
- ❌ Ứng dụng mobile native (iOS / Android) — chỉ web responsive
- ❌ Quản lý tuyển dụng, đào tạo

## 6. Ràng buộc kỹ thuật

- Hỗ trợ trình duyệt: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Thiết bị: Desktop, Tablet, Mobile (responsive)
- Độ chính xác GPS: bán kính ≤ 100m
- Uptime yêu cầu: 99.5%
- Bảo mật: Dữ liệu cá nhân theo PDPA / GDPR-lite

---

> 📂 Xem thêm:
> - [02_BUSINESS_RULES.md](./02_BUSINESS_RULES.md) — Quy tắc nghiệp vụ chi tiết
> - [03_TECH_STACK.md](./03_TECH_STACK.md) — Công nghệ và kiến trúc
> - [04_DATABASE_DESIGN.md](./04_DATABASE_DESIGN.md) — Thiết kế cơ sở dữ liệu
> - [05_API_DESIGN.md](./05_API_DESIGN.md) — Thiết kế API
> - [06_FEATURES_BREAKDOWN.md](./06_FEATURES_BREAKDOWN.md) — Phân rã tính năng
