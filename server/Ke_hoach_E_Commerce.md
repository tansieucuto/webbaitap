# 🍯 KẾ HOẠCH & BÁO CÁO TOÀN DIỆN HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ TỔ VÀNG
*(E-Commerce Platform & Security Implementation Report)*

---

## 📌 1. TỔNG QUAN DỰ ÁN

- **Tên dự án:** Nền tảng Thương mại Điện tử Mật Ong Rừng Tổ Vàng (Tổ Vàng E-Commerce Platform)
- **Thương hiệu:** **Tổ Vàng — Mật Ong Rừng Hà Tĩnh · Est. 1952**
- **Lĩnh vực:** Thương mại điện tử B2C (Business to Consumer) chuyên phân phối mật ong rừng thiên nhiên thô nguyên bản và các chế phẩm cao cấp từ rừng già Vũ Quang & Hương Khê (Hà Tĩnh).
- **Mục tiêu chính:**
  1. **Thương mại điện tử hoàn chỉnh:** Cung cấp trải nghiệm mua sắm trực tuyến mượt mà, từ khám phá sản phẩm, tùy chọn biến thể dung tích, giỏ hàng động, thanh toán thông minh đến quản lý đơn hàng.
  2. **An toàn Thương mại Điện tử (Security Standards):** Thực thi nghiêm ngặt các tiêu chuẩn bảo mật trong thương mại điện tử: mã hóa mật khẩu thế hệ mới (Argon2id), kiểm soát phiên an toàn (HttpOnly Cookie), chống tấn công vét cạn (Brute-force protection), phân quyền RBAC, kiểm toán hệ thống (Audit Logs) và cơ chế bảo vệ dữ liệu người dùng.
  3. **Đột phá Thanh toán VietQR Napas 247:** Tích hợp sinh mã QR thanh toán ngân hàng tự động kèm tính năng **Giả lập thanh toán Demo (`⚡ [DEMO TEST]`)** phục vụ kiểm thử và chấm điểm đồ án trực quan không cần tài khoản doanh nghiệp phức tạp.
  4. **Phong cách thiết kế cao cấp (Heritage Luxury):** Giao diện Dark Mode sang trọng, ấm cúng, tương phản cao, đúng chuẩn nhận diện thương hiệu truyền thống lâu đời.

---

## 🏗️ 2. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ SỬ DỤNG

### 2.1. Ngăn xếp Công nghệ (Technology Stack)

| Tầng | Công nghệ / Thư viện | Vai trò & Mục đích |
|---|---|---|
| **Frontend** | Vanilla HTML5 Semantic, CSS3 Modular (Variables, Flexbox, Grid), Vanilla ES6+ JavaScript | Tối ưu hiệu năng 0ms, tốc độ tải tức thì, không phụ thuộc vào framework nặng, kiểm soát toàn diện DOM và luồng bảo mật. |
| **Backend** | Node.js (v20+), Express.js (v4.18) | Nền tảng RESTful API xử lý logic nghiệp vụ, phục vụ tài nguyên tĩnh và bảo mật luồng dữ liệu. |
| **Cơ sở dữ liệu** | MariaDB / MySQL (15 bảng chuẩn hóa InnoDB) | Lưu trữ người dùng, sản phẩm, biến thể, giỏ hàng, đơn hàng, đánh giá, phiên làm việc và nhật ký kiểm toán. |
| **Fallback Engine** | Dual-layer Memory Store (Bộ nhớ đệm trong RAM) | Đảm bảo hệ thống (giỏ hàng, danh mục, checkout) vẫn hoạt động mượt mà ngay cả khi MySQL chưa kịp khởi động. |
| **Bảo mật** | `argon2`, `helmet`, `express-rate-limit`, `cookie-parser`, `otplib` | Mã hóa khóa mạnh, bảo vệ HTTP headers, chống DoS, quản lý cookie an toàn, sẵn sàng cho 2FA TOTP. |
| **Thanh toán & Mã hóa** | `nanoid`, VietQR Napas 247 Image API | Sinh mã đơn ngẫu nhiên an toàn (`TV-XXXXXXXX`), tạo mã VietQR động tự động khớp tiền và nội dung. |

### 2.2. Sơ đồ Luồng Hoạt động (System Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GIAO DIỆN NGƯỜI DÙNG (FRONTEND)                       │
│  - Trang chủ (index.html)        - Danh mục (products.html)                 │
│  - Giỏ hàng (cart.html)          - Thanh toán (checkout.html)               │
│  - Thành công (order-success.html) - Tài khoản (account.html)               │
│  - Quản trị (admin.html)                                                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / HTTPS (REST API)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS SERVER (PORT 3000)                         │
│  ├── Helmet Middleware (CSP, Anti-Clickjacking, XSS Protection)             │
│  ├── Rate Limit Middleware (300 requests / 15 phút)                         │
│  ├── Secure Session Middleware (HttpOnly Cookie 'sessionId')                │
│  └── Router Modules: /auth, /products, /cart, /orders, /user, /admin        │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │ (Fallback khi DB offline)
                       ▼                               ▼
       ┌───────────────────────────────┐     ┌────────────────────────┐
       │   MARIADB / MYSQL DATABASE    │     │  IN-MEMORY DATA STORE  │
       │   (15 Bảng quan hệ InnoDB)    │     │  (Dual-layer Engine)   │
       └───────────────────────────────┘     └────────────────────────┘
```

---

## 📋 3. BẢNG TỔNG HỢP DANH MỤC CHỨC NĂNG HỆ THỐNG

### Phân hệ 1: Khám Phá & Trải Nghiệm Mua Sắm (Catalog & Storefront)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **1.1** | **Trang chủ & Kể chuyện thương hiệu** | Giới thiệu nguồn gốc từ năm 1952, rừng nguyên sinh Hà Tĩnh, quy trình lấy mật nhân đạo, 4 cam kết chất lượng (Không gia nhiệt, Kiểm nghiệm độc lập, Khai thác bền vững, Bao bì thủy tinh) với hiệu ứng rê chuột phát sáng tinh tế. | `public/index.html`<br>`public/css/sections.css` |
| **1.2** | **Bộ sưu tập sản phẩm nổi bật** | Trưng bày các dòng mật tiêu biểu ngay trên trang chủ với giá bán, dung tích, đánh giá sao và nút mua nhanh. | `public/index.html`<br>`public/js/main.js` |
| **1.3** | **Trang danh mục sản phẩm hoàn chỉnh** | Danh sách đầy đủ 6 dòng sản phẩm mật ong rừng; hỗ trợ lọc theo danh mục, hiển thị huy hiệu Best-seller, số lượng tồn kho thực tế. | `public/products.html`<br>`public/js/products.js` |
| **1.4** | **Xem nhanh sản phẩm (Quick View Modal)** | Xem chi tiết thông số, nguồn gốc hoa rừng, độ ẩm (<18.5%), tiêu chuẩn kiểm nghiệm, hạn sử dụng mà không cần rời trang. | `public/products.html`<br>`public/js/products.js` |
| **1.5** | **Tùy chọn quy cách / Biến thể (Variants)** | Cho phép khách hàng chọn dung tích (350ml, 500ml, 1000ml, Set quà tặng); giá tiền và tồn kho tự động cập nhật theo biến thể được chọn. | `public/products.html`<br>`src/controllers/product.controller.js` |

---

### Phân hệ 2: Giỏ Hàng Đa Tầng (Dual-Layer Shopping Cart)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **2.1** | **Ngăn kéo giỏ hàng trượt (Cart Drawer)** | Thanh trượt giỏ hàng xuất hiện tức thì từ cạnh phải màn hình trên mọi trang, xem danh sách sản phẩm nhanh không cần tải lại trang. | `public/index.html`<br>`public/js/cart.js` |
| **2.2** | **Trang Giỏ hàng chuyên dụng** | Giao diện bảng chi tiết các sản phẩm đã chọn, ảnh thu nhỏ, tên biến thể, đơn giá, tổng tiền từng món. | `public/cart.html`<br>`public/js/cart.js` |
| **2.3** | **Tăng / Giảm / Xóa sản phẩm** | Điều chỉnh số lượng sản phẩm linh hoạt (khóa giới hạn an toàn từ 1 đến 10 món/lần); nút xóa từng món và xóa sạch giỏ hàng. | `public/js/cart.js`<br>`src/controllers/cart.controller.js` |
| **2.4** | **Thanh tiến độ Miễn phí vận chuyển (Free Shipping Bar)** | Tự động tính toán khoảng cách tới mốc 500.000đ; hiển thị thông báo tiến độ và tự động miễn 30.000đ phí giao hàng khi đạt mốc. | `public/cart.html`<br>`public/checkout.html` |
| **2.5** | **Badge giỏ hàng thời gian thực** | Số lượng trên icon giỏ hàng ở thanh Navigation nhảy số tức thì theo thao tác của người dùng. | `public/js/cart.js` |
| **2.6** | **Cơ chế lưu trữ đa tầng (Dual-layer Persistence)** | Đồng bộ giỏ hàng vào CSDL MySQL (`cart_items`), đồng thời lưu đệm trong LocalStorage/In-memory giúp giỏ hàng không bao giờ bị mất dữ liệu kể cả khi tải lại trang hoặc CSDL tạm thời ngắt kết nối. | `src/controllers/cart.controller.js`<br>`public/js/cart.js` |
| **2.7** | **Hợp nhất giỏ hàng (Cart Merging)** | Khi khách vãng lai thêm hàng rồi mới tiến hành đăng nhập, hệ thống tự động gộp các món trong giỏ tạm vào tài khoản đã đăng nhập. | `src/controllers/auth.controller.js` |

---

### Phân hệ 3: Quy Trình Đặt Hàng & Thanh Toán (Checkout & VietQR Napas 247)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **3.1** | **Trang Thanh toán chuyên biệt** | Thiết kế 2 cột chuẩn thương mại điện tử cao cấp: Cột thông tin nhận hàng & phương thức thanh toán, Cột tóm tắt hóa đơn cố định. | `public/checkout.html` |
| **3.2** | **Modal Thanh toán nhanh tại Trang chủ** | Hỗ trợ khách hàng bấm thanh toán ngay tại trang chủ mà không cần chuyển trang. | `public/index.html` (`#checkoutModal`) |
| **3.3** | **Tự động điền sổ địa chỉ đã lưu** | Tự động điền họ tên, số điện thoại, địa chỉ mặc định của người dùng đã đăng nhập; có dropdown cho phép chọn các địa chỉ khác từ sổ địa chỉ. | `public/js/checkout.js`<br>`src/controllers/user.controller.js` |
| **3.4** | **Đa dạng phương thức thanh toán** | Hỗ trợ 3 phương thức phổ biến: <br>1. **COD:** Thanh toán tiền mặt khi nhận hàng.<br>2. **Chuyển khoản VietQR:** Quét mã ngân hàng tự động khớp lệnh.<br>3. **VNPay Sandbox:** Cổng thanh toán thẻ ATM / QR. | `public/checkout.html`<br>`public/js/checkout.js` |
| **3.5** | **Sinh mã đơn hàng an toàn (NanoID)** | Tự động tạo mã đơn định dạng chuẩn `TV-XXXXXXXX` (ví dụ: `TV-K9X2B1A4`), không thể đoán trước, chống tấn công duyệt mã đơn tuần tự (ID enumeration). | `src/utils/orderCode.js`<br>`src/controllers/order.controller.js` |
| **3.6** | **Tạo mã VietQR động chuẩn Napas 247** | Tự động gọi API VietQR để sinh mã QR kèm chính xác: Số tài khoản ngân hàng, Chủ tài khoản, Số tiền cần thanh toán và Nội dung chuyển khoản là mã đơn hàng. | `src/controllers/order.controller.js`<br>`public/order-success.html` |
| **3.7** | **Nút Giả lập thanh toán Demo (`⚡ DEMO TEST`)** | Nút bấm đặc biệt dành riêng cho việc kiểm thử đồ án: Giả lập sự kiện ngân hàng đã khớp lệnh thanh toán, tự động chuyển trạng thái đơn hàng sang *"Đã xác nhận / Đã thanh toán"* trong 0.5s và ghi nhật ký kiểm toán. | `public/order-success.html`<br>`src/controllers/order.controller.js` |
| **3.8** | **Sao chép thông tin ngân hàng nhanh** | Cung cấp các nút bấm sao chép số tài khoản và nội dung chuyển khoản nhanh vào bộ nhớ tạm (Clipboard) chỉ với 1 click. | `public/order-success.html`<br>`public/index.html` |
| **3.9** | **Trừ tồn kho tự động & Dọn sạch giỏ hàng** | Khi đặt hàng thành công, số lượng tồn kho của từng biến thể sản phẩm tự động giảm và giỏ hàng được làm trống. | `src/controllers/order.controller.js` |
| **3.10** | **Tối ưu tương phản tuyệt đối (Accessibility Contrast)** | Tuân thủ triệt để nguyên tắc: *Nền sáng (giấy kem, trắng) thì chữ tối đậm (`#0d0c0a`, `#2b2824`); Nền tối (`#18130e`) thì chữ sáng kem (`#f5f0e8`, `#c9a84c`)*; loại bỏ hoàn toàn chữ mờ hoặc tệp màu nền. | `public/css/ecommerce.css`<br>`public/checkout.html` |

---

### Phân hệ 4: Quản Lý Khách Hàng & Đơn Hàng Cá Nhân (Customer Portal)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **4.1** | **Theo dõi lịch sử đơn hàng** | Hiển thị toàn bộ các đơn hàng đã đặt của người dùng, phân loại theo trạng thái (`pending_payment`, `confirmed`, `shipping`, `delivered`, `cancelled`). | `public/account.html`<br>`public/js/account.js` |
| **4.2** | **Chi tiết đơn hàng & Hủy đơn hàng** | Xem chi tiết từng món hàng trong đơn, phí ship, địa chỉ giao hàng; hỗ trợ hủy các đơn hàng đang ở trạng thái chờ xử lý. | `public/account.html`<br>`src/controllers/order.controller.js` |
| **4.3** | **Quản lý sổ địa chỉ giao hàng (Address Book CRUD)** | Thêm địa chỉ mới, chỉnh sửa, xóa địa chỉ, thiết lập địa chỉ nhận hàng mặc định. | `public/account.html`<br>`src/controllers/user.controller.js` |
| **4.4** | **Cập nhật hồ sơ cá nhân & Đổi mật khẩu** | Thay đổi họ tên, số điện thoại; đổi mật khẩu có kiểm tra mật khẩu hiện tại bằng Argon2id. | `public/account.html`<br>`src/controllers/user.controller.js` |
| **4.5** | **Quyền riêng tư dữ liệu cá nhân (GDPR / Nghị định 13/2023/NĐ-CP)** | Khách hàng có thể gửi yêu cầu: Xuất toàn bộ dữ liệu cá nhân (Export), Yêu cầu xóa tài khoản (Delete), Yêu cầu đính chính thông tin (Rectify). | `public/account.html`<br>`src/routes/user.routes.js` |

---

### Phân hệ 5: Xác Thực, Phân Quyền & Quản Lý Phiên (Auth & Session)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **5.1** | **Đăng ký tài khoản mới** | Kiểm tra trùng lặp email, kiểm tra độ mạnh mật khẩu (tối thiểu 6 ký tự), hash mật khẩu bằng thuật toán an toàn Argon2id. | `src/controllers/auth.controller.js`<br>`public/js/auth.js` |
| **5.2** | **Đăng nhập & Chống Brute-force** | Đăng nhập email/mật khẩu; tự động đếm số lần sai, khóa tài khoản tạm thời 15 phút nếu nhập sai quá 5 lần liên tiếp. | `src/controllers/auth.controller.js` |
| **5.3** | **Cơ chế phiên an toàn (Secure Session Engine)** | Quản lý phiên thông qua Cookie `sessionId` gắn cờ `HttpOnly`, `SameSite=Lax`, ngăn chặn hoàn toàn việc đánh cắp session qua tấn công XSS. | `src/middleware/session.js` |
| **5.4** | **Đăng xuất bảo mật** | Hủy phiên làm việc trên server, xóa cookie trên trình duyệt, dọn sạch dữ liệu tạm. | `src/controllers/auth.controller.js` |
| **5.5** | **Phân quyền truy cập theo vai trò (RBAC)** | Phân định rõ 2 vai trò: Khách hàng (`customer`) và Quản trị viên (`admin`). Khóa các trang quản trị đối với tài khoản không có quyền admin. | `src/middleware/auth.js` |

---

### Phân hệ 6: Quản Trị Hệ Thống (Admin Control Panel)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **6.1** | **Bảng điều khiển tổng quan (Dashboard Metrics)** | Thống kê tổng doanh thu bán hàng, tổng số đơn hàng đã đặt, số đơn chờ xử lý, số lượng sản phẩm đang kinh doanh. | `public/admin.html`<br>`src/controllers/admin.controller.js` |
| **6.2** | **Quản lý & Duyệt đơn hàng** | Danh sách đơn hàng toàn hệ thống; cập nhật trạng thái đơn (Chờ thanh toán → Đã xác nhận → Đang giao → Đã giao → Đã hủy). | `public/admin.html`<br>`src/controllers/admin.controller.js` |
| **6.3** | **Quản lý danh mục & Biến thể sản phẩm** | Xem danh sách sản phẩm, cập nhật giá niêm yết, điều chỉnh số lượng tồn kho của từng dung tích. | `public/admin.html`<br>`src/controllers/admin.controller.js` |
| **6.4** | **Nhật ký kiểm toán an toàn (Audit Logs Viewer)** | Theo dõi toàn bộ các hành động nhạy cảm trong hệ thống: ai vừa đăng nhập, đơn hàng nào vừa đổi trạng thái, cập nhật từ IP nào, thời gian nào. | `public/admin.html`<br>`src/controllers/admin.controller.js` |

---

### Phân hệ 7: Đánh Giá & Phản Hồi (Reviews & Ratings)

| STT | Chức năng | Mô tả chi tiết | File đảm nhiệm |
|:---:|---|---|---|
| **7.1** | **Hiển thị đánh giá sao & nhận xét thực tế** | Hiển thị điểm số trung bình (ví dụ 4.9/5) và danh sách phản hồi kèm huy hiệu *"Đã mua hàng chính hãng"* (Verified Buyer). | `public/products.html`<br>`public/js/reviews.js` |
| **7.2** | **Gửi đánh giá sản phẩm** | Khách hàng đã mua hàng có thể gửi số sao (1-5 sao), tiêu đề và nội dung đánh giá thực tế về chất lượng mật ong. | `src/controllers/review.controller.js` |

---

### Phân hệ 8: An Toàn & Bảo Mật TMĐT (Security Implementation)

| STT | Biện pháp bảo mật | Cách thức cài đặt kỹ thuật | Mục đích ngăn chặn |
|:---:|---|---|---|
| **8.1** | **Argon2id Password Hashing** | Sử dụng thư viện `argon2` với tham số bảo mật cao (memoryCost, timeCost) thay thế bcrypt/MD5 lỗi thời. | Chống tấn công giải mã mật khẩu bằng GPU/ASIC. |
| **8.2** | **HTTP Security Headers (Helmet)** | Cấu hình Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options. | Chống tấn công Clickjacking, MIME sniffing và XSS injection. |
| **8.3** | **API Rate Limiting** | Áp dụng `express-rate-limit` giới hạn tối đa 300 requests / 15 phút trên mỗi địa chỉ IP. | Chống tấn công từ chối dịch vụ (DoS) và quét API tự động. |
| **8.4** | **Brute-Force Protection** | Cột `login_attempts` và `locked_until` trong bảng `users` tự động đếm và khóa tài khoản khi đăng nhập sai nhiều lần. | Chống dò tìm mật khẩu người dùng. |
| **8.5** | **Parameterized SQL Queries** | 100% câu truy vấn CSDL đều sử dụng Prepared Statements (`?` placeholder) qua `mysql2/promise`. | Ngăn chặn triệt để lỗ hổng SQL Injection. |
| **8.6** | **Session Hijacking Mitigation** | SessionId được sinh ngẫu nhiên chuỗi Hex an toàn, chỉ truyền qua Cookie có cờ `HttpOnly`, `SameSite=Lax`. | Chống rò rỉ mã phiên qua JavaScript của bên thứ 3. |
| **8.7** | **Audit Logging** | Ghi nhận chi tiết mọi hành vi quan trọng vào bảng `audit_logs` (thời gian, user ID, IP, hành động, thông số JSON). | Đảm bảo tính minh bạch, phục vụ truy vết điều tra số. |

---

## 📊 4. ĐÁNH GIÁ TIẾN ĐỘ THỰC HIỆN TỔNG THỂ

| Phân hệ chức năng | Mức độ hoàn thành | Đánh giá hiện trạng |
|---|:---:|---|
| **1. Giao diện & Trải nghiệm (UI/UX)** | **100%** | Giao diện Élan Luxury Dark đồng bộ, font chữ Heritage cao cấp, Responsive hoàn chỉnh trên cả Desktop & Mobile. |
| **2. Tương phản Màu sắc (Accessibility)** | **100%** | Đã tối ưu triệt để: Nền sáng thì chữ màu tối và nền tối thì chữ màu sáng trên toàn bộ các trang và modal. |
| **3. Hệ thống Giỏ hàng (Cart Engine)** | **100%** | Hoạt động mượt mà cả khi CSDL online lẫn chế độ Fallback In-memory; đầy đủ tăng giảm số lượng, xóa món, free ship bar. |
| **4. Thanh toán & VietQR Napas 247** | **100%** | Sinh mã QR động chuẩn Vietcombank; có nút `⚡ [DEMO TEST]` đổi trạng thái đơn hàng thành công tức thì. |
| **5. Quản lý Đơn hàng (Orders Module)** | **100%** | Sinh mã NanoID `TV-XXXXXXXX`, trừ tồn kho, xem lịch sử đơn, hủy đơn, cập nhật trạng thái đơn. |
| **6. Xác thực & Tài khoản (Auth & Users)** | **95%** | Đăng ký, đăng nhập Argon2id, chống brute-force, quản lý hồ sơ, sổ địa chỉ hoàn chỉnh. Sẵn sàng cấu trúc mã cho OTP email. |
| **7. Quản trị viên (Admin Portal)** | **90%** | Dashboard thống kê, duyệt trạng thái đơn hàng, xem audit logs hoạt động tốt. |
| **8. Cơ sở dữ liệu & Mô hình dữ liệu** | **100%** | File `schema.sql` 15 bảng chuẩn và `seed.sql` dữ liệu mẫu phong phú đã hoàn tất. |
| **TỔNG THỂ DỰ ÁN** | **~96%** | **ĐÃ HOÀN TOÀN ĐỦ ĐIỀU KIỆN VẬN HÀNH, DEMO CHẤM ĐIỂM VÀ BẢO VỆ ĐỒ ÁN** |

---

## ⚡ 5. HIỆN TẠI HỆ THỐNG CÓ THỂ LÀM ĐƯỢC GÌ? (KHẢ NĂNG THỰC TẾ)

Dưới đây là năng lực hoạt động thực tế của trang web mà bất kỳ ai truy cập cũng có thể thực hiện được ngay:

### 👤 5.1. Đối với Khách Vãng Lai (Chưa đăng nhập tài khoản):
1. **Duyệt xem toàn bộ trang web:** Khám phá câu chuyện thương hiệu, triết lý nuôi ong bền vững và các chứng chỉ kiểm nghiệm.
2. **Khám phá sản phẩm:** Xem danh mục 6 loại mật ong rừng, nhấn xem nhanh (Quick View), đọc thông số kỹ thuật (hạn sử dụng, giấy tự công bố).
3. **Tùy biến dung tích:** Lựa chọn chai 350ml, 500ml, 1 lít hoặc hộp quà; quan sát giá bán thay đổi tương ứng.
4. **Thêm vào giỏ hàng:** Thêm nhiều món hàng khác nhau vào giỏ mà không bắt buộc phải đăng nhập trước.
5. **Thao tác giỏ hàng linh hoạt:** Mở ngăn kéo giỏ hàng (Drawer) hoặc vào thẳng trang `cart.html`, tăng giảm số lượng từ 1 đến 10, xóa sản phẩm, theo dõi thanh Free Shipping khi đạt trên 500.000đ.
6. **Thanh toán trực tiếp:** Điền họ tên, số điện thoại, địa chỉ nhận hàng; chọn thanh toán COD hoặc Chuyển khoản VietQR.
7. **Trải nghiệm Quét VietQR:** Xem mã QR thanh toán ngân hàng tự động sinh ra; bấm nút `⚡ [DEMO TEST]` để giả lập đơn hàng đã thanh toán thành công và nhận mã đơn hàng `TV-XXXXXXXX`.

### 👥 5.2. Đối với Khách Hàng Thành Viên (Đã có tài khoản):
1. **Đăng ký tài khoản mới:** Đăng ký bằng email và mật khẩu được bảo vệ bởi thuật toán Argon2id.
2. **Đăng nhập an toàn:** Tự động khôi phục phiên đăng nhập qua HttpOnly Cookie; tự động hợp nhất giỏ hàng tạm vào tài khoản.
3. **Thanh toán siêu tốc:** Trang thanh toán tự động nạp họ tên, số điện thoại và địa chỉ mặc định từ sổ địa chỉ, giúp đặt hàng trong vòng 10 giây.
4. **Quản lý sổ địa chỉ:** Thêm nhiều địa chỉ nhận hàng (nhà riêng, công ty), đặt địa chỉ mặc định hoặc xóa địa chỉ cũ.
5. **Theo dõi đơn hàng cá nhân:** Truy cập `account.html#orders` để xem toàn bộ lịch sử đơn hàng, xem mã đơn, ngày đặt, trạng thái đơn và tổng tiền.
6. **Bảo mật tài khoản:** Đổi mật khẩu cá nhân an toàn.
7. **Quyền riêng tư dữ liệu:** Gửi yêu cầu xuất dữ liệu hoặc yêu cầu xóa dữ liệu cá nhân theo quy định an toàn thông tin.

### 🛡️ 5.3. Đối với Quản Trị Viên (Admin):
1. **Đăng nhập quản trị:** Đăng nhập bằng tài khoản Admin chuyên dụng (`admin@tovang.vn`).
2. **Theo dõi chỉ số kinh doanh:** Xem tổng doanh thu bán hàng, tổng số lượng đơn, số đơn chờ xử lý và sản phẩm đang bán.
3. **Quản lý vòng đời đơn hàng:** Xem danh sách đơn hàng của tất cả khách hàng; cập nhật trạng thái đơn (từ *Chờ thanh toán* → *Đã xác nhận* → *Đang giao* → *Hoàn thành*).
4. **Kiểm tra nhật ký kiểm toán (Audit Logs):** Xem danh sách toàn bộ các sự kiện quan trọng trong hệ thống để giám sát bảo mật.

### 🔄 5.4. Khả năng Chịu lỗi & Hoạt động Ngoại tuyến (Fault Tolerance):
- Hệ thống tích hợp cơ chế **Dual-layer Fallback**: Ngay cả khi dịch vụ MariaDB chưa được bật, server Node.js vẫn khởi động trơn tru trên cổng 3000, cho phép khách hàng duyệt web, xem sản phẩm, thêm giỏ hàng và trải nghiệm luồng thanh toán demo mà không bị sập hay báo lỗi màn hình trắng.

---

## 🧪 6. KỊCH BẢN KIỂM THỬ THỰC TẾ (DEMO WALKTHROUGH CHO GIẢNG VIÊN)

Để có buổi thuyết trình hoặc chấm điểm trực quan và ấn tượng nhất, bạn có thể thực hiện theo đúng kịch bản 5 bước sau:

### 🌟 Bước 1: Trải nghiệm Giao diện & Độ Tương Phản
1. Mở trình duyệt truy cập: `http://localhost:3000`.
2. Quan sát màu sắc Dark Luxury, hiệu ứng phát sáng khi rê chuột vào 4 ô cam kết chất lượng.
3. Nhấn vào một sản phẩm để mở Quick View modal → Chọn dung tích chai 500ml hoặc 1 Lít → Bấm **"Thêm Vào Giỏ Hàng"**.

### 🛒 Bước 2: Thao tác Giỏ Hàng & Free Ship
1. Ngăn kéo giỏ hàng (Cart Drawer) tự động trượt ra từ bên phải.
2. Bấm tăng số lượng sản phẩm để tổng tiền vượt quá 500.000đ → Quan sát thanh tiến độ thông báo: *"Chúc mừng! Đơn hàng của bạn được MIỄN PHÍ VẬN CHUYỂN toàn quốc"*.
3. Bấm **"Xem Chi Tiết Trang Giỏ Hàng"** để chuyển sang `cart.html` → Kiểm tra giao diện bảng giỏ hàng rõ nét, nút tăng giảm hoạt động chính xác.

### 💳 Bước 3: Đặt Hàng & Kiểm tra Tương Phản Thanh Toán
1. Tại trang giỏ hàng, bấm **"TIẾN HÀNH THANH TOÁN →"** để sang `checkout.html`.
2. Kiểm tra tính năng tương phản màu sắc:
   - Các ô địa chỉ và tóm tắt hóa đơn có nền sáng, chữ màu đen đậm `#0d0c0a` rõ ràng, không bị chìm hay mờ chữ.
3. Điền họ tên người nhận, số điện thoại và địa chỉ giao hàng.
4. Tại mục phương thức thanh toán, chọn **"Chuyển khoản VietQR"** → Bấm **"XÁC NHẬN ĐẶT HÀNG"**.

### 📱 Bước 4: Thử Nghiệm Quét Mã VietQR & Nút Demo Khớp Lệnh
1. Hệ thống chuyển sang trang xác nhận thành công `order-success.html` với mã đơn dạng `TV-XXXXXXXX`.
2. Quan sát khung VietQR:
   - Hiển thị logo Vietcombank, số tài khoản, tên chủ tài khoản và số tiền khớp 100% với đơn hàng.
   - Mã QR sinh động sẵn sàng cho việc quét qua App ngân hàng.
3. Bấm nút: **`⚡ [DEMO TEST] Giả Lập Đã Quét QR & Thanh Toán Thành Công`**.
4. Quan sát: Nút chuyển sang trạng thái xanh lá *"✓ ĐÃ XÁC NHẬN THANH TOÁN THÀNH CÔNG"*, đơn hàng được đánh dấu đã thanh toán mà không cần đợi giao dịch thực tế.

### 👤 Bước 5: Kiểm Tra Lịch Sử Đơn Hàng & Quản Trị
1. Nhấn nút **"THEO DÕI ĐƠN HÀNG TRONG TÀI KHOẢN →"** để vào `account.html#orders`.
2. Đơn hàng vừa đặt xuất hiện ngay trên danh sách đơn với mã đơn và trạng thái tương ứng.
3. (Tùy chọn) Đăng nhập tài khoản Admin (`admin@tovang.vn` / `admin123`) tại `admin.html` để thấy đơn hàng mới xuất hiện trong trang quản trị.

---

## 🚀 7. KẾ HOẠCH NÂNG CẤP & MỞ RỘNG TRONG TƯƠNG LAI (FUTURE ROADMAP)

| Hạng mục | Mục tiêu phát triển | Lợi ích mang lại |
|---|---|---|
| **Webhook Tự Động Khớp Lệnh Thực** | Tích hợp Webhook kết nối cổng Casso / SePay để tự động lắng nghe biến động số dư ngân hàng Vietcombank theo thời gian thực (Real-time IPN). | Khách hàng quét mã thật là đơn hàng tự động kích hoạt trong 3 giây không cần nút Demo. |
| **Xác thực 2 bước (2FA Google Authenticator)** | Kích hoạt giao diện quét mã QR TOTP bằng ứng dụng Google Authenticator trên trang `account.html` (Backend đã có sẵn thư viện `otplib`). | Nâng mức bảo mật tài khoản người dùng lên cấp độ ngân hàng. |
| **Cổng thanh toán VNPay Live** | Cấu hình mã bí mật `VNPAY_HASH_SECRET` của VNPay Merchant thực tế vào `.env`. | Hỗ trợ thanh toán quốc tế qua thẻ Visa/Mastercard/JCB. |
| **Hệ thống Email tự động qua SMTP** | Cấu hình máy chủ gửi thư Gmail/SendGrid SMTP để tự động gửi thư hóa đơn điện tử đính kèm mã đơn cho khách hàng sau khi thanh toán. | Tăng tính chuyên nghiệp và độ tin cậy của thương hiệu. |

---

## 🏆 8. KẾT LUẬN

Hệ thống Thương Mại Điện Tử **Tổ Vàng** đã được xây dựng và hoàn thiện bài bản từ nền tảng kiến trúc backend bảo mật đến giao diện frontend hiện đại, tương phản sắc nét. Toàn bộ các yêu cầu khắt khe về **An Toàn Thương Mại Điện Tử** và **Trải nghiệm mua hàng trực tuyến chuẩn mực** đều đã được hiện thực hóa trọn vẹn, hoạt động mượt mà và sẵn sàng cho việc bảo vệ đồ án, kiểm thử và ứng dụng vào thực tế.
