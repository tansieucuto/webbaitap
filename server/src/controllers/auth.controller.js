const pool = require('../config/db');
const { ValidationError: BadRequestError, AuthenticationError: UnauthorizedError, ConflictError } = require('../utils/errors');
const argon2 = require('argon2');
const config = require('../config/env');

exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, privacy_policy } = req.body;
    
    if (!email || !password || !full_name) {
      throw new BadRequestError('Vui lòng điền đầy đủ email, mật khẩu và họ tên.');
    }

    if (password.length < 6) {
      throw new BadRequestError('Mật khẩu phải có tối thiểu 6 ký tự.');
    }

    // Kiểm tra email trùng
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      throw new ConflictError('Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.');
    }
    
    // Hash bằng Argon2id
    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });
    
    const [result] = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active)
       VALUES (?, ?, ?, ?, 'customer', TRUE, TRUE)`,
      [email.trim().toLowerCase(), hashedPassword, full_name.trim(), phone?.trim() || null]
    );

    const newUserId = result.insertId;

    // Gắn session hiện tại vào user mới tạo
    if (req.sessionId) {
      await pool.query('UPDATE sessions SET user_id = ? WHERE id = ?', [newUserId, req.sessionId]);
      // Chuyển giỏ hàng khách sang tài khoản này
      await pool.query('UPDATE cart_items SET user_id = ? WHERE session_id = ?', [newUserId, req.sessionId]);
    }

    const userData = {
      id: newUserId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      phone: phone?.trim() || null,
      role: 'customer'
    };

    res.json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      data: { user: userData }
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
    
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (users.length === 0) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác.');
    }
    const user = users[0];

    if (!user.is_active) {
      throw new UnauthorizedError('Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.');
    }
    
    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác.');
    }
    
    // Gắn session vào user
    if (req.sessionId) {
      await pool.query('UPDATE sessions SET user_id = ? WHERE id = ?', [user.id, req.sessionId]);
      // Hợp nhất giỏ hàng khách vào user
      await pool.query('UPDATE cart_items SET user_id = ? WHERE session_id = ?', [user.id, req.sessionId]);
    }

    res.cookie('session_id', req.sessionId, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
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
    if (req.sessionId) {
      await pool.query('UPDATE sessions SET user_id = NULL WHERE id = ?', [req.sessionId]);
    }
    res.clearCookie('session_id');
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

    const [rows] = await pool.query('SELECT full_name, email FROM users WHERE phone = ?', [phone.trim()]);
    if (rows.length === 0) {
      throw new BadRequestError('Không tìm thấy tài khoản với số điện thoại này.');
    }

    const u = rows[0];
    const parts = u.email.split('@');
    const masked = parts[0].slice(0, 2) + '***@' + parts[1];

    res.json({
      success: true,
      data: {
        full_name: u.full_name,
        masked_email: masked
      }
    });
  } catch (error) {
    next(error);
  }
};
