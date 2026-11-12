# Quản lý Chi nhánh & Geofence GPS (Branch & Geofence Map Management)

Tài liệu kỹ thuật và hướng dẫn vận hành tính năng Quản lý Chi nhánh, Thiết lập Tọa độ GPS và Bán kính Vùng Chấm công (Geofencing) trong Hệ thống Điểm danh Thông minh (Smart Attendance System).

---

## 1. Tổng quan tính năng

Tính năng **Quản lý Chi nhánh & Geofence GPS** là nền tảng cốt lõi của toàn bộ cơ chế chấm công tự động trên hệ thống. Tính năng này cho phép Quản trị viên:
1. **Thiết lập danh mục cơ sở văn phòng / chi nhánh** trên toàn quốc với mã định danh duy nhất và địa chỉ chi tiết.
2. **Cấu hình tọa độ GPS chính xác** (Vĩ độ & Kinh độ với độ chuẩn xác tới 6 chữ số thập phân ~ 0.1 mét).
3. **Bản đồ tương tác Leaflet trực quan**: Kéo thả Marker định vị, click lên bản đồ để lấy tọa độ tức thì, hoặc sử dụng định vị GPS thực tế của thiết bị (`navigator.geolocation`).
4. **Vòng tròn Geofence động**: Điều chỉnh bán kính cho phép chấm công từ 20 mét đến 1000 mét thông qua thanh trượt (slider) và các nút chọn nhanh (50m, 100m, 200m, 500m).
5. **Bộ giả lập & Kiểm tra Geofence thời gian thực (Geofence Simulator)**: Giúp Admin kiểm tra bất kỳ vị trí nào trên bản đồ hoặc vị trí thực tế của mình để xác nhận xem có nằm trong vùng chấm công hay không trước khi áp dụng vào thực tế.
6. **Bảo vệ an toàn dữ liệu (Safe Deletion)**: Chặn hoàn toàn việc xóa chi nhánh nếu vẫn còn nhân sự trực thuộc, ngăn ngừa lỗi mồ côi dữ liệu (orphaned records).

---

## 2. Kiến trúc & Giải thuật Geofencing

### 2.1 Thuật toán khoảng cách Haversine (Great-Circle Distance)
Hệ thống sử dụng công thức Haversine để tính khoảng cách đường chim bay giữa tọa độ nhân viên và tâm chi nhánh:

$$a = \sin^2\left(\frac{\Delta\varphi}{2}\right) + \cos(\varphi_1) \cdot \cos(\varphi_2) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
$$d = R \cdot c \quad (\text{với } R = 6,371,000 \text{ mét})$$

- $\varphi_1, \varphi_2$: Vĩ độ của 2 điểm (theo radian).
- $\Delta\varphi, \Delta\lambda$: Độ chênh lệch vĩ độ và kinh độ giữa 2 điểm.
- $d$: Khoảng cách thực tế tính bằng mét.

### 2.2 Đánh giá hợp lệ Geofence
Một lượt chấm công hoặc thử nghiệm được coi là **HỢP LỆ** khi và chỉ khi:
$$d \le \text{gpsRadius}$$

Trường hợp $d > \text{gpsRadius}$, hệ thống sẽ từ chối chấm công, trả về mã lỗi `OUTSIDE_GEOFENCE` và thông báo khoảng cách thực tế người dùng cần di chuyển thêm để vào vùng hợp lệ.

---

## 3. Danh sách API Endpoints

| Phương thức | Đường dẫn | Phân quyền | Mô tả |
|---|---|---|---|
| `GET` | `/api/branches` | `AUTHENTICATED` | Lấy danh sách chi nhánh (hỗ trợ lọc `status`, `search`, `includeCounts`) |
| `POST` | `/api/branches` | `SUPER_ADMIN` | Tạo chi nhánh mới kèm tọa độ GPS và bán kính Geofence |
| `GET` | `/api/branches/[id]` | `AUTHENTICATED` | Lấy chi tiết chi nhánh kèm danh sách phòng ban và lịch ca |
| `PATCH` | `/api/branches/[id]` | `SUPER_ADMIN`, `BRANCH_ADMIN` | Chỉnh sửa thông tin, tọa độ GPS hoặc bán kính chi nhánh |
| `DELETE` | `/api/branches/[id]` | `SUPER_ADMIN` | Xóa an toàn chi nhánh (kiểm tra `_count.employees === 0`) |
| `POST` | `/api/branches/[id]/test-geofence` | `AUTHENTICATED` | Kiểm tra tọa độ GPS bất kỳ với vùng Geofence của chi nhánh |
| `GET` | `/api/branches/stats` | `AUTHENTICATED` | Tổng hợp thống kê chi nhánh, bán kính trung bình và phân bổ nhân sự |

---

## 4. Chi tiết các API Endpoints

### 4.1 `GET /api/branches`
**Query Parameters:**
- `status`: `'all'` | `'active'` | `'inactive'` (mặc định `'all'`).
- `search`: Chuỗi tìm kiếm theo tên, mã hoặc địa chỉ chi nhánh.
- `includeCounts`: `'true'` để lấy thêm số lượng nhân sự, phòng ban, ca làm việc.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cm...01",
      "name": "Trụ sở chính Hà Nội",
      "code": "HN-HQ",
      "address": "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
      "phone": "024-3868-0000",
      "latitude": 21.028511,
      "longitude": 105.854444,
      "gpsRadius": 100,
      "isActive": true,
      "_count": {
        "employees": 42,
        "departments": 5,
        "schedules": 2
      }
    }
  ]
}
```

---

### 4.2 `POST /api/branches`
Tạo chi nhánh mới (Chỉ dành cho Quản trị viên cấp cao `SUPER_ADMIN`).

**Request Body:**
```json
{
  "name": "Chi nhánh Đà Nẵng",
  "code": "DN-01",
  "address": "15 Quang Trung, Hải Châu, Đà Nẵng",
  "phone": "0236-388-9999",
  "latitude": 16.054407,
  "longitude": 108.202167,
  "gpsRadius": 150,
  "isActive": true
}
```

---

### 4.3 `POST /api/branches/[id]/test-geofence`
Kiểm tra thử nghiệm tọa độ với chi nhánh:

**Request Body:**
```json
{
  "latitude": 21.028600,
  "longitude": 105.854500,
  "accuracy": 12
}
```

**Response (Thành công & Hợp lệ):**
```json
{
  "success": true,
  "data": {
    "branchId": "cm...01",
    "branchName": "Trụ sở chính Hà Nội",
    "branchRadius": 100,
    "isInside": true,
    "distanceMeters": 13,
    "formattedDistance": "13 m",
    "deltaMeters": 87,
    "verdict": "INSIDE",
    "message": "Vị trí hợp lệ! Bạn đang ở trong bán kính chấm công (cách tâm 13m, cách biên 87m)."
  }
}
```

---

## 5. Các Component Giao diện (Frontend)

1. **`BranchMapPicker` & `BranchMapPickerInner`**: Component bản đồ Leaflet tích hợp SSR-safe via Next.js `dynamic()`. Cho phép click lên bản đồ để gán tọa độ, kéo thả pin định vị, hiển thị vòng tròn bán kính động và nút đưa góc nhìn về tâm vị trí.
2. **`BranchFormModal`**: Form thêm mới / chỉnh sửa chi nhánh, hỗ trợ nút "Lấy vị trí GPS hiện tại" từ trình duyệt, thanh trượt bán kính kèm 4 nút bấm chọn nhanh (50m, 100m, 200m, 500m).
3. **`BranchDetailModal`**: Hộp thoại xem chi tiết thông số, bản đồ xem trước (readonly mode), danh sách phòng ban và số lượng nhân sự liên kết.
4. **`GeofenceSimulatorModal` & `GeofenceSimulatorMapInner`**: Công cụ giả lập GPS với đường nét đứt (polyline) nối từ tâm chi nhánh tới vị trí thử nghiệm, thẻ kết quả đổi màu trực quan (Xanh lá / Đỏ) và báo cáo khoảng cách cụ thể.
5. **`BranchStatsCards`**: 4 thẻ thống kê trực quan (Tổng chi nhánh, Tỷ lệ vận hành, Bán kính trung bình, Tổng nhân sự liên kết).
6. **`BranchTable`**: Bảng dữ liệu chi nhánh với tìm kiếm tức thời, lọc theo trạng thái hoạt động và các nút thao tác nhanh.

---

## 6. Kiểm thử Tự động (Automated Testing)

Toàn bộ nghiệp vụ được bảo vệ bởi **27 ca kiểm thử tự động** trong file [`tests/branch-management.test.ts`](../../tests/branch-management.test.ts):
- Kiểm thử công thức toán học Haversine và bounding box.
- Kiểm thử Zod schema: Chặn vĩ độ > 90 / < -90, kinh độ > 180 / < -180, bán kính < 20m hoặc > 5000m.
- Kiểm thử phân quyền RBAC (chặn Employee và Branch Admin truy cập trái phép).
- Kiểm thử kiểm tra trùng lặp mã chi nhánh trong cùng công ty.
- Kiểm thử chặn xóa an toàn khi chi nhánh vẫn còn nhân sự liên kết.
- Kiểm thử kiểm tra Geofence thời gian thực (INSIDE vs OUTSIDE).
