# 🌿 BÁO CÁO ĐÁNH GIÁ & MÔ TẢ TRANG WEB THƯƠNG MẠI ĐIỆN TỬ TỔ VÀNG

---

## 1. TỔNG QUAN DỰ ÁN

- **Tên thương hiệu:** Tổ Vàng — Mật Ong Rừng Hà Tĩnh · Est. 1952
- **Lĩnh vực hoạt động:** Thương mại điện tử (B2C E-commerce) chuyên phân phối mật ong rừng tự nhiên và các chế phẩm từ ong khai thác bền vững từ đại ngàn Vũ Quang & Hương Khê (Hà Tĩnh).
- **Mục tiêu hệ thống:** 
  - Xây dựng một nền tảng bán hàng trực tuyến hoàn chỉnh, chuyên nghiệp với trải nghiệm người dùng cao cấp (Heritage Luxury UI).
  - Đảm bảo các tiêu chuẩn bảo mật khắt khe của môn học **An Toàn Thương Mại Điện Tử**: mã hóa mật khẩu thế hệ mới, chống giả mạo phiên, chống brute-force, quản lý quyền hạn nghiêm ngặt, nhật ký kiểm toán (Audit Logs) và bảo vệ dữ liệu người dùng.
  - Tích hợp thanh toán trực tuyến tiện lợi với phương thức **Quét mã VietQR động** (kèm chế độ giả lập thanh toán Demo).

---

## 2. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT (FRONTEND)                     │
│  - Vanilla HTML5 Semantic, CSS3 Custom Properties (BEM-like)│
│  - Modular Vanilla ES6 JavaScript (No heavyweight frameworks)│
│  - Responsive Desktop, Tablet & Mobile                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / HTTPS (REST API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       EXPRESS SERVER                        │
│  - Express.js (Node.js runtime)                             │
│  - Helmet (HTTP Security Headers)                           │
│  - Express Rate Limit (Chống DoS / Brute-force)             │
│  - Database-backed Session Middleware (Cookie HttpOnly)     │
│  - RESTful APIs v1: Auth, Products, Cart, Orders, Admin     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Connection Pool (mysql2/promise)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    MARIADB / MYSQL DATABASE                 │
│  - 15 bảng chuẩn hóa (Users, Products, Variants, Cart,      │
│    Orders, Order Items, Reviews, Sessions, Audit Logs, ...) │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. ĐÁNH GIÁ CHI TIẾT GIAO DIỆN & TRẢI NGHIỆM FRONTEND

### 3.1. Phong Cách Thiết Kế (Design Language)
- **Định vị:** Sang trọng, mộc mạc cổ điển (Heritage Luxury), phản ánh nguồn gốc lâu đời từ năm 1952.
- **Bảng màu:**
  - `Vàng Mật (Gold #d4a373)`: Biểu trưng cho sự tinh khiết và giá trị của mật ong rừng.
  - `Đỏ Đất / Hổ Phách (Rust #99582a)`: Điểm nhấn hành động (Call To Action, giá tiền, badge).
  - `Nền Giấy Kem (Paper/Cream #fbf8f3 / #f4ede2)`: Mang lại cảm giác ấm cúng, tự nhiên.
  - `Mực Đậm (Ink #1c1917)`: Đảm bảo độ tương phản cao, dễ đọc.
- **Typography:**
  - Tiêu đề: `Playfair Display` & `Cinzel` mang nét trang trọng, thủ công.
  - Số liệu, giá tiền, mã đơn: `Space Mono` & `DM Mono` tạo sự chính xác, minh bạch.
  - Nội dung: `Plus Jakarta Sans` hiện đại, rõ ràng.

### 3.2. Cấu Trúc Các Trang & Chức Năng Chính

| Trang | Tên File | Vai Trò & Tính Năng Nổi Bật |
|-------|----------|-----------------------------|
| **Trang Chủ** | `index.html` | Giới thiệu câu chuyện thương hiệu, nguồn gốc thu hoạch từ rừng nguyên sinh Hà Tĩnh, triết lý khai thác nhân đạo, trưng bày sản phẩm nổi bật, đánh giá thực tế và popup đăng nhập/giỏ hàng. |
| **Cửa Hàng** | `products.html` | Danh mục toàn bộ sản phẩm mật ong, hỗ trợ xem nhanh (Quick View modal), xem chi tiết thông số kỹ thuật (hạn sử dụng, giấy tự công bố, xuất xứ), chọn dung tích (500ml, 1 lít,...) và thêm vào giỏ. |
| **Giỏ Hàng** | `cart.html` | Trang giỏ hàng chuyên dụng kết hợp cùng **Cart Drawer** (ngăn kéo trượt) trên mọi trang. Hiển thị danh sách sản phẩm, tăng/giảm số lượng (tối đa 10), xóa sản phẩm, và **thanh tiến độ Miễn phí vận chuyển (Free Ship từ 500.000đ)**. |
| **Thanh Toán** | `checkout.html` | Quy trình đặt hàng tiện lợi: điền thông tin người nhận, chọn nhanh từ sổ địa chỉ đã lưu, tính toán tự động phí ship, chọn phương thức thanh toán (COD, VietQR, VNPay Sandbox). |
| **Xác Nhận Đơn** | `order-success.html` | Hiển thị mã đơn `TV-XXXXXXXX`, tóm tắt đơn hàng và **Mã VietQR động** kèm nút **Giả lập quét thanh toán thành công (Demo Test)**. |
| **Tài Khoản** | `account.html` | Quản lý thông tin cá nhân, đổi mật khẩu, quản lý sổ địa chỉ giao hàng và theo dõi lịch sử các đơn hàng đã đặt cùng trạng thái chi tiết. |
| **Quản Trị** | `admin.html` | Bảng điều khiển quản trị viên: thống kê doanh thu, duyệt và cập nhật trạng thái đơn hàng (Chờ thanh toán → Đã xác nhận → Đang giao → Hoàn thành), xem nhật ký kiểm toán (Audit Logs). |

---

## 4. CÁC TÍNH NĂNG MỚI ĐÃ HOÀN THIỆN THEO YÊU CẦU

### 4.1. Chức Năng Quét Thanh Toán QR (Bản Demo Chạy Thử)
- **Tạo mã VietQR động chuẩn Napas 247:**
  - Khi khách chọn phương thức *"Chuyển khoản VietQR"*, hệ thống backend tự động sinh thông tin thanh toán gồm:
    - **Ngân hàng:** Vietcombank (VCB)
    - **Số tài khoản:** `123456789`
    - **Chủ tài khoản:** `TO VANG VIET NAM`
    - **Số tiền:** Khớp chính xác 100% với tổng giá trị đơn hàng
    - **Nội dung chuyển khoản:** Mã đơn hàng duy nhất (ví dụ: `TV-K9X2B1A4`)
    - **Mã QR hình ảnh:** Tạo trực tiếp từ API Napas VietQR (`https://img.vietqr.io/image/...`) hiển thị rõ ràng trên màn hình.
- **Nút Giả Lập Thanh Toán Demo (`⚡ [DEMO TEST]`):**
  - Đặt tại cả trang `order-success.html` và modal xác nhận đơn hàng.
  - Khi bấm nút, hệ thống gửi yêu cầu đến endpoint `POST /api/v1/orders/:orderCode/demo-pay`.
  - Backend cập nhật ngay trạng thái đơn hàng từ `pending_payment` sang `confirmed` (Đã thanh toán), lưu thời gian `paid_at`, ghi nhật ký kiểm toán `audit_logs` và hiển thị tick xanh chúc mừng trên màn hình mà không cần giao dịch ngân hàng thực tế.

### 4.2. Hệ Thống Giỏ Hàng Chuẩn E-Commerce Thực Thụ
- **Lưu trữ bền vững (Database Persistence):**
  - Dữ liệu giỏ hàng được lưu trực tiếp vào bảng `cart_items` trong MySQL.
  - Hỗ trợ cả **khách vãng lai (Guest session)** thông qua Cookie phiên và **khách đã đăng nhập (User ID)**.
  - Tự động hợp nhất giỏ hàng (Merge Cart) khi khách vãng lai đăng nhập tài khoản.
- **Tính năng đầy đủ:**
  - Chọn biến thể sản phẩm (Variant: 350ml, 500ml, 1 lít, hộp quà) trước khi thêm.
  - Tăng / giảm số lượng sản phẩm (giới hạn an toàn từ 1 đến 10 sản phẩm/mục).
  - Xóa sản phẩm khỏi giỏ hàng.
  - Thanh tiến độ Free Shipping: Tự động miễn phí 30.000đ tiền ship khi giỏ hàng đạt từ 500.000đ trở lên.
  - Badge số lượng trên Header cập nhật theo thời gian thực mỗi khi có thao tác trong giỏ.
  - Tự động làm trống giỏ hàng sau khi đơn hàng được đặt thành công.

### 4.3. Các Chức Năng E-Commerce Khác
- **Danh mục sản phẩm phong phú:**
  - Bổ sung 6 dòng sản phẩm mật ong rừng đa dạng: *Mật ong rừng Hà Tĩnh nguyên bản, Mật ong rừng già đại ngàn, Mật ong hoa dại tự nhiên, Mật ong hoa cam quýt hữu cơ, Mật ong kem nhung thượng hạng, Hộp quà biếu Tết mật ong rừng quý*.
  - Đầy đủ thông tin nguồn gốc, thành phần, hạn sử dụng, số tự công bố chất lượng và cảnh báo an toàn.
- **Quản lý đơn hàng & tồn kho:**
  - Khi đặt hàng, số lượng tồn kho (`stock`) trong bảng `product_variants` tự động được khấu trừ tương ứng.
  - Tạo mã đơn ngẫu nhiên an toàn chuẩn `TV-XXXXXXXX` sử dụng NanoID.
  - Quản lý quy trình trạng thái đơn hàng: `pending_payment` -> `pending_confirmation` -> `confirmed` -> `shipping` -> `delivered` -> `cancelled`.
- **Bảo mật & Phiên làm việc:**
  - Hash mật khẩu bằng thuật toán **Argon2id** (khuyên dùng bởi OWASP).
  - Quản lý phiên qua cookie `httpOnly`, chống tấn công XSS chiếm quyền phiên.
  - Khởi chạy phục vụ giao diện tĩnh trực tiếp trên cổng 3000 (`http://localhost:3000`).

---

## 5. HƯỚNG DẪN CHẠY THỬ VÀ KIỂM THỬ LOCAL

### Bước 1: Khởi động dịch vụ MariaDB
Mở Terminal trên máy và chạy lệnh:
```bash
sudo systemctl start mariadb
```

### Bước 2: Nạp CSDL và Dữ Liệu Mẫu (Chỉ cần chạy 1 lần nếu CSDL chưa nạp)
```bash
mariadb -u root -pro < database/schema.sql
mariadb -u root -pro < database/seed.sql
```

### Bước 3: Khởi động Server
```bash
cd /home/lordkernel/AnToanThuongMai/server
npm run dev
# hoặc
npm start
```
Server sẽ chạy tại: **http://localhost:3000**

### Bước 4: Danh Sách Tài Khoản Kiểm Thử Có Sẵn
| Vai Trò | Email Đăng Nhập | Mật Khẩu |
|---------|-----------------|----------|
| **Quản trị viên (Admin)** | `admin@tovang.vn` | `admin123` |
| **Khách hàng mẫu (Customer)** | `khachhang@tovang.vn` | `123456` |

---

## 6. KỊCH BẢN THỬ NGHIỆM GỢI Ý CHO GIẢNG VIÊN / KIỂM THỬ VIÊN

1. **Khám phá sản phẩm:** Truy cập `http://localhost:3000`, kéo xem câu chuyện thương hiệu và danh sách mật ong rừng.
2. **Xem chi tiết & Thêm giỏ:** Nhấn vào sản phẩm bất kỳ, chọn dung tích (500ml hoặc 1 lít), nhấn *"Thêm Vào Giỏ Hàng"*.
3. **Thao tác giỏ hàng:** Mở giỏ hàng, tăng số lượng để tổng tiền vượt 500.000đ để quan sát thanh Free Shipping chuyển sang màu xanh lá *"Đủ điều kiện Miễn phí giao hàng"*.
4. **Tiến hành Đặt Hàng:** Bấm *"Tiến Hành Đặt Hàng"*, chọn phương thức *"Chuyển khoản VietQR"*, điền thông tin người nhận và bấm *"Xác Nhận Đặt Hàng"*.
5. **Thử nghiệm Quét mã VietQR:**
   - Quan sát mã QR ngân hàng Vietcombank hiển thị với số tiền và mã đơn hàng chính xác.
   - Thử nghiệm chức năng quét thực tế bằng App ngân hàng (nếu muốn) hoặc bấm ngay nút:
     **`⚡ [DEMO TEST] Giả Lập Đã Quét QR & Thanh Toán Thành Công`**.
   - Quan sát giao diện cập nhật ngay lập tức sang trạng thái *"✓ Đã Thanh Toán Thành Công Qua VietQR"*.
6. **Xem Đơn hàng đã mua:** Vào mục *"Tài Khoản"* hoặc `account.html#orders` để thấy đơn hàng vừa đặt xuất hiện trong lịch sử đơn hàng.
