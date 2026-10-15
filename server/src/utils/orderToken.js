const crypto = require('crypto');
const config = require('../config/env');

/**
 * Token truy cập đơn hàng (chống IDOR cho khách vãng lai):
 * HMAC-SHA256("order:" + mã đơn, SESSION_SECRET) — không lưu CSDL, không thể giả mạo
 * nếu không có khóa bí mật phía server.
 */
function getOrderAccessToken(orderCode) {
  return crypto.createHmac('sha256', config.session.secret)
    .update(`order:${orderCode}`)
    .digest('hex')
    .slice(0, 32);
}

module.exports = { getOrderAccessToken };
