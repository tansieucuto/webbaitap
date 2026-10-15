const pool = require('../config/db');
const argon2 = require('argon2');
const {
  ValidationError: BadRequestError,
  AuthenticationError: UnauthorizedError,
  NotFoundError
} = require('../utils/errors');

// Ghi nhật ký kiểm toán — lỗi ghi log không làm hỏng luồng chính
async function writeAudit(req, action, entityId, details) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, 'user', ?, ?, ?)`,
      [req.user?.id || null, action, entityId, details ? JSON.stringify(details) : null, req.ip || null]
    );
  } catch (_) {}
}

exports.getProfile = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, full_name, phone, role, email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) throw new NotFoundError('Không tìm thấy tài khoản.');
    res.json({ success: true, data: rows[0] });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    // TODO: làm thật ở phần "hồ sơ + sổ địa chỉ"
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) { next(error); }
};

// ===== ĐỔI MẬT KHẨU (đã làm thật) =====
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw new BadRequestError('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
    }
    if (new_password.length < 8 || !/[A-Za-z]/.test(new_password) || !/\d/.test(new_password)) {
      throw new BadRequestError('Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm cả chữ và số.');
    }
    if (new_password === current_password) {
      throw new BadRequestError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) throw new NotFoundError('Không tìm thấy tài khoản.');

    // Bước 1: xác thực mật khẩu HIỆN TẠI bằng Argon2id (chống chiếm phiên đổi mật khẩu)
    let valid = false;
    try {
      valid = await argon2.verify(rows[0].password_hash, String(current_password));
    } catch (_) { valid = false; }

    if (!valid) {
      await writeAudit(req, 'change_password_failed', req.user.id, { reason: 'wrong_current_password' });
      throw new UnauthorizedError('Mật khẩu hiện tại không chính xác.');
    }

    // Bước 2: hash mật khẩu mới + cập nhật
    const newHash = await argon2.hash(new_password, { type: argon2.argon2id });
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    // Bước 3: bảo mật — đổi mật khẩu xong thì đăng xuất MỌI thiết bị khác (giữ phiên hiện tại).
    // Nếu tài khoản bị lộ, kẻ tấn công đang đăng nhập ở máy khác sẽ bị đá ra ngay.
    const [killResult] = await pool.query(
      'DELETE FROM sessions WHERE user_id = ? AND id != ?',
      [req.user.id, req.sessionId]
    );

    await writeAudit(req, 'change_password', req.user.id, { other_sessions_killed: killResult.affectedRows });

    res.json({
      success: true,
      message: killResult.affectedRows > 0
        ? `Đổi mật khẩu thành công. Đã đăng xuất ${killResult.affectedRows} thiết bị khác.`
        : 'Đổi mật khẩu thành công.'
    });
  } catch (error) { next(error); }
};

// ---- Sổ địa chỉ: làm thật ở phần sau ----
exports.listAddresses = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) { next(error); }
};

exports.addAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Thêm địa chỉ thành công' });
  } catch (error) { next(error); }
};

exports.updateAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Cập nhật địa chỉ thành công' });
  } catch (error) { next(error); }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Xóa địa chỉ thành công' });
  } catch (error) { next(error); }
};
