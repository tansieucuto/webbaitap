/**
 * JOB TỰ ĐỘNG HẾT HẠN ĐƠN HÀNG — chạy nền mỗi 30 giây
 * Đơn chờ thanh toán quá hạn (mốc đọc từ bảng settings) → status 'expired' + hoàn kho + audit.
 * Mốc: transfer_timeout_hours (mặc định 24h), vnpay_timeout_minutes (mặc định 15 phút).
 */
const pool = require('../config/db');

const RUN_EVERY_MS = 30 * 1000;

async function getTimeouts() {
  const timeouts = { transfer_timeout_hours: 24, vnpay_timeout_minutes: 15 };
  try {
    const [rows] = await pool.query(
      "SELECT `key`, value FROM settings WHERE `key` IN ('transfer_timeout_hours','vnpay_timeout_minutes')"
    );
    for (const r of rows) {
      const n = parseFloat(r.value);
      if (!isNaN(n) && n >= 0) timeouts[r.key] = n;
    }
  } catch (_) {}
  return timeouts;
}

async function expireOverdueOrders() {
  try {
    const { transfer_timeout_hours, vnpay_timeout_minutes } = await getTimeouts();

    const [overdue] = await pool.query(
      `SELECT id, order_code, user_id FROM orders
       WHERE status = 'pending_payment'
         AND (
           (payment_method = 'bank_transfer' AND created_at < NOW() - INTERVAL ? HOUR)
           OR (payment_method = 'vnpay' AND created_at < NOW() - INTERVAL ? MINUTE)
         )
       LIMIT 100`,
      [transfer_timeout_hours, vnpay_timeout_minutes]
    );

    for (const o of overdue) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Khóa đơn + kiểm tra lại trạng thái (tránh đua với demo-pay / xác nhận thanh toán)
        const [rows] = await connection.query('SELECT status FROM orders WHERE id = ? FOR UPDATE', [o.id]);
        if (rows.length === 0 || rows[0].status !== 'pending_payment') {
          await connection.rollback();
          continue;
        }

        // Hoàn kho
        const [items] = await connection.query(
          'SELECT variant_id, quantity FROM order_items WHERE order_id = ?',
          [o.id]
        );
        for (const it of items) {
          await connection.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [it.quantity, it.variant_id]);
        }

        await connection.query(
          "UPDATE orders SET status = 'expired', cancelled_at = NOW(), cancel_reason = 'Hết hạn thanh toán (tự động)' WHERE id = ?",
          [o.id]
        );

        await connection.query(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
           VALUES (?, 'expire_order', 'order', ?, ?)`,
          [o.user_id, o.id, JSON.stringify({ order_code: o.order_code, reason: 'payment_timeout' })]
        );

        await connection.commit();
        console.log(`⏰ Đơn ${o.order_code} hết hạn thanh toán → đã hủy và hoàn kho.`);
      } catch (err) {
        try { await connection.rollback(); } catch (_) {}
        console.warn('⚠️ Lỗi xử lý đơn hết hạn', o.order_code, err.message);
      } finally {
        connection.release();
      }
    }
  } catch (err) {
    console.warn('⚠️ Job hết hạn đơn lỗi:', err.message);
  }
}

function startExpireOrdersJob() {
  setTimeout(expireOverdueOrders, 10 * 1000);
  setInterval(expireOverdueOrders, RUN_EVERY_MS);
  console.log('🕐 Job tự động hết hạn đơn hàng đã bật (mỗi 30 giây).');
}

module.exports = { startExpireOrdersJob, expireOverdueOrders };
