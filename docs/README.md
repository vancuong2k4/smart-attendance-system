# 📚 Smart Attendance System — Documentation Index

> **Đây là điểm khởi đầu để hiểu toàn bộ dự án.**
> Đọc theo thứ tự từ trên xuống để nắm vững ngữ cảnh trước khi code.

---

## Danh sách tài liệu

| # | File | Nội dung | Đọc khi nào |
|---|---|---|---|
| 01 | [01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md) | Tổng quan, phạm vi, stakeholders | **Luôn đọc trước** |
| 02 | [02_BUSINESS_RULES.md](./02_BUSINESS_RULES.md) | Quy tắc nghiệp vụ, GPS rules, phân quyền | Trước khi code bất kỳ logic gì |
| 03 | [03_TECH_STACK.md](./03_TECH_STACK.md) | Công nghệ, kiến trúc, cấu trúc thư mục | Trước khi setup dự án |
| 04 | [04_DATABASE_DESIGN.md](./04_DATABASE_DESIGN.md) | Prisma schema, ERD, indexes | Trước khi làm việc với DB |
| 05 | [05_API_DESIGN.md](./05_API_DESIGN.md) | API endpoints, request/response format | Trước khi viết API hoặc gọi API |
| 06 | [06_FEATURES_BREAKDOWN.md](./06_FEATURES_BREAKDOWN.md) | Danh sách tính năng, roadmap, user stories | Khi lên kế hoạch sprint |

---

## Quick Reference

### Thông tin dự án

- **Quy mô:** 50–200 nhân viên
- **Chấm công:** GPS (Geolocation API trên trình duyệt)
- **Giờ làm:** 08:00 – 17:00, Thứ 2 – Thứ 6
- **Cơ cấu:** Công ty mẹ → Chi nhánh → Phòng ban → Nhân viên
- **Output:** Xuất Excel/CSV cho phần mềm tính lương

### Tech Stack tóm tắt

```
Frontend:  Next.js 14 (App Router) + TypeScript + Tailwind + ShadCN
Backend:   Next.js API Routes + Prisma ORM
Database:  PostgreSQL 16
Cache:     Redis 7
Auth:      NextAuth.js v5 (JWT)
Deploy:    Vercel + Supabase (hoặc VPS + Docker)
```

### Roles hệ thống

| Role | Viết tắt |
|---|---|
| Super Admin | `SUPER_ADMIN` |
| Branch Admin | `BRANCH_ADMIN` |
| HR Manager | `HR_MANAGER` |
| Employee | `EMPLOYEE` |

### Error Codes GPS

| Code | Nghĩa |
|---|---|
| `OUTSIDE_GEOFENCE` | Ngoài vùng GPS cho phép |
| `ALREADY_CHECKED_IN` | Đã check-in rồi |
| `OUTSIDE_WORK_HOURS` | Ngoài khung giờ |
| `GPS_REQUIRED` | Chưa cấp quyền GPS |

---

## Quy tắc vàng khi phát triển

> 1. **Không tự suy diễn nghiệp vụ** — mọi logic phải có trong [02_BUSINESS_RULES.md](./02_BUSINESS_RULES.md)
> 2. **GPS validation phải ở server-side** — không tin client
> 3. **Mọi thao tác chỉnh sửa chấm công phải có audit log**
> 4. **Phân quyền phải kiểm tra ở API layer**, không chỉ UI
> 5. **Dữ liệu xuất lương phải match chính xác** với bảng `AttendanceRecord`
