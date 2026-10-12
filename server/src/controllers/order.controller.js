const pool = require('../config/db');
const generateOrderCode = require('../utils/orderCode');
const { ValidationError: BadRequestError, NotFoundError } = require('../utils/errors');
const { fetchCartData } = require('./cart.controller');
const config = require('../config/env');

function getBankDetails(amount, orderCode) {
  const bankCode = config.bank.bankCode || 'VCB';
  const accountNumber = config.bank.accountNumber || '123456789';
  const accountName = config.bank.accountName || 'TO VANG VIET NAM';
  
  // URL chuẩn VietQR hình ảnh Napas 247
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
  const connection = await pool.getConnection();
  try {
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

    // Lấy giỏ hàng hiện tại
    const cart = await fetchCartData(userId, sessionId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestError('Giỏ hàng của bạn đang trống.');
    }

    // Nếu khách chưa đăng nhập, tìm hoặc tạo tài khoản khách để thỏa mãn FK user_id
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

    // Tạo đơn hàng
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

    // Tạo chi tiết đơn hàng & trừ tồn kho
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

    // Xóa giỏ hàng sau khi đặt thành công
    if (userId) {
      await connection.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    } else if (sessionId) {
      await connection.query('DELETE FROM cart_items WHERE session_id = ?', [sessionId]);
    }

    // Ghi audit log
    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'create_order', 'order', ?, JSON_OBJECT('order_code', ?, 'total', ?), ?)`,
      [orderUserId, orderId, orderCode, cart.total, req.ip || null]
    );

    await connection.commit();

    const bankDetails = payment_method === 'bank_transfer'
      ? getBankDetails(cart.total, orderCode)
      : null;

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
        bankDetails
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { orderCode } = req.params;

    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE order_code = ?',
      [orderCode]
    );

    if (orders.length === 0) {
      throw new NotFoundError('Không tìm thấy đơn hàng với mã này.');
    }

    const order = orders[0];

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [order.id]
    );

    order.items = items;
    if (order.payment_method === 'bank_transfer') {
      order.bankDetails = getBankDetails(order.total, order.order_code);
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
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
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { orderCode } = req.params;
    const [orders] = await pool.query('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng.');

    const order = orders[0];
    if (['shipping', 'delivered', 'cancelled'].includes(order.status)) {
      throw new BadRequestError(`Không thể hủy đơn hàng đang ở trạng thái "${order.status}".`);
    }

    await pool.query(
      'UPDATE orders SET status = "cancelled", cancelled_at = NOW(), cancel_reason = "Khách hàng tự hủy" WHERE id = ?',
      [order.id]
    );

    res.json({ success: true, message: 'Đã hủy đơn hàng thành công.' });
  } catch (error) {
    next(error);
  }
};

// DEMO: Giả lập thanh toán VietQR thành công
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
  } catch (error) {
    next(error);
  }
};

