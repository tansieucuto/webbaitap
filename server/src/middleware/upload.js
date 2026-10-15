/**
 * MIDDLEWARE UPLOAD ẢNH — Multer
 * - Chỉ nhận ảnh JPG/PNG/WebP, tối đa 3MB
 * - Đặt tên file NGẪU NHIÊN (không dùng tên gốc → chống path traversal & đoán tên)
 * - Lưu vào public/uploads/products/ (đã nằm trong .gitignore)
 */
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { ValidationError } = require('../utils/errors');

const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_TYPES[file.mimetype] || '.jpg';
    cb(null, `product-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    cb(new ValidationError('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.'));
  }
});

// Bọc lỗi Multer thành lỗi 400 có thông báo tiếng Việt
module.exports = {
  single: (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('Ảnh vượt quá dung lượng cho phép (tối đa 3MB).'));
      }
      return next(err instanceof ValidationError ? err : new ValidationError(err.message || 'Tải ảnh thất bại.'));
    });
  }
};
