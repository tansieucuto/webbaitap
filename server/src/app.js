const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const sessionMiddleware = require('./middleware/session');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 1. Cấu hình bảo mật HTTP headers (nới lỏng CSP cho Google Fonts, CDN & ảnh VietQR)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. Bật CORS
app.use(cors({
  origin: config.baseUrl,
  credentials: true
}));

// 3. Rate limiting cho API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // Tối đa 300 requests / 15p
  message: { success: false, message: 'Quá nhiều request từ IP này, vui lòng thử lại sau.' }
});
app.use('/api', limiter);

// 4. Parse body & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.session.secret));

// 5. Session middleware (quản lý giỏ hàng & đăng nhập)
app.use(sessionMiddleware);

// 6. Phục vụ tài nguyên tĩnh Frontend từ thư mục public/
app.use(express.static(path.join(__dirname, '../public')));

// 7. Mount các API router
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/products', require('./routes/product.routes'));
app.use('/api/v1/products/:slug/reviews', require('./routes/review.routes'));
app.use('/api/v1/cart', require('./routes/cart.routes'));
app.use('/api/v1/orders', require('./routes/order.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes'));

// Route kiểm tra sức khoẻ server
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Tiện ích hỗ trợ URL thân thiện không cần đuôi .html (ví dụ: /cart -> cart.html)
app.get('/:page', (req, res, next) => {
  const page = req.params.page;
  const filePath = path.join(__dirname, '../public', `${page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
});

// Xử lý 404 cho các route không tồn tại
app.use((req, res, next) => {
  const { NotFoundError } = require('./utils/errors');
  next(new NotFoundError('Không tìm thấy đường dẫn (Route không tồn tại)'));
});

// Middleware xử lý lỗi toàn cục
app.use(errorHandler);

module.exports = app;

