# 📐 Business Rules — Quy tắc nghiệp vụ

> ⚠️ **QUAN TRỌNG**: Mọi logic code phải tuân theo tài liệu này. Không được tự suy diễn nghiệp vụ.

---

## 1. Cấu trúc tổ chức

```
Công ty (Company)
├── Chi nhánh A (Branch)
│   ├── Phòng ban 1 (Department)
│   │   └── Nhân viên (Employee)
│   └── Phòng ban 2
└── Chi nhánh B
    └── Phòng ban 3
```

- Mỗi nhân viên thuộc **đúng 1 chi nhánh** và **đúng 1 phòng ban**
- Mỗi chi nhánh có **1 địa điểm GPS** (tọa độ trung tâm + bán kính cho phép)
- Branch Admin chỉ quản lý nhân viên trong chi nhánh của mình

---

## 2. Quy định giờ làm việc

### 2.1 Ca làm việc mặc định (Hành chính)

| Thông số | Giá trị |
|---|---|
| Giờ bắt đầu | 08:00 |
| Giờ kết thúc | 17:00 |
| Giờ nghỉ trưa | 12:00 – 13:00 |
| Tổng giờ làm việc thực tế | 8 giờ / ngày |
| Ngày làm việc | Thứ 2 – Thứ 6 |

> 💡 Ca làm việc có thể được tùy chỉnh theo từng chi nhánh hoặc từng nhân viên.

### 2.2 Chính sách trễ / sớm

| Tình huống | Định nghĩa | Hành động |
|---|---|---|
| **Đúng giờ** | Check-in ≤ 08:00 | Bình thường |
| **Đi muộn** | Check-in trong 08:01 – 08:15 | Ghi nhận, cảnh báo |
| **Đi muộn nặng** | Check-in sau 08:15 | Ghi nhận, trừ công |
| **Về sớm** | Check-out trước 16:45 | Ghi nhận, trừ công |
| **Làm thêm giờ (OT)** | Check-out sau 17:30 | Ghi nhận, chờ phê duyệt OT |

> ⚠️ Thời gian buffer 15 phút cho trễ nhẹ — cấu hình được theo từng công ty.

### 2.3 Ngưỡng tính công

- Làm đủ ≥ 4 giờ → tính 0.5 công
- Làm đủ ≥ 7 giờ → tính 1 công
- Không check-in hoặc không check-out → **vắng mặt** (trừ khi có đơn)

---

## 3. Quy tắc chấm công GPS

### 3.1 Điều kiện hợp lệ để check-in

1. ✅ Thiết bị phải cấp quyền GPS
2. ✅ Vị trí hiện tại phải nằm trong **bán kính cho phép** của chi nhánh (mặc định 100m)
3. ✅ Chỉ được check-in trong **khung giờ hợp lệ** (06:00 – 10:00)
4. ✅ Chưa check-in trong ngày hôm đó
5. ✅ Độ chính xác GPS ≥ 50m (accuracy ≤ 50)

### 3.2 Điều kiện hợp lệ để check-out

1. ✅ Đã check-in trong ngày
2. ✅ Vị trí hợp lệ HOẶC có lý do đặc biệt được phê duyệt
3. ✅ Chỉ được check-out trong khung giờ (11:00 – 22:00)
4. ✅ Thời gian từ lúc check-in ≥ 1 giờ

### 3.3 Xử lý khi GPS không khả dụng

- Hiển thị thông báo lỗi rõ ràng
- Cho phép nộp đơn **"Chấm công thủ công"** chờ HR phê duyệt
- Ghi log lỗi GPS để kiểm tra

### 3.4 Dữ liệu GPS lưu trữ

```json
{
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 15.5,
  "timestamp": "2024-01-15T08:02:35+07:00",
  "device_info": "Chrome/120 on Android"
}
```

---

## 4. Các loại nghỉ / vắng mặt

| Mã | Loại | Có lương | Cần phê duyệt | Số ngày/năm |
|---|---|---|---|---|
| `AL` | Nghỉ phép năm | ✅ | ✅ | 12 ngày |
| `SL` | Nghỉ ốm | ✅ | ✅ (hậu kiểm) | 10 ngày |
| `ML` | Nghỉ thai sản | ✅ | ✅ | Theo luật |
| `UL` | Nghỉ không lương | ❌ | ✅ | Không giới hạn |
| `PH` | Nghỉ lễ | ✅ | ❌ | Theo lịch |
| `WH` | Làm việc tại nhà (WFH) | ✅ | ✅ | Theo policy |
| `BT` | Công tác | ✅ | ✅ | Không giới hạn |

### 4.1 Quy trình xin nghỉ

```
Nhân viên nộp đơn → Branch Admin / HR duyệt → Hệ thống cập nhật chấm công
                  ↓ Từ chối → Nhân viên nhận thông báo
```

---

## 5. Báo cáo và xuất dữ liệu

### 5.1 Báo cáo nội bộ

- Báo cáo chấm công ngày / tuần / tháng
- Báo cáo tổng hợp theo chi nhánh / phòng ban
- Báo cáo nhân viên đi muộn, vắng mặt
- Báo cáo số ngày phép còn lại

### 5.2 Xuất dữ liệu tính lương

Hệ thống cần xuất dữ liệu theo **định dạng chuẩn** cho từng kỳ lương (thường là tháng):

**Các trường bắt buộc trong file xuất:**

| Trường | Mô tả |
|---|---|
| `employee_code` | Mã nhân viên |
| `employee_name` | Tên nhân viên |
| `department` | Phòng ban |
| `branch` | Chi nhánh |
| `work_days` | Số ngày công thực tế |
| `absent_days` | Số ngày vắng (không lương) |
| `paid_leave_days` | Số ngày nghỉ có lương |
| `late_count` | Số lần đi muộn |
| `ot_hours` | Tổng giờ làm thêm đã duyệt |
| `period_start` | Từ ngày |
| `period_end` | Đến ngày |

**Định dạng hỗ trợ:**
- Excel (.xlsx)
- CSV (UTF-8 BOM)
- JSON (dùng cho API tích hợp)

---

## 6. Quy tắc phân quyền (RBAC)

| Quyền | Super Admin | Branch Admin | HR Manager | Employee |
|---|---|---|---|---|
| Xem tất cả chi nhánh | ✅ | ❌ | ✅ | ❌ |
| Thêm/xóa nhân viên | ✅ | ✅ (chi nhánh mình) | ❌ | ❌ |
| Phê duyệt đơn từ | ✅ | ✅ (chi nhánh mình) | ✅ | ❌ |
| Xuất dữ liệu lương | ✅ | ❌ | ✅ | ❌ |
| Cấu hình ca làm | ✅ | ✅ (chi nhánh mình) | ❌ | ❌ |
| Chấm công | ❌ | ❌ | ❌ | ✅ |
| Xem chấm công của mình | ✅ | ✅ | ✅ | ✅ |
| Chỉnh sửa GPS location | ✅ | ✅ (chi nhánh mình) | ❌ | ❌ |

---

## 7. Notifications (Thông báo)

| Sự kiện | Người nhận | Kênh |
|---|---|---|
| Check-in thành công | Nhân viên | Web push / In-app |
| Quên check-out (17:30) | Nhân viên | Web push |
| Đơn xin phép được phê duyệt | Nhân viên | In-app + Email |
| Nhân viên vắng không phép | Branch Admin | In-app |
| Nhân viên đi muộn | Branch Admin | In-app (tổng hợp cuối ngày) |
| Có đơn chờ duyệt | Branch Admin / HR | In-app |
