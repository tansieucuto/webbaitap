const crypto = require('crypto');
const pool = require('../config/db');
const generateOrderCode = require('../utils/orderCode');
const { ValidationError: BadRequestError, NotFoundError, AuthorizationError } = require('../utils/errors');
const { fetchCartData } = require('./cart.controller');
const config = require('../config/env');
const { getOrderAccessToken } = require('../utils/orderToken');
const { buildVnpayPaymentUrl } = require('../utils/vnpay');

function getBankDetails(amount, orderCode) {
  const bankCode = config.bank.bankCode || 'VCB';
  const accountNumber = config.bank.accountNumber || '123456789';
  const accountName = config.bank.accountName || 'TO VANG VIET NAM';

  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=${encodeURIComponent(accountName)}`;

  return {
    bankCode,
    bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    accountNumber,
    accountName,
    amount,
    memo: orderCode,
    qrUrl
  };
}

exports.createOrder = async (req, res, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const {
      recipient_name,
      phone,
      full_address,
      note,
      payment_method = 'cod',
      idempotency_key
    } = req.body;

    if (!recipient_name || !phone || !full_address) {
      throw new BadRequestError('Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ nhận hàng.');
    }

    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionId;

    const cart = await fetchCartData(userId, sessionId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestError('Giỏ hàng của bạn đang trống.');
    }

    let orderUserId = userId;
    if (!orderUserId) {
      const guestEmail = `guest_${phone.replace(/\D/g, '') || Date.now()}@tovang.vn`;
      const [existingUser] = await connection.query(
        'SELECT id FROM users WHERE phone = ? OR email = ? LIMIT 1',
        [phone.trim(), guestEmail]
      );

      if (existingUser.length > 0) {
        orderUserId = existingUser[0].id;
      } else {
        const [newUser] = await connection.query(
          `INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active)
           VALUES (?, 'guest_placeholder', ?, ?, 'customer', FALSE, TRUE)`,
          [guestEmail, recipient_name.trim(), phone.trim()]
        );
        orderUserId = newUser.insertId;
      }
    }

    const orderCode = generateOrderCode();
    const initialStatus = (payment_method === 'bank_transfer' || payment_method === 'vnpay')
      ? 'pending_payment'
      : 'pending_confirmation';

    const [orderResult] = await connection.query(
      `INSERT INTO orders (
        order_code, user_id, status, payment_method,
        shipping_fee, discount_amount, subtotal, total,
        recipient_name, phone, full_address, note, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderCode, orderUserId, initialStatus, payment_method,
        cart.shipping_fee, cart.subtotal, cart.total,
        recipient_name.trim(), phone.trim(), full_address.trim(), note || null,
        idempotency_key || null
      ]
    );

    const orderId = orderResult.insertId;

    for (const it of cart.items) {
      await connection.query(
        `INSERT INTO order_items (
          order_id, variant_id, product_name, variant_name, unit_price, quantity, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, it.variant_id, it.product_name, it.variant_name, it.price, it.quantity, it.price * it.quantity]
      );

      await connection.query(
        'UPDATE product_variants SET stock = GREATEST(0, stock - ?) WHERE id = ?',
        [it.quantity, it.variant_id]
      );
    }

    if (userId) {
      await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    } else if (sessionId) {
      await connection.query('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'create_order', 'order', ?, JSON_OBJECT('order_code', ?, 'total', ?), ?)`,
      [orderUserId, orderId, orderCode, cart.total, req.ip || null]
    );

    await connection.commit();

    const bankDetails = payment_method === 'bank_transfer'
      ? getBankDetails(cart.total, orderCode)
      : null;

    // Đơn VNPay: sinh URL thanh toán để frontend chuyển hướng sang cổng.
    // Nếu chưa cấu hình key trong .env thì không chặn việc tạo đơn.
    let paymentUrl = null;
    if (payment_method === 'vnpay') {
      try {
        paymentUrl = buildVnpayPaymentUrl({ orderCode, amount: cart.total, ipAddr: req.ip });
      } catch (e) {
        console.warn('⚠️ Không sinh được URL VNPay:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: {
        id: orderId,
        order_code: orderCode,
        orderCode: orderCode,
        status: initialStatus,
        payment_method,
        paymentMethod: payment_method,
        subtotal: cart.subtotal,
        shipping_fee: cart.shipping_fee,
        total: cart.total,
        recipient_name,
        phone,
        full_address,
        bankDetails,
        access_token: getOrderAccessToken(orderCode),
        payment_url: paymentUrl
      }
    });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { orderCode } = req.params;

    const [orders] = await pool.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng với mã này.');
    const order = orders[0];

    // ===== CHỐNG IDOR: chủ đơn (đăng nhập) / admin / token HMAC hợp lệ =====
    const isOwner = !!(req.user && order.user_id === req.user.id);
    const isAdmin = !!(req.user && req.user.role === 'admin');

    let tokenOk = false;
    const provided = req.query.token;
    if (typeof provided === 'string' && provided.length > 0) {
      const expected = getOrderAccessToken(orderCode);
      tokenOk = provided.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    }

    if (!isOwner && !isAdmin && !tokenOk) {
      throw new AuthorizationError('Bạn không có quyền xem đơn hàng này.');
    }

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    order.items = items;
    if (order.payment_method === 'bank_transfer') {
      order.bankDetails = getBankDetails(order.total, order.order_code);
    }

    res.json({ success: true, data: order });
  } catch (error) { next(error); }
};

exports.listOrders = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    for (let o of orders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [o.id]);
      o.items = items;
    }

    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
};

exports.cancelOrder = async (req, res, next) => {
  let connection;
  try {
    const { orderCode } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.query('SELECT * FROM orders WHERE order_code = ? FOR UPDATE', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng.');
    const order = orders[0];

    // ===== CHỐNG IDOR: chỉ chủ sở hữu đơn được tự hủy (admin hủy qua trang quản trị) =====
    if (order.user_id !== req.user.id) {
      throw new AuthorizationError('Bạn không có quyền hủy đơn hàng này.');
    }

    if (!['pending_payment', 'pending_confirmation', 'confirmed'].includes(order.status)) {
      throw new BadRequestError(`Không thể hủy đơn hàng đang ở trạng thái "${order.status}".`);
    }

    // Hoàn kho — hàng đã bị trừ lúc đặt đơn
    const [items] = await connection.query(
      'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
      [order.id]
    );
    for (const it of items) {
      await connection.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [it.quantity, it.variant_id]);
    }

    await connection.query(
      "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = ? WHERE id = ?",
      [String(req.body?.reason || 'Khách hàng tự hủy').substring(0, 500), order.id]
    );

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'cancel_order', 'order', ?, ?, ?)`,
      [req.user.id, order.id, JSON.stringify({ order_code: orderCode, by: 'customer' }), req.ip || null]
    );

    await connection.commit();
    res.json({ success: true, message: 'Đã hủy đơn hàng thành công. Tồn kho đã được hoàn lại.' });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

// DEMO: Giả lập thanh toán VietQR thành công (giữ nguyên theo yêu cầu)
exports.demoPay = async (req, res, next) => {
  try {
    const { orderCode } = req.params;
    const [orders] = await pool.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng.');

    const order = orders[0];
    await pool.query(
      'UPDATE orders SET status = "confirmed", paid_at = NOW() WHERE id = ?',
      [order.id]
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'vietqr_demo_payment', 'order', ?, JSON_OBJECT('order_code', ?, 'amount', ?))`,
      [order.user_id, order.id, order.order_code, order.total]
    );

    res.json({
      success: true,
      message: '⚡ [DEMO] Thanh toán qua mã VietQR đã được xác nhận thành công!',
      data: {
        order_code: order.order_code,
        status: 'confirmed',
        paid_at: new Date()
      }
    });
  } catch (error) { next(error); }
};

// ===== THANH TOÁN LẠI (đơn còn chờ thanh toán) =====
// Chuẩn TMĐT: đơn chưa thanh toán được phép thanh toán lại trong thời hạn.
// VNPay: URL cũ có vnp_ExpireDate (15 phút) nên phải SINH URL MỚI, không dùng lại URL cũ.
exports.payAgain = async (req, res, next) => {
  try {
    const { orderCode } = req.params;

    const [orders] = await pool.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng.');
    const order = orders[0];

    // Chỉ chủ đơn (hoặc admin) được thanh toán lại — chống IDOR
    const isOwner = !!(req.user && order.user_id === req.user.id);
    const isAdmin = !!(req.user && req.user.role === 'admin');
    if (!isOwner && !isAdmin) {
      throw new AuthorizationError('Bạn không có quyền thanh toán đơn hàng này.');
    }

    // Chỉ đơn còn chờ thanh toán mới được thanh toán lại (đã hủy/hết hạn/đã xác nhận → chặn)
    if (order.status !== 'pending_payment') {
      throw new BadRequestError('Đơn hàng không còn ở trạng thái chờ thanh toán.');
    }

    if (order.payment_method === 'vnpay') {
      // Sinh URL VNPay MỚI (URL cũ đã hết hiệu lực sau 15 phút)
      const paymentUrl = buildVnpayPaymentUrl({ orderCode: order.order_code, amount: order.total, ipAddr: req.ip });
      return res.json({ success: true, data: { payment_url: paymentUrl } });
    }

    if (order.payment_method === 'bank_transfer') {
      return res.json({ success: true, data: { bankDetails: getBankDetails(order.total, order.order_code) } });
    }

    throw new BadRequestError('Đơn hàng này không cần thanh toán lại.');
  } catch (error) { next(error); }
};
