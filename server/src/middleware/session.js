/**
 * SESSION MIDDLEWARE — Phiên đăng nhập lưu trong CSDL (bảng sessions)
 * - Cookie HttpOnly + SameSite=Lax: JS không đọc được cookie (chống XSS đánh cắp phiên),
 *   trình duyệt không gửi cookie theo request từ site khác (chặn CSRF cơ bản).
 * - Xoay session ID khi đăng nhập / đăng xuất (chống tấn công Session Fixation).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const config = require('../config/env');

const COOKIE_NAME = 'tovang_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production', // production bắt buộc HTTPS
    maxAge: SESSION_MAX_AGE_MS
  };
}

function setSessionCookie(res, sessionId) {
  res.cookie(COOKIE_NAME, sessionId, cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production'
  });
}

// Tạo một phiên mới trong CSDL
async function createSession({ userId = null, ip = null, userAgent = '' } = {}) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [id, userId, ip, String(userAgent || '').substring(0, 500)]
  );
  return id;
}

/**
 * Xoay phiên (dùng khi đăng nhập / đăng xuất):
 * tạo session ID mới, chuyển giỏ hàng của phiên cũ sang phiên mới, xóa phiên cũ.
 * LƯU Ý: phải chuyển cart_items TRƯỚC khi xóa sessions (FK có ON DELETE CASCADE).
 */
async function rotateSession(req, res, userId = null) {
  const oldId = req.sessionId;
  const newId = await createSession({ userId, ip: req.ip, userAgent: req.headers['user-agent'] });

  if (oldId) {
    try {
      await pool.query('UPDATE cart_items SET session_id = ? WHERE session_id = ?', [newId, oldId]);
      await pool.query('DELETE FROM sessions WHERE id = ?', [oldId]);
    } catch (_) { /* lỗi DB thì bỏ qua — phiên cũ sẽ tự hết hạn */ }
  }

  setSessionCookie(res, newId);
  req.sessionId = newId;
  return newId;
}

// Xóa hẳn phiên hiện tại
async function destroySession(req, res) {
  if (req.sessionId) {
    try { await pool.query('DELETE FROM sessions WHERE id = ?', [req.sessionId]); } catch (_) {}
  }
  clearSessionCookie(res);
}

module.exports = async function sessionMiddleware(req, res, next) {
  try {
    const incomingId = req.cookies?.[COOKIE_NAME];
    let currentId = incomingId;
    let sessionUser = null;
    let isValid = false;

    if (incomingId) {
      try {
        const [rows] = await pool.query(
          `SELECT s.id, s.user_id, s.expires_at,
                  u.id AS uid, u.email, u.full_name, u.phone, u.role, u.is_active, u.email_verified
           FROM sessions s
           LEFT JOIN users u ON s.user_id = u.id
           WHERE s.id = ? AND s.expires_at > NOW()
           LIMIT 1`,
          [incomingId]
        );

        if (rows.length > 0) {
          isValid = true;
          currentId = rows[0].id;
          if (rows[0].user_id && rows[0].is_active) {
            sessionUser = {
              id: rows[0].uid,
              email: rows[0].email,
              full_name: rows[0].full_name,
              phone: rows[0].phone,
              role: rows[0].role,
              is_verified: !!rows[0].email_verified
            };
          }
        }
      } catch (dbErr) {
        console.warn('⚠️ Lỗi truy vấn session từ CSDL:', dbErr.message);
      }
    }

    if (!isValid) {
      // Cấp phiên khách mới (nếu DB lỗi thì vẫn cấp ID tạm để không chặn request)
      currentId = await createSession({ ip: req.ip, userAgent: req.headers['user-agent'] })
        .catch(() => crypto.randomUUID());
      setSessionCookie(res, currentId);

      // Dọn phiên hết hạn định kỳ (không chặn request)
      pool.query('DELETE FROM sessions WHERE expires_at < NOW() LIMIT 50').catch(() => {});
    }

    req.sessionId = currentId;
    req.user = sessionUser;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports.sessionHelpers = {
  COOKIE_NAME,
  createSession,
  rotateSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie
};
