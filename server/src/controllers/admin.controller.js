const pool = require('../config/db');
const { ValidationError: BadRequestError, NotFoundError } = require('../utils/errors');

const ORDER_STATUSES = ['pending_payment', 'pending_confirmation', 'confirmed', 'shipping', 'delivered', 'delivery_failed', 'cancelled', 'expired', 'refunded'];

// Luồng chuyển trạng thái hợp lệ — chặn nhảy cóc/đảo trạng thái
const ALLOWED_TRANSITIONS = {
  pending_payment:      ['confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed:            ['shipping', 'cancelled'],
  shipping:             ['delivered', 'delivery_failed'],
  delivery_failed:      ['shipping', 'cancelled'],
  delivered:            [],
  cancelled:            [],
  expired:              [],
  refunded:             []
};

async function writeAudit(req, action, entityType, entityId, details) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user?.id || null, action, entityType, entityId, details ? JSON.stringify(details) : null, req.ip || null]
    );
  } catch (_) {}
}

// Bỏ dấu tiếng Việt để sinh slug
function slugify(str) {
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 200);
}

// ===== DASHBOARD =====
exports.getDashboard = async (req, res, next) => {
  try {
    const [[revenue]] = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS totalRevenue
       FROM orders WHERE status IN ('confirmed', 'shipping', 'delivered')`
    );

    const [statusRows] = await pool.query('SELECT status, COUNT(*) AS cnt FROM orders GROUP BY status');
    const statusCounts = {};
    statusRows.forEach(r => { statusCounts[r.status] = Number(r.cnt); });

    const [lowStockVariants] = await pool.query(
      `SELECT pv.id, pv.name AS variant_name, pv.sku, pv.stock, pv.price, p.name AS product_name
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.is_active = TRUE AND pv.stock <= 10
       ORDER BY pv.stock ASC LIMIT 20`
    );

    const [recentOrders] = await pool.query(
      `SELECT id, order_code, recipient_name, phone, total, status, created_at
       FROM orders ORDER BY created_at DESC LIMIT 10`
    );

    const [[customerCount]] = await pool.query(`SELECT COUNT(*) AS cnt FROM users WHERE role = 'customer'`);
    const [[pendingReviewCount]] = await pool.query(`SELECT COUNT(*) AS cnt FROM reviews WHERE is_approved = FALSE`);
    const [[productCount]] = await pool.query(`SELECT COUNT(*) AS cnt FROM products WHERE is_active = TRUE`);

    res.json({
      success: true,
      data: {
        totalRevenue: Number(revenue.totalRevenue) || 0,
        statusCounts,
        lowStockVariants,
        recentOrders,
        customerCount: Number(customerCount.cnt) || 0,
        pendingReviewCount: Number(pendingReviewCount.cnt) || 0,
        productCount: Number(productCount.cnt) || 0
      }
    });
  } catch (error) { next(error); }
};

// ===== ĐƠN HÀNG =====
exports.listOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = [];
    const params = [];

    if (status && ORDER_STATUSES.includes(status)) {
      where.push('o.status = ?');
      params.push(status);
    }

    const [orders] = await pool.query(
      `SELECT o.*, u.email AS user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY o.created_at DESC LIMIT 100`,
      params
    );

    for (const o of orders) {
      const [items] = await pool.query(
        'SELECT product_name, variant_name, unit_price, quantity, subtotal FROM order_items WHERE order_id = ?',
        [o.id]
      );
      o.items = items;
    }

    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
};

exports.updateOrderStatus = async (req, res, next) => {
  let connection;
  try {
    const { orderCode } = req.params;
    const { status, tracking_number, reason } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      throw new BadRequestError('Trạng thái đơn hàng không hợp lệ.');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.query('SELECT * FROM orders WHERE order_code = ? FOR UPDATE', [orderCode]);
    if (orders.length === 0) throw new NotFoundError('Không tìm thấy đơn hàng.');
    const order = orders[0];

    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestError(`Không thể chuyển đơn từ trạng thái "${order.status}" sang "${status}".`);
    }

    const sets = ['status = ?'];
    const params = [status];

    if (status === 'confirmed') {
      sets.push('confirmed_by = ?');
      params.push(req.user.id);
      if (order.payment_method === 'bank_transfer' && !order.paid_at) sets.push('paid_at = NOW()');
    }
    if (status === 'shipping') {
      sets.push('shipped_at = NOW()');
      const tracking = String(tracking_number || '').trim().substring(0, 100);
      if (tracking) { sets.push('tracking_number = ?'); params.push(tracking); }
    }
    if (status === 'delivered') {
      sets.push('delivered_at = NOW()');
      if (order.payment_method === 'cod' && !order.paid_at) sets.push('paid_at = NOW()');
    }
    if (status === 'cancelled') {
      sets.push('cancelled_at = NOW()', 'cancel_reason = ?');
      params.push(String(reason || 'Quản trị viên hủy đơn').substring(0, 500));
      // Hoàn kho các biến thể trong đơn
      const [items] = await connection.query('SELECT variant_id, quantity FROM order_items WHERE order_id = ?', [order.id]);
      for (const it of items) {
        await connection.query('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [it.quantity, it.variant_id]);
      }
    }

    await connection.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, [...params, order.id]);

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'update_order_status', 'order', ?, ?, ?)`,
      [req.user.id, order.id, JSON.stringify({ order_code: orderCode, from: order.status, to: status }), req.ip || null]
    );

    await connection.commit();
    res.json({ success: true, message: `Đã cập nhật đơn ${orderCode} sang "${status}".` });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

// ===== SẢN PHẨM / KHO =====
exports.listProducts = async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT * FROM products ORDER BY id ASC');
    for (const p of products) {
      const [variants] = await pool.query(
        'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC',
        [p.id]
      );
      p.variants = variants;
    }
    res.json({ success: true, data: products });
  } catch (error) { next(error); }
};

exports.createProduct = async (req, res, next) => {
  let connection;
  try {
    const b = req.body;
    const name = String(b.name || '').trim();
    if (name.length < 3 || name.length > 255) {
      throw new BadRequestError('Tên sản phẩm phải từ 3 đến 255 ký tự.');
    }

    const variants = (Array.isArray(b.variants) ? b.variants : [])
      .map(v => ({
        name: String(v.name || '').trim(),
        sku: String(v.sku || '').trim().toUpperCase(),
        price: parseInt(v.price, 10),
        stock: parseInt(v.stock, 10) || 0
      }))
      .filter(v => v.name && v.sku);

    if (variants.length === 0) {
      throw new BadRequestError('Cần ít nhất một biến thể (tên + SKU).');
    }
    for (const v of variants) {
      if (isNaN(v.price) || v.price <= 0) throw new BadRequestError(`Giá của biến thể "${v.name}" không hợp lệ.`);
      if (isNaN(v.stock) || v.stock < 0) throw new BadRequestError(`Tồn kho của biến thể "${v.name}" không hợp lệ.`);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    let slug = slugify(b.slug || name);
    if (!slug) slug = `san-pham-${Date.now().toString(36)}`;

    const [dupSlug] = await connection.query('SELECT id FROM products WHERE slug = ?', [slug]);
    if (dupSlug.length > 0) slug = `${slug}-${Date.now().toString(36)}`;

    const [result] = await connection.query(
      `INSERT INTO products (name, slug, description, short_description, origin, ingredients, shelf_life, self_declaration_number, warning_text, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        name, slug,
        b.description || null, b.short_description || null, b.origin || null,
        b.ingredients || null, b.shelf_life || null, b.self_declaration_number || null,
        b.warning_text || null
      ]
    );
    const productId = result.insertId;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const [dupSku] = await connection.query('SELECT id FROM product_variants WHERE sku = ?', [v.sku]);
      if (dupSku.length > 0) throw new BadRequestError(`SKU "${v.sku}" đã tồn tại, vui lòng chọn SKU khác.`);

      await connection.query(
        `INSERT INTO product_variants (product_id, name, sku, price, stock, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [productId, v.name, v.sku, v.price, v.stock, i + 1]
      );
    }

    const imageUrl = String(b.image_url || '').trim();
    if (imageUrl) {
      await connection.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
         VALUES (?, ?, ?, 1, TRUE)`,
        [productId, imageUrl.substring(0, 255), name]
      );
    }

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'create_product', 'product', ?, ?, ?)`,
      [req.user.id, productId, JSON.stringify({ name, slug, variant_count: variants.length }), req.ip || null]
    );

    await connection.commit();
    res.json({ success: true, message: `Đã thêm sản phẩm "${name}".`, data: { id: productId, slug } });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const b = req.body;

    const allowed = ['name', 'description', 'short_description', 'origin', 'ingredients', 'shelf_life', 'self_declaration_number', 'warning_text', 'is_active'];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      if (b[key] !== undefined) { fields.push(`${key} = ?`); params.push(b[key]); }
    }
    if (fields.length === 0) throw new BadRequestError('Không có trường nào để cập nhật.');

    const [exists] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (exists.length === 0) throw new NotFoundError('Không tìm thấy sản phẩm.');

    params.push(id);
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);

    await writeAudit(req, 'update_product', 'product', id, { fields: Object.keys(b) });
    res.json({ success: true, message: 'Cập nhật sản phẩm thành công.' });
  } catch (error) { next(error); }
};

exports.manageVariants = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { variant_id, stock, price } = req.body;

    if (!variant_id) throw new BadRequestError('Thiếu variant_id.');

    const newStock = parseInt(stock, 10);
    const newPrice = parseInt(price, 10);
    if (isNaN(newStock) || newStock < 0) throw new BadRequestError('Tồn kho không hợp lệ.');
    if (isNaN(newPrice) || newPrice <= 0) throw new BadRequestError('Giá không hợp lệ.');

    const [exists] = await pool.query(
      'SELECT id FROM product_variants WHERE id = ? AND product_id = ?',
      [variant_id, id]
    );
    if (exists.length === 0) throw new NotFoundError('Không tìm thấy biến thể của sản phẩm này.');

    await pool.query('UPDATE product_variants SET stock = ?, price = ? WHERE id = ?', [newStock, newPrice, variant_id]);

    await writeAudit(req, 'update_variant', 'variant', variant_id, { product_id: id, stock: newStock, price: newPrice });
    res.json({ success: true, message: 'Cập nhật biến thể thành công.' });
  } catch (error) { next(error); }
};

// ===== KHÁCH HÀNG =====
exports.listCustomers = async (req, res, next) => {
  try {
    const [customers] = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
              COUNT(o.id) AS order_count,
              COALESCE(SUM(CASE WHEN o.status IN ('confirmed','shipping','delivered') THEN o.total ELSE 0 END), 0) AS total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 200`
    );
    customers.forEach(c => {
      c.order_count = Number(c.order_count) || 0;
      c.total_spent = Number(c.total_spent) || 0;
    });
    res.json({ success: true, data: customers });
  } catch (error) { next(error); }
};

// ===== ĐÁNH GIÁ =====
exports.listReviews = async (req, res, next) => {
  try {
    const { status } = req.query; // pending | approved | all (mặc định all)
    const where = [];
    if (status === 'pending') where.push('r.is_approved = FALSE');
    if (status === 'approved') where.push('r.is_approved = TRUE');

    const [reviews] = await pool.query(
      `SELECT r.*, u.full_name AS author_name, u.email AS author_email,
              p.name AS product_name, o.order_code
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN orders o ON r.order_id = o.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY r.is_approved ASC, r.created_at DESC
       LIMIT 200`
    );
    res.json({ success: true, data: reviews });
  } catch (error) { next(error); }
};

exports.updateReviewStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    if (typeof is_approved !== 'boolean') {
      throw new BadRequestError('Thiếu trạng thái duyệt (is_approved: true/false).');
    }

    const [exists] = await pool.query('SELECT id FROM reviews WHERE id = ?', [id]);
    if (exists.length === 0) throw new NotFoundError('Không tìm thấy đánh giá.');

    await pool.query('UPDATE reviews SET is_approved = ? WHERE id = ?', [is_approved, id]);

    await writeAudit(req, is_approved ? 'approve_review' : 'reject_review', 'review', id, null);
    res.json({ success: true, message: is_approved ? 'Đã duyệt đánh giá.' : 'Đã ẩn đánh giá.' });
  } catch (error) { next(error); }
};

// ===== NHẬT KÝ KIỂM TOÁN =====
exports.getAuditLogs = async (req, res, next) => {
  try {
    const [logs] = await pool.query(
      `SELECT a.*, u.full_name AS user_name, u.email AS user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 200`
    );
    res.json({ success: true, data: logs });
  } catch (error) { next(error); }
};


// ===== XÓA SẢN PHẨM =====
exports.deleteProduct = async (req, res, next) => {
  let connection;
  try {
    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [products] = await connection.query('SELECT id, name FROM products WHERE id = ? FOR UPDATE', [id]);
    if (products.length === 0) throw new NotFoundError('Không tìm thấy sản phẩm.');
    const product = products[0];

    // Biến thể đã từng nằm trong đơn hàng → cấm xóa cứng (giữ lịch sử đơn + FK RESTRICT)
    const [[ordered]] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE pv.product_id = ?`,
      [id]
    );
    if (Number(ordered.cnt) > 0) {
      throw new BadRequestError('Sản phẩm đã có đơn hàng nên không thể xóa vĩnh viễn — hãy dùng nút "Ẩn" để ngừng bán và giữ nguyên lịch sử đơn.');
    }

    // Xóa cứng theo thứ tự con → cha
    await connection.query('DELETE FROM reviews WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM product_images WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM product_variants WHERE product_id = ?', [id]);
    await connection.query('DELETE FROM products WHERE id = ?', [id]);

    await connection.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, 'delete_product', 'product', ?, ?, ?)`,
      [req.user.id, id, JSON.stringify({ name: product.name }), req.ip || null]
    );

    await connection.commit();
    res.json({ success: true, message: `Đã xóa sản phẩm "${product.name}".` });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch (_) {} }
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

// ===== UPLOAD ẢNH SẢN PHẨM =====
exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError('Chưa có file ảnh được tải lên.');
    const url = `/uploads/products/${req.file.filename}`;
    await writeAudit(req, 'upload_product_image', 'product', null, { file: req.file.filename, size: req.file.size });
    res.json({ success: true, message: 'Tải ảnh lên thành công.', data: { url } });
  } catch (error) { next(error); }
};
