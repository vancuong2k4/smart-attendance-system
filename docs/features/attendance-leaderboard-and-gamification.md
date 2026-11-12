# Bảng Xếp Hạng Chuyên Cần & Gamification (Attendance Leaderboard & Punctuality Badges)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Gamification, Vinh danh Chuỗi ngày Đúng giờ (Streak), Tính điểm Chuyên cần (Punctuality Score) và Hệ thống Huy hiệu Danh dự cho Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Bảng Xếp Hạng Chuyên Cần & Gamification** được thiết kế nhằm khuyến khích văn hóa đúng giờ, nâng cao tính tự giác và ghi nhận sự cống hiến của nhân sự thông qua các yếu tố trò chơi hóa (Gamification):

1. **Chuỗi Ngày Đúng Giờ (On-Time Streak)**:
   - Theo dõi chuỗi ngày liên tiếp nhân viên hoàn thành ca làm việc đúng giờ (không đi muộn, không về sớm, có mặt đầy đủ).
   - Hiệu ứng ngọn lửa sống động 🔥, lưu trữ cả chuỗi hiện tại (`currentStreak`) và kỷ lục chuỗi dài nhất (`longestStreak`).
2. **Điểm Chuyên Cần (Punctuality Score - Thang điểm 100)**:
   - Công thức chuẩn hóa tự động tính toán điểm số hàng tháng dựa trên hành vi chấm công thực tế.
   - Thưởng điểm bonus cho nhân viên duy trì chuỗi streak dài.
   - Trừ điểm tương ứng khi đi muộn, về sớm hoặc nghỉ không phép.
3. **Bục Vinh Danh Top 3 (Podium)**:
   - Hiển thị vị trí Top 1 (Vàng 👑), Top 2 (Bạc 🥈), Top 3 (Đồng 🥉) với bục vinh danh 3 cấp độ nổi bật.
   - Cung cấp cái nhìn trực quan về những cá nhân xuất sắc nhất trong tháng.
4. **Bảng Xếp Hạng Toàn Diện (Leaderboard Table)**:
   - Danh sách xếp hạng chi tiết có tìm kiếm theo tên / mã nhân viên.
   - Hỗ trợ lọc đa chiều theo Tháng, Năm và Chi nhánh làm việc.
   - Tự động làm nổi bật dòng thông tin của chính người dùng (`Vị trí của bạn`) với huy hiệu riêng.
5. **Bộ Sưu Tập Huy Hiệu Danh Dự (Achievement Badges)**:
   - Hệ thống 7 danh hiệu phân cấp theo 4 Tiers: **BRONZE**, **SILVER**, **GOLD**, **DIAMOND**.
   - Hiển thị tỷ lệ phần trăm nhân viên toàn công ty đã đạt được huy hiệu để tăng tính cạnh tranh tích cực.
   - Modal hiển thị tiêu chí chi tiết và ngày mở khóa của từng cá nhân.
6. **Bộ Quét & Tính Toán Tự Động (Recalculation Engine)**:
   - Cung cấp API và nút thao tác trực tiếp trên giao diện dành cho Admin/HR để quét và đồng bộ điểm số cho toàn bộ doanh nghiệp.

---

## 2. Thiết kế Cơ sở Dữ liệu (Database Schema)

Hệ thống bổ sung 2 model và 2 enum trong Prisma Schema:

```prisma
enum BadgeType {
  EARLY_BIRD             // Check-in sớm hơn >= 15 phút trong 5 ca
  PERFECT_WEEK           // 5 ngày làm việc liên tiếp đúng giờ
  PERFECT_MONTH          // Cả tháng 100% đúng giờ và không về sớm
  ON_TIME_HERO           // Chuỗi 30 ngày đúng giờ liên tục
  OVERTIME_CHAMPION      // Trên 20 giờ làm thêm giờ hợp lệ trong tháng
  STREAK_MASTER          // Chuỗi kỷ lục 60 ngày liên tục
  PUNCTUALITY_DIAMOND    // Đạt 100 điểm tuyệt đối với tối thiểu 20 ngày công
}

enum BadgeTier {
  BRONZE
  SILVER
  GOLD
  DIAMOND
}

model EmployeeBadge {
  id          String    @id @default(cuid())
  employeeId  String
  badgeType   BadgeType
  tier        BadgeTier @default(BRONZE)
  title       String
  description String
  icon        String    @default("award")
  unlockedAt  DateTime  @default(now())
  metadata    Json?

  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, badgeType])
  @@index([employeeId])
  @@index([badgeType])
}

model AttendanceStreak {
  id               String   @id @default(cuid())
  employeeId       String
  currentStreak    Int      @default(0)
  longestStreak    Int      @default(0)
  punctualityScore Float    @default(100)
  totalOnTime      Int      @default(0)
  totalLate        Int      @default(0)
  totalEarlyLeave  Int      @default(0)
  month            Int
  year             Int
  rank             Int?
  branchRank       Int?
  updatedAt        DateTime @updatedAt
  createdAt        DateTime @default(now())

  employee         Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, month, year])
  @@index([month, year, punctualityScore])
  @@index([employeeId])
}
```

---

## 3. Thuật toán Điểm Chuyên cần & Đánh giá Huy hiệu

### 3.1 Công thức Tính Điểm Chuyên Cần (Punctuality Score)

$$\text{Base} = 100$$
$$\text{Penalty} = (\text{totalLate} \times 5) + (\text{totalEarlyLeave} \times 3) + (\text{totalAbsent} \times 15)$$
$$\text{Bonus} = \begin{cases} 5, & \text{nếu } \text{currentStreak} \ge 10 \\ 2, & \text{nếu } \text{currentStreak} \ge 5 \\ 0, & \text{ngược lại} \end{cases}$$
$$\text{PunctualityScore} = \max(0, \min(100, \text{Base} - \text{Penalty} + \text{Bonus}))$$

### 3.2 Danh mục & Điều kiện Mở Khóa Huy Hiệu

| Huy hiệu | Danh hiệu | Cấp bậc (Tier) | Điểm thưởng | Tiêu chí mở khóa |
|---|---|:---:|:---:|---|
| `EARLY_BIRD` | Chim Sớm Chăm Chỉ | **SILVER** | +50 | Check-in sớm hơn giờ quy định $\ge 15$ phút trong ít nhất 5 ca |
| `PERFECT_WEEK` | Tuần Lễ Hoàn Hảo | **BRONZE** | +30 | Chuỗi streak đúng giờ đạt liên tiếp 5 ngày |
| `PERFECT_MONTH` | Tháng Chuyên Cần Vàng | **GOLD** | +150 | Tối thiểu 15 ngày công trong tháng, 0 lần muộn, 0 lần về sớm |
| `ON_TIME_HERO` | Chiến Binh Kỷ Luật | **GOLD** | +200 | Duy trì chuỗi đúng giờ liên tục 30 ngày |
| `OVERTIME_CHAMPION` | Ngôi Sao Cống Hiến | **SILVER** | +100 | Đạt trên 20 giờ làm thêm giờ (OT) được duyệt trong tháng |
| `STREAK_MASTER` | Bậc Thầy Kiên Trì | **DIAMOND** | +500 | Duy trì chuỗi streak kỷ lục 60 ngày liên tục |
| `PUNCTUALITY_DIAMOND` | Kim Cương Chuyên Cần | **DIAMOND** | +300 | Đạt 100 điểm tuyệt đối với tối thiểu 20 ngày công trong tháng |

---

## 4. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền (RBAC) | Mô tả |
|---|---|---|---|
| `GET` | `/api/gamification/my-stats` | `AUTHENTICATED` | Lấy chuỗi streak hiện tại, điểm số, thứ hạng và huy hiệu của cá nhân |
| `GET` | `/api/gamification/leaderboard` | `AUTHENTICATED` | Lấy bảng xếp hạng theo tháng, chi nhánh kèm Podium Top 3 |
| `GET` | `/api/gamification/badges` | `AUTHENTICATED` | Lấy danh mục toàn bộ huy hiệu, tỷ lệ đạt được và trạng thái sở hữu |
| `POST` | `/api/gamification/recalculate` | `SUPER_ADMIN`, `BRANCH_ADMIN`, `HR_MANAGER` | Quét và tính toán lại điểm số, cấp huy hiệu tự động cho nhân sự |

---

## 5. Giao diện Người dùng (UI Components)

- **Thẻ Thống kê Cá nhân ([PersonalStreakCard.tsx](file:///d:/github/smart-attendance-system/src/components/gamification/PersonalStreakCard.tsx))**:
  - Tích hợp hiệu ứng ngọn lửa, chỉ số streak kỷ lục, thứ hạng cá nhân toàn công ty và tại chi nhánh.
  - Thanh tiến độ mục tiêu kế tiếp (Next Milestone) trực quan.
- **Bục Vinh Danh Top 3 ([LeaderboardPodium.tsx](file:///d:/github/smart-attendance-system/src/components/gamification/LeaderboardPodium.tsx))**:
  - Bục vinh danh 3 bậc với vương miện chuyển động và màu sắc phân cấp Gold, Silver, Bronze.
- **Bảng Xếp Hạng Chi Tiết ([LeaderboardTable.tsx](file:///d:/github/smart-attendance-system/src/components/gamification/LeaderboardTable.tsx))**:
  - Tìm kiếm nhanh theo họ tên hoặc mã nhân viên, highlight dòng của chính người dùng.
- **Bộ Sưu Tập Huy Hiệu ([BadgeGallery.tsx](file:///d:/github/smart-attendance-system/src/components/gamification/BadgeGallery.tsx))**:
  - Lưới hiển thị danh mục huy hiệu, phân loại theo Tier và Modal xem điều kiện chi tiết.
- **Trang Điều Khiển Chính ([page.tsx](file:///d:/github/smart-attendance-system/src/app/(dashboard)/leaderboard/page.tsx))**:
  - Chuyển đổi mượt mà giữa Bảng xếp hạng và Bộ sưu tập huy hiệu, bộ chọn tháng/năm/chi nhánh, nút quét điểm số.
- **Điều hướng Sidebar ([DashboardSidebar.tsx](file:///d:/github/smart-attendance-system/src/components/layout/DashboardSidebar.tsx))**:
  - Thêm icon Cúp vàng `Trophy` dẫn đến `/leaderboard` cho tất cả nhân sự trong doanh nghiệp.

---

## 6. Kiểm thử Tự động (Automated Testing)

File test suite tại `tests/gamification.test.ts` bao gồm **19 test cases** phủ kín:
- 5 tests kiểm thử giải thuật `calculatePunctualityScore` (điểm gốc, phạt muộn, về sớm, vắng không phép, thưởng streak, chặn biên [0, 100]).
- 2 tests kiểm thử giải thuật `calculateStreaks` (chuỗi tăng liên tục, chuỗi reset khi vi phạm).
- 3 tests kiểm thử `evaluateEligibleBadges` (cấp huy hiệu tuần, huy hiệu OT, chặn cấp trùng).
- 4 tests kiểm thử `GET /api/gamification/my-stats` (xác thực, kiểm tra tham số, tài khoản admin chưa link employee, nhân viên đủ dữ liệu).
- 2 tests kiểm thử `GET /api/gamification/leaderboard` (xác thực, bục podium top 3 và danh sách xếp hạng).
- 1 test kiểm thử `GET /api/gamification/badges` (tỷ lệ đạt được toàn công ty và danh mục huy hiệu).
- 2 tests kiểm thử `POST /api/gamification/recalculate` (phân quyền 403 với Employee, quyền Admin xử lý thành công và ghi AuditLog).

Kết quả: **276 / 276 tests** trên toàn bộ 15 test suites của dự án đều vượt qua 100%.
