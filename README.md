# 📍 Smart Attendance System (Hệ thống chấm công GPS)

> Ứng dụng web chấm công thông minh bằng định vị GPS dành cho doanh nghiệp vừa và nhỏ (50 – 200 nhân viên) có nhiều chi nhánh, hỗ trợ trích xuất dữ liệu tính lương.

---

## ✨ Tính năng chính

- 📍 **Chấm công qua GPS:** Tự động xác thực vị trí nhân viên theo bán kính cho phép (geofence) của từng chi nhánh.
- 🏢 **Quản lý đa chi nhánh:** Hỗ trợ công ty mẹ và nhiều chi nhánh độc lập với tọa độ và cấu hình riêng biệt.
- ⏰ **Tính công & Đi muộn / Về sớm:** Tự động tính toán số phút đi muộn, về sớm và quy đổi ngày công theo ca hành chính (Thứ 2 – Thứ 6, 08:00 – 17:00).
- 🏖️ **Quản lý nghỉ phép & OT:** Nộp đơn và phê duyệt nghỉ phép trực tuyến theo phân quyền.
- 📊 **Xuất dữ liệu tính lương:** Trích xuất báo cáo chấm công định kỳ theo chuẩn Excel (.xlsx), CSV sang các phần mềm kế toán/tính lương.
- 🛡️ **Phân quyền người dùng (RBAC):**
  - **Super Admin:** Quản trị toàn hệ thống, cấu hình công ty và toàn bộ chi nhánh.
  - **Branch Admin:** Quản lý nhân viên, duyệt đơn và cấu hình GPS tại chi nhánh.
  - **HR Manager:** Theo dõi báo cáo chấm công tổng hợp, duyệt đơn, xuất dữ liệu tính lương.
  - **Employee:** Check-in / check-out GPS, theo dõi lịch sử chấm công, nộp đơn xin nghỉ.

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** Next.js (App Router, Webpack), React 19, TypeScript 5, Tailwind CSS v4.
- **Backend:** Next.js API Routes, NextAuth.js v5 (JWT & RBAC session).
- **Database & Cache:** PostgreSQL 16 (với Prisma ORM 6), Redis 7.
- **Map & Geolocation:** Geolocation API, Leaflet.js, React-Leaflet, thuật toán Haversine Formula.
- **Testing:** Vitest.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy (Local Development)

### 1. Yêu cầu hệ thống
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### 2. Cài đặt dependencies
```bash
pnpm install
```

### 3. Cấu hình môi trường
Sao chép `.env.example` thành `.env`:
```bash
cp .env.example .env
```

### 4. Khởi chạy Database & Cache (Docker)
```bash
docker compose up -d postgres redis
```

### 5. Đồng bộ Database & Khởi tạo dữ liệu mẫu (Seed)
```bash
pnpm prisma db push
pnpm db:seed
```

### 6. Khởi động ứng dụng
```bash
pnpm dev
```
Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

---

## 📋 Tài khoản trải nghiệm mặc định

| Vai trò | Email | Mật khẩu |
|---|---|---|
| **Super Admin** | `admin@demo.com` | `Admin@123` |
| **Branch Admin (HN)** | `admin.hn@demo.com` | `Admin@123` |
| **HR Manager** | `hr@demo.com` | `Admin@123` |
| **Nhân viên** | `nv001@demo.com` | `Nv@123456` |

---

## 📚 Tài liệu chi tiết dự án

Tài liệu chi tiết về nghiệp vụ và kiến trúc được lưu tại thư mục [`docs/`](./docs):
- [01_PROJECT_OVERVIEW.md](./docs/01_PROJECT_OVERVIEW.md) — Tổng quan dự án & Stakeholders
- [02_BUSINESS_RULES.md](./docs/02_BUSINESS_RULES.md) — Quy tắc nghiệp vụ & GPS Geofence
- [03_TECH_STACK.md](./docs/03_TECH_STACK.md) — Kiến trúc công nghệ & Thuật toán
- [04_DATABASE_DESIGN.md](./docs/04_DATABASE_DESIGN.md) — Thiết kế cơ sở dữ liệu (ERD, Prisma)
- [05_API_DESIGN.md](./docs/05_API_DESIGN.md) — Đặc tả API
- [06_FEATURES_BREAKDOWN.md](./docs/06_FEATURES_BREAKDOWN.md) — Roadmap & User Stories
