# 🛠️ Tech Stack & Kiến trúc hệ thống

> Tài liệu này mô tả công nghệ được chọn, lý do chọn, và kiến trúc tổng thể.

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│   Next.js 14 (App Router) + Tailwind CSS + ShadCN UI   │
│            PWA (Progressive Web App)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / REST / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                    API LAYER                             │
│           Next.js API Routes / Node.js                   │
│          Auth: NextAuth.js (JWT + Session)               │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│  PostgreSQL  │ │    Redis     │ │   MinIO /  │
│  (Primary   │ │  (Session +  │ │  Cloudinary│
│   Database) │ │   Cache)     │ │  (Files)   │
└─────────────┘ └─────────────┘ └────────────┘
```

---

## 2. Lý do chọn công nghệ

### 2.1 Frontend — Next.js 14

| Tiêu chí | Lý do |
|---|---|
| **App Router** | Hỗ trợ Server Components, layout lồng nhau, loading UI |
| **PWA support** | Nhân viên có thể "cài" như app mobile, offline support |
| **SEO & Performance** | SSR/SSG giúp tải nhanh trang đầu |
| **API Routes** | Fullstack trong 1 repo, giảm complexity |
| **TypeScript** | Type safety, dễ maintain khi scale |

### 2.2 Database — PostgreSQL

| Tiêu chí | Lý do |
|---|---|
| **ACID transactions** | Đảm bảo tính toàn vẹn dữ liệu chấm công |
| **PostGIS extension** | Hỗ trợ query địa lý (tính khoảng cách GPS) |
| **JSON columns** | Lưu metadata linh hoạt (device info, raw GPS data) |
| **Mature & stable** | Phù hợp dữ liệu doanh nghiệp |

### 2.3 ORM — Prisma

- Type-safe database client
- Migration tự động
- Dễ đọc schema

### 2.4 Authentication — NextAuth.js

- Hỗ trợ credentials (email/password)
- JWT + Session management
- Dễ tích hợp RBAC

### 2.5 Redis (Cache & Session)

- Lưu session user
- Cache báo cáo tổng hợp (tránh query nặng)
- Rate limiting cho API chấm công

---

## 3. Tech Stack chi tiết

### Frontend

```
Framework:        Next.js 14 (App Router)
Language:         TypeScript 5
Styling:          Tailwind CSS 3
UI Components:    ShadCN UI (Radix UI primitives)
State Management: Zustand (client state) + TanStack Query (server state)
Forms:            React Hook Form + Zod (validation)
Charts/Reports:   Recharts
Maps:             Leaflet.js (hiển thị vị trí GPS trên map)
PWA:              next-pwa
Icons:            Lucide React
```

### Backend

```
Runtime:          Node.js 20 LTS
Framework:        Next.js API Routes
Language:         TypeScript 5
ORM:              Prisma 5
Auth:             NextAuth.js v5
Validation:       Zod
Job Queue:        Bull MQ (xử lý tác vụ nền: gửi email, reminder)
Email:            Nodemailer + React Email templates
```

### Database & Infrastructure

```
Primary DB:       PostgreSQL 16 (với PostGIS)
Cache/Session:    Redis 7
File Storage:     Cloudinary (ảnh avatar) hoặc MinIO (self-hosted)
Hosting:          Vercel (Frontend + API) hoặc VPS với Docker
DB Hosting:       Supabase hoặc Railway (PostgreSQL managed)
```

### DevOps & Tooling

```
Containerization: Docker + Docker Compose (local dev)
CI/CD:            GitHub Actions
Linting:          ESLint + Prettier
Testing:          Vitest (unit) + Playwright (e2e)
Logging:          Winston + Sentry (error tracking)
API Docs:         Swagger / OpenAPI 3.0
```

---

## 4. Cấu trúc thư mục dự án

```
smart-attendance-system/
├── docs/                          # Tài liệu dự án (thư mục này)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # Routes: login, register
│   │   ├── (dashboard)/           # Routes chính sau đăng nhập
│   │   │   ├── attendance/        # Trang chấm công
│   │   │   ├── employees/         # Quản lý nhân viên
│   │   │   ├── leaves/            # Quản lý nghỉ phép
│   │   │   ├── reports/           # Báo cáo
│   │   │   └── settings/          # Cài đặt hệ thống
│   │   └── api/                   # API endpoints
│   │       ├── auth/
│   │       ├── attendance/
│   │       ├── employees/
│   │       ├── leaves/
│   │       └── reports/
│   ├── components/                # React components dùng chung
│   │   ├── ui/                    # ShadCN UI components
│   │   ├── attendance/            # Components chấm công
│   │   ├── reports/               # Components báo cáo
│   │   └── layout/                # Layout components
│   ├── lib/                       # Utilities & helpers
│   │   ├── auth.ts                # NextAuth config
│   │   ├── db.ts                  # Prisma client
│   │   ├── redis.ts               # Redis client
│   │   ├── gps.ts                 # GPS utilities (distance calc)
│   │   └── export.ts              # Excel/CSV export logic
│   ├── hooks/                     # Custom React hooks
│   ├── store/                     # Zustand stores
│   ├── types/                     # TypeScript type definitions
│   └── validations/               # Zod schemas
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # DB migrations
├── public/                        # Static files
├── tests/
│   ├── unit/
│   └── e2e/
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 5. Tính toán GPS — Thuật toán Haversine

Để kiểm tra nhân viên có trong vùng cho phép không, dùng **Haversine formula**:

```typescript
// lib/gps.ts
export function calculateDistance(
  lat1: number, lon1: number,  // Vị trí nhân viên
  lat2: number, lon2: number   // Vị trí chi nhánh
): number {
  const R = 6371000; // Bán kính Trái Đất (mét)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(
  employeeLat: number, employeeLon: number,
  branchLat: number, branchLon: number,
  radiusMeters: number = 100
): boolean {
  return calculateDistance(employeeLat, employeeLon, branchLat, branchLon) <= radiusMeters;
}
```

---

## 6. Môi trường triển khai

### Development (Local)

```bash
docker-compose up -d   # Chạy PostgreSQL + Redis local
pnpm dev               # Next.js dev server
```

### Production — Option 1: Vercel + Supabase (Khuyến nghị)

- **Vercel**: Deploy Next.js, auto-scaling, CI/CD từ GitHub
- **Supabase**: PostgreSQL managed + realtime subscriptions
- **Upstash**: Redis serverless
- **Chi phí**: ~\$50-150/tháng tùy scale

### Production — Option 2: VPS (Self-hosted)

- **VPS**: 4 vCPU, 8GB RAM (DigitalOcean / AWS EC2)
- **Docker Compose**: PostgreSQL + Redis + App
- **Nginx**: Reverse proxy + SSL (Let's Encrypt)
- **Chi phí**: ~\$40-80/tháng

---

## 7. Security Checklist

- [ ] HTTPS bắt buộc (SSL/TLS)
- [ ] Rate limiting API chấm công (tối đa 10 req/phút/user)
- [ ] Input validation với Zod trên cả client lẫn server
- [ ] SQL injection prevention (Prisma ORM)
- [ ] XSS prevention (Next.js built-in)
- [ ] CORS configuration chặt chẽ
- [ ] GPS data không thể fake dễ dàng (server-side timestamp)
- [ ] Log audit trail cho mọi thao tác chấm công
- [ ] Mã hóa mật khẩu với bcrypt (salt rounds: 12)
- [ ] Session timeout: 8 giờ
