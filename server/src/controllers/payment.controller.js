/**
 * XỬ LÝ KẾT QUẢ THANH TOÁN VNPAY
 * - ReturnUrl: VNPAY chuyển hướng TRÌNH DUYỆT khách về đây → ta verify chữ ký,
 *   cập nhật đơn rồi chuyển khách sang trang kết quả.
 * - IPN: VNPAY gọi SERVER-TO-SERVER về đây (kênh tin cậy nhất, không thể giả mạo
 *   từ trình duyệt khách) → cập nhật đơn và trả JSON {RspCode, Message}.
 * Cả 2 kênh đều verify chữ ký + đối chiếu số tiền + chống xử lý trùng.
 */
const pool = require('../config/db');
const { verifyVnpayParams } = require('../utils/vnpay');
const { getOrderAccessToken } = require('../utils/orderToken');

async function applyVnpayResult(query) {
  // 1. Xác thực chữ ký HMAC-SHA512
  const { valid } = verifyVnpayParams(query);
  if (!valid) return { code: '97', message: 'Invalid signature' };

  // 2. Tìm đơn theo mã (vnp_TxnRef chính là order_code)
  const orderCode = String(query.vnp_TxnRef || '');
  const [orders] = await pool.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
  if (orders.length === 0) return { code: '01', message: 'Order not found' };
  const order = orders[0];

  // 3. Đối chiếu số tiền (VNPAY gửi đơn vị xu ×100) — chống trả thiếu
  if (Number(query.vnp_Amount) !== order.total * 100) {
    return { code: '04', message: 'Invalid amount' };
  }

  // 4. Đơn đã được xử lý trước đó (IPN gọi lại, hoặc đã hủy/hết hạn)
  if (order.status !== 'pending_payment') {
    return { code: '02', message: 'Order already confirmed' };
  }

  if (query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00') {
    // Thanh toán thành công → xác nhận đơn (kho đã trừ lúc đặt, không trừ lại)
    const [upd] = await pool.query(
      "UPDATE orders SET status = 'confirmed', paid_at = NOW() WHERE id = ? AND status = 'pending_payment'",
      [order.id]
    );
    if (upd.affectedRows > 0) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'vnpay_payment_success', 'order', ?, ?)`,
        [order.user_id, order.id, JSON.stringify({
          order_code: orderCode,
          vnp_TransactionNo: query.vnp_TransactionNo,
          amount: order.total
        })]
      );
    }
    return { code: '00', message: 'Confirm Success' };
  }

  // Giao dịch thất bại/hủy tại cổng → giữ đơn chờ thanh toán (job hết hạn sẽ dọn + hoàn kho)
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (?, 'vnpay_payment_failed', 'order', ?, ?)`,
    [order.user_id, order.id, JSON.stringify({ order_code: orderCode, vnp_ResponseCode: query.vnp_ResponseCode })]
  );
  return { code: '00', message: 'Confirm Success' };
}

exports.vnpayReturn = async (req, res) => {
  try {
    await applyVnpayResult(req.query);
    const orderCode = String(req.query.vnp_TxnRef || '');
    const token = orderCode ? getOrderAccessToken(orderCode) : '';
    const failed = req.query.vnp_ResponseCode !== '00' ? '&failed=1' : '';
    res.redirect(`/order-success.html?code=${encodeURIComponent(orderCode)}&token=${encodeURIComponent(token)}${failed}`);
  } catch (err) {
    console.error('Lỗi xử lý VNPAY Return:', err.message);
    res.redirect('/index.html');
  }
};

exports.vnpayIpn = async (req, res) => {
  try {
    const result = await applyVnpayResult(req.query);
    res.status(200).json({ RspCode: result.code, Message: result.message });
  } catch (err) {
    console.error('Lỗi xử lý VNPAY IPN:', err.message);
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};
