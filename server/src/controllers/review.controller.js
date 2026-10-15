const pool = require('../config/db');
const { ValidationError: BadRequestError, NotFoundError, ConflictError, AppError } = require('../utils/errors');

// GET /api/v1/reviews                  → đánh giá ĐÃ DUYỆT cho trang chủ
// GET /api/v1/products/:slug/reviews   → đánh giá đã duyệt của 1 sản phẩm
exports.listReviews = async (req, res, next) => {
  try {
    let where = 'r.is_approved = TRUE';
    const params = [];

    if (req.params.slug) {
      const [products] = await pool.query('SELECT id FROM products WHERE slug = ?', [req.params.slug]);
      if (products.length === 0) throw new NotFoundError('Không tìm thấy sản phẩm.');
      where += ' AND r.product_id = ?';
      params.push(products[0].id);
    }

    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.content, r.created_at,
              u.full_name AS author_name,
              p.name AS product_name
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       WHERE ${where}
       ORDER BY r.created_at DESC
       LIMIT 50`,
      params
    );

    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total_reviews, ROUND(AVG(rating), 2) AS average_rating
       FROM reviews r WHERE ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        reviews,
        stats: {
          total_reviews: Number(stats.total_reviews) || 0,
          average_rating: stats.average_rating !== null ? Number(stats.average_rating) : 5.0
        }
      }
    });
  } catch (error) { next(error); }
};

exports.createReview = async (req, res, next) => {
  try {
    const user = req.user;
    let productId = parseInt(req.body.product_id, 10);
    const rating = parseInt(req.body.rating, 10);
    const content = String(req.body.content || '').trim();

    // Hỗ trợ cả route lồng /products/:slug/reviews
    if (!Number.isInteger(productId) && req.params.slug) {
      const [p] = await pool.query('SELECT id FROM products WHERE slug = ?', [req.params.slug]);
      if (p.length > 0) productId = p[0].id;
    }

    if (!Number.isInteger(productId)) throw new BadRequestError('Thiếu sản phẩm cần đánh giá.');
    if (!(rating >= 1 && rating <= 5)) throw new BadRequestError('Số sao phải từ 1 đến 5.');
    if (content.length < 3 || content.length > 1000) {
      throw new BadRequestError('Nội dung đánh giá phải từ 3 đến 1000 ký tự.');
    }

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (products.length === 0) throw new NotFoundError('Không tìm thấy sản phẩm.');

    // Xác thực "đã mua hàng": tìm đơn ĐÃ GIAO của user có chứa sản phẩm này
    const [orders] = await pool.query(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       WHERE o.user_id = ? AND o.status = 'delivered' AND pv.product_id = ?
       ORDER BY o.delivered_at DESC LIMIT 1`,
      [user.id, productId]
    );

    if (orders.length === 0) {
      throw new AppError('Bạn chỉ có thể đánh giá sản phẩm đã mua và đã được giao thành công.', 403);
    }

    try {
      await pool.query(
        `INSERT INTO reviews (order_id, product_id, user_id, rating, content, is_approved)
         VALUES (?, ?, ?, ?, ?, FALSE)`,
        [orders[0].id, productId, user.id, rating, content]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw new ConflictError('Bạn đã đánh giá sản phẩm này rồi.');
      throw e;
    }

    res.json({ success: true, message: 'Đánh giá đã được gửi và đang chờ ban quản trị duyệt. Cảm ơn bạn!' });
  } catch (error) { next(error); }
};
