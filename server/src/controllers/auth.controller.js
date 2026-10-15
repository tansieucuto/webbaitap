const pool = require('../config/db');
const {
  ValidationError: BadRequestError,
  AuthenticationError: UnauthorizedError,
  ConflictError,
  AppError
} = require('../utils/errors');
const argon2 = require('argon2');
const crypto = require('crypto');
const { rotateSession, clearSessionCookie } = require('../middleware/session').sessionHelpers;

const MAX_LOGIN_ATTEMPTS = 5;   // số lần sai tối đa trước khi khóa
const LOCK_MINUTES = 15;        // thời gian khóa tài khoản (phút)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(0\d{9,10}|\+84\d{9,10})$/;

// ---- Tiện ích ----
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

// Hash giả để so sánh khi email không tồn tại (giảm lộ thông tin qua thời gian phản hồi)
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(crypto.randomUUID(), { type: argon2.argon2id });
  }
  return dummyHashPromise;
}

// Ghi nhật ký kiểm toán — lỗi ghi log không được làm hỏng luồng chính
async function writeAudit(req, userId, action, entityId, details) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [userId, action, entityId, details ? JSON.stringify(details) : null, req.ip || null]
    );
  } catch (_) {}
}

exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, privacy_policy } = req.body;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(full_name || '').trim();
    const cleanPhone = phone ? String(phone).trim() : null;

    if (!cleanEmail || !password || !cleanName) {
      throw new BadRequestError('Vui lòng điền đầy đủ email, mật khẩu và họ tên.');
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      throw new BadRequestError('Email không hợp lệ.');
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestError('Mật khẩu phải có tối thiểu 8 ký tự, bao gồm cả chữ và số.');
    }
    if (cleanName.length < 2 || cleanName.length > 100) {
      throw new BadRequestError('Họ tên phải từ 2 đến 100 ký tự.');
    }
    if (cleanPhone && !PHONE_RE.test(cleanPhone)) {
      throw new BadRequestError('Số điện thoại không hợp lệ (ví dụ: 0901234567).');
    }
    if (!privacy_policy) {
      throw new BadRequestError('Vui lòng đồng ý với chính sách quyền riêng tư để đăng ký.');
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      throw new ConflictError('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
    }

    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });

    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active)
       VALUES (?, ?, ?, ?, 'customer', TRUE, TRUE)`,
      [cleanEmail, hashedPassword, cleanName, cleanPhone]
    );

    const newUserId = result.insertId;

    // Xoay phiên + gắn phiên mới vào tài khoản, chuyển giỏ hàng khách sang tài khoản
    await rotateSession(req, res, newUserId);
    try {
      await pool.query(
        'UPDATE cart_items SET user_id = ?, session_id = NULL WHERE session_id = ? AND user_id IS NULL',
        [newUserId, req.sessionId]
      );
    } catch (_) { /* không chặn đăng ký nếu gộp giỏ lỗi */ }

    // Ghi nhận đồng ý chính sách quyền riêng tư (Nghị định 13/2023/NĐ-CP)
    try {
      await pool.query(
        `INSERT INTO consent_records (user_id, consent_type, granted, policy_version, ip_address)
         VALUES (?, 'privacy_policy', TRUE, '1.0', ?)`,
        [newUserId, req.ip || null]
      );
    } catch (_) {}

    await writeAudit(req, newUserId, 'register', newUserId, { email: maskEmail(cleanEmail) });

    res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: {
        user: {
          id: newUserId,
          email: cleanEmail,
          full_name: cleanName,
          phone: cleanPhone,
          role: 'customer'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Vui lòng nhập email và mật khẩu.');
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    // Email không tồn tại: vẫn verify với hash giả để thời gian phản hồi tương đương
    if (users.length === 0) {
      await argon2.verify(await getDummyHash(), String(password)).catch(() => {});
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác.');
    }

    const user = users[0];

    if (!user.is_active) {
      throw new UnauthorizedError('Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.');
    }

    // Kiểm tra khóa tạm thời do đăng nhập sai nhiều lần (chống brute-force)
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new AppError(
        `Tài khoản đang tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau khoảng ${mins} phút.`,
        429
      );
    }

    // So khớp mật khẩu (try/catch vì hash có thể lỗi định dạng — ví dụ tài khoản khách vãng lai)
    let valid = false;
    try {
      valid = await argon2.verify(user.password_hash, String(password));
    } catch (_) {
      valid = false;
    }

    if (!valid) {
      const attempts = (user.login_attempts || 0) + 1;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await pool.query(
          'UPDATE users SET login_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          [LOCK_MINUTES, user.id]
        );
        await writeAudit(req, user.id, 'account_locked', user.id, { email: maskEmail(user.email) });
        throw new AppError(
          `Sai mật khẩu quá ${MAX_LOGIN_ATTEMPTS} lần. Tài khoản bị tạm khóa ${LOCK_MINUTES} phút.`,
          429
        );
      }

      await pool.query('UPDATE users SET login_attempts = ? WHERE id = ?', [attempts, user.id]);
      await writeAudit(req, user.id, 'login_failed', user.id, { email: maskEmail(user.email), attempts });
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác.');
    }

    // Đăng nhập thành công: reset bộ đếm sai, xoay phiên, gộp giỏ hàng
    await pool.query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    await rotateSession(req, res, user.id);
    try {
      await pool.query(
        'UPDATE cart_items SET user_id = ?, session_id = NULL WHERE session_id = ? AND user_id IS NULL',
        [user.id, req.sessionId]
      );
    } catch (_) { /* không chặn đăng nhập nếu gộp giỏ lỗi */ }

    await writeAudit(req, user.id, 'login_success', user.id, { email: maskEmail(user.email) });

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          phone: user.phone,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const currentUser = req.user;

    // Xoay sang phiên ẩn danh mới: cookie cũ bị vô hiệu hoàn toàn,
    // nhưng giỏ hàng khách đang có vẫn được giữ lại.
    try {
      await rotateSession(req, res, null);
    } catch (_) {
      clearSessionCookie(res);
    }

    // Dọn cookie tên cũ (từng bị set nhầm bởi bản trước)
    res.clearCookie('session_id');

    if (currentUser) {
      await writeAudit(req, currentUser.id, 'logout', currentUser.id, { email: maskEmail(currentUser.email) });
    }

    res.json({ success: true, message: 'Đăng xuất thành công' });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    }
    res.json({ success: true, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

// ---- Các chức năng dưới đây sẽ được làm thật ở Chunk 4 (quên/đặt lại mật khẩu dev-mode) ----
exports.verifyEmail = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Xác thực email thành công' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Nếu email tồn tại, hướng dẫn khôi phục mật khẩu đã được gửi.' });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Mật khẩu đã được đặt lại thành công.' });
  } catch (error) {
    next(error);
  }
};

exports.findAccount = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) throw new BadRequestError('Vui lòng cung cấp số điện thoại.');

    const [rows] = await pool.query('SELECT full_name, email FROM users WHERE phone = ?', [String(phone).trim()]);
    if (rows.length === 0) {
      throw new BadRequestError('Không tìm thấy tài khoản với số điện thoại này.');
    }

    const u = rows[0];
    res.json({
      success: true,
      data: {
        full_name: u.full_name,
        masked_email: maskEmail(u.email)
      }
    });
  } catch (error) {
    next(error);
  }
};
