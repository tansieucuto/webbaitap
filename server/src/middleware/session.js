const crypto = require('crypto');
const pool = require('../config/db');
const config = require('../config/env');

const COOKIE_NAME = 'tovang_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

/**
 * Session middleware:
 * Tự động cấp session ID cho khách vãng lai và khôi phục thông tin đăng nhập từ CSDL.
 */
module.exports = async function sessionMiddleware(req, res, next) {
  try {
    let sessionId = req.signedCookies?.[COOKIE_NAME] || req.cookies?.[COOKIE_NAME];
    let sessionUser = null;
    let isValidSession = false;

    if (sessionId) {
      try {
        const [rows] = await pool.query(
          `SELECT s.id, s.user_id, s.expires_at,
                  u.id AS uid, u.email, u.full_name, u.phone, u.role, u.is_active
           FROM sessions s
           LEFT JOIN users u ON s.user_id = u.id
           WHERE s.id = ? AND s.expires_at > NOW()
           LIMIT 1`,
          [sessionId]
        );

        if (rows.length > 0) {
          isValidSession = true;
          sessionId = rows[0].id;
          if (rows[0].user_id && rows[0].is_active) {
            sessionUser = {
              id: rows[0].uid,
              email: rows[0].email,
              full_name: rows[0].full_name,
              phone: rows[0].phone,
              role: rows[0].role
            };
          }
        }
      } catch (dbErr) {
        // Nếu DB chưa sẵn sàng, giữ sessionId tạm thời
        console.warn('⚠️ Lỗi truy vấn session từ CSDL:', dbErr.message);
      }
    }

    if (!isValidSession) {
      sessionId = crypto.randomUUID();
      try {
        await pool.query(
          `INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at)
           VALUES (?, NULL, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
          [sessionId, req.ip || null, (req.headers['user-agent'] || '').substring(0, 500)]
        );
      } catch (dbErr) {
        // Bỏ qua nếu DB chưa chạy để không chặn các request khác
      }

      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE_MS,
        secure: config.env === 'production'
      });
    }

    req.sessionId = sessionId;
    req.user = sessionUser;
    next();
  } catch (err) {
    next(err);
  }
};

