/**
 * TIỆN ÍCH VNPAY — Ký và xác thực chữ ký theo đúng chuẩn sample chính thức VNPAY
 * - Chữ ký: HMAC-SHA512 trên chuỗi tham số đã sắp xếp alphabet + URL-encode
 * - HashSecret chỉ nằm phía server (đọc từ .env), không bao giờ lộ ra client
 */
const crypto = require('crypto');
const config = require('../config/env');

// Sắp xếp alphabet + mã hóa tham số (giống hàm sortObject trong sample VNPAY)
function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).map(k => encodeURIComponent(k)).sort();
  for (const k of keys) {
    sorted[k] = encodeURIComponent(String(obj[k])).replace(/%20/g, '+');
  }
  return sorted;
}

function buildSignData(params) {
  const sorted = sortObject(params);
  return Object.keys(sorted).map(k => `${k}=${sorted[k]}`).join('&');
}

function sign(params, secret) {
  const signData = buildSignData(params);
  return crypto.createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
}

// Định dạng ngày giờ VNPAY yêu cầu: GMT+7, yyyymmddHHMMss
function formatVnDate(date) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
}

function normalizeIp(ip) {
  let v = String(ip || '127.0.0.1');
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v === '::1') v = '127.0.0.1';
  return v;
}

/**
 * Sinh URL thanh toán VNPAY cho 1 đơn hàng.
 * vnp_TxnRef = mã đơn (duy nhất, không thể đoán — chống giả mạo/dò mã).
 */
function buildVnpayPaymentUrl({ orderCode, amount, ipAddr }) {
  const { tmnCode, hashSecret, url, returnUrl } = config.vnpay;
  if (!tmnCode || !hashSecret) {
    throw new Error('Chưa cấu hình VNPAY_TMN_CODE / VNPAY_HASH_SECRET trong .env');
  }

  const now = new Date();
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderCode,
    vnp_OrderInfo: `Thanh toan don hang ${orderCode}`,
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount) * 100, // VNPAY tính đơn vị xu (×100)
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: normalizeIp(ipAddr),
    vnp_CreateDate: formatVnDate(now),
    vnp_ExpireDate: formatVnDate(new Date(now.getTime() + 15 * 60 * 1000))
  };

  const secureHash = sign(params, hashSecret);
  return `${url}?${buildSignData(params)}&vnp_SecureHash=${secureHash}`;
}

/**
 * Xác thực chữ ký từ dữ liệu VNPAY gửi về (ReturnUrl hoặc IPN).
 * Kẻ tấn công sửa số tiền/mã đơn/trạng thái → chữ ký sai → reject.
 */
function verifyVnpayParams(query) {
  const { hashSecret } = config.vnpay;
  const secureHash = String(query.vnp_SecureHash || '').toLowerCase();
  if (!secureHash || !hashSecret) return { valid: false };

  const clone = { ...query };
  delete clone.vnp_SecureHash;
  delete clone.vnp_SecureHashType;

  const expected = sign(clone, hashSecret);
  const valid = secureHash.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(secureHash), Buffer.from(expected));
  return { valid };
}

module.exports = { buildVnpayPaymentUrl, verifyVnpayParams };
