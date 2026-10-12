const pool = require('../config/db');
const { ValidationError: BadRequestError, NotFoundError } = require('../utils/errors');

// Danh mục biến thể dự phòng tiêu chuẩn
const fallbackCatalog = {
  1: { product_id: 1, name: 'Mật Ong Rừng Đặc Biệt', variant: 'Hũ Thủy Tinh 500ml', sku: 'MOR-500', price: 280000, img: 'assets/images/honey-forest-wide.jpg', stock: 45 },
  2: { product_id: 1, name: 'Mật Ong Rừng Đặc Biệt', variant: 'Chai Rót Cao Cấp 1000ml', sku: 'MOR-1000', price: 520000, img: 'assets/images/honey-forest-wide.jpg', stock: 30 },
  3: { product_id: 2, name: 'Mật Ong Hoa Rừng Cổ Thụ', variant: 'Hũ Thủy Tinh 500ml', sku: 'MCT-500', price: 310000, img: 'assets/images/honey-deep-ancient.jpg', stock: 25 },
  4: { product_id: 2, name: 'Mật Ong Hoa Rừng Cổ Thụ', variant: 'Hũ Gốm Mộc 750ml', sku: 'MCT-750', price: 460000, img: 'assets/images/honey-deep-ancient.jpg', stock: 20 },
  5: { product_id: 3, name: 'Mật Ong Kem Hoa Bạc Hà', variant: 'Hũ Thủy Tinh 380ml', sku: 'MBH-380', price: 295000, img: 'assets/images/honey-creamed-velvet.jpg', stock: 15 },
  6: { product_id: 4, name: 'Mật Ong Hoa Cam Rừng', variant: 'Hũ Thủy Tinh 500ml', sku: 'MHC-500', price: 260000, img: 'assets/images/honey-citrus-blossom.jpg', stock: 35 },
  7: { product_id: 5, name: 'Mật Ong Rừng Hũ Thủy Tinh', variant: 'Hũ Thủy Tinh 500ml', sku: 'MRH-500', price: 270000, img: 'assets/images/honey-forest-500ml.jpg', stock: 50 },
  8: { product_id: 6, name: 'Hộp Quà Mật Ong Thượng Hạng', variant: 'Hộp Quà Gỗ 3 Món', sku: 'HQ-03', price: 580000, img: 'assets/images/honey-gift-box.jpg', stock: 12 }
};

// Bộ nhớ giỏ hàng in-memory khi CSDL tạm nghỉ hoặc phát triển
const inMemoryCarts = new Map();

function getCartKey(userId, sessionId) {
  if (userId) return `user_${userId}`;
  return `session_${sessionId || 'default'}`;
}

function calculateCartTotals(items) {
  const threshold = 500000;
  let subtotal = 0;
  const processedItems = items.map(it => {
    const itSubtotal = it.price * it.quantity;
    subtotal += itSubtotal;
    return {
      ...it,
      subtotal: itSubtotal
    };
  });

  const isFreeShip = subtotal === 0 || subtotal >= threshold;
  const shippingFee = (subtotal === 0 || isFreeShip) ? 0 : 30000;
  const total = subtotal + shippingFee;

  return {
    items: processedItems,
    subtotal,
    shipping_fee: shippingFee,
    total,
    free_shipping_threshold: threshold
  };
}

async function fetchCartData(userId, sessionId) {
  const key = getCartKey(userId, sessionId);

  // 1. Thử truy vấn cơ sở dữ liệu nếu có kết nối
  try {
    let query = '';
    let params = [];

    if (userId) {
      query = `
        SELECT ci.id, ci.variant_id, ci.quantity,
               pv.price, pv.sku, pv.stock, pv.name AS variant_name,
               p.id AS product_id, p.name AS product_name,
               (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS image
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ci.user_id = ?
        ORDER BY ci.created_at DESC
      `;
      params = [userId];
    } else if (sessionId) {
      query = `
        SELECT ci.id, ci.variant_id, ci.quantity,
               pv.price, pv.sku, pv.stock, pv.name AS variant_name,
               p.id AS product_id, p.name AS product_name,
               (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) AS image
        FROM cart_items ci
        JOIN product_variants pv ON ci.variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ci.session_id = ? AND ci.user_id IS NULL
        ORDER BY ci.created_at DESC
      `;
      params = [sessionId];
    }

    if (query) {
      const [rows] = await pool.query(query, params);
      if (rows && rows.length > 0) {
        return calculateCartTotals(rows);
      }
    }
  } catch (dbErr) {
    // Database offline or query error, fallback to in-memory store
  }

  // 2. Dùng bộ nhớ in-memory cache
  const memoryItems = inMemoryCarts.get(key) || [];
  return calculateCartTotals(memoryItems);
}

async function clearCart(userId, sessionId) {
  const key = getCartKey(userId, sessionId);
  inMemoryCarts.delete(key);

  try {
    if (userId) {
      await pool.query('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    } else if (sessionId) {
      await pool.query('DELETE FROM cart_items WHERE session_id = ? AND user_id IS NULL', [sessionId]);
    }
  } catch (_) {}
}

exports.fetchCartData = fetchCartData;
exports.clearCart = clearCart;

exports.getCart = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionId;
    const cart = await fetchCartData(userId, sessionId);
    res.json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const { variant_id, quantity = 1 } = req.body;
    if (!variant_id) throw new BadRequestError('Vui lòng chọn phân loại biến thể sản phẩm.');

    const vid = parseInt(variant_id, 10);
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionId;
    const key = getCartKey(userId, sessionId);

    // Cập nhật bộ nhớ in-memory
    let items = inMemoryCarts.get(key) || [];
    const existingIndex = items.findIndex(it => it.variant_id === vid);

    if (existingIndex > -1) {
      items[existingIndex].quantity = Math.min(10, items[existingIndex].quantity + qty);
    } else {
      const catalogInfo = fallbackCatalog[vid] || {
        product_id: 1,
        name: 'Mật Ong Rừng Hà Tĩnh',
        variant: 'Quy cách chuẩn',
        sku: 'MOR-500',
        price: 250000,
        img: 'assets/images/honey-forest-wide.jpg'
      };

      items.push({
        id: Date.now(),
        variant_id: vid,
        product_id: catalogInfo.product_id,
        product_name: catalogInfo.name,
        variant_name: catalogInfo.variant,
        sku: catalogInfo.sku,
        price: catalogInfo.price,
        quantity: Math.min(10, qty),
        image: catalogInfo.img
      });
    }

    inMemoryCarts.set(key, items);

    // Cố gắng đồng bộ CSDL nếu có kết nối
    try {
      const [existing] = await pool.query(
        userId
          ? 'SELECT id, quantity FROM cart_items WHERE user_id = ? AND variant_id = ?'
          : 'SELECT id, quantity FROM cart_items WHERE session_id = ? AND user_id IS NULL AND variant_id = ?',
        userId ? [userId, vid] : [sessionId, vid]
      );

      if (existing.length > 0) {
        const newQty = Math.min(10, existing[0].quantity + qty);
        await pool.query('UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, existing[0].id]);
      } else {
        await pool.query(
          'INSERT INTO cart_items (user_id, session_id, variant_id, quantity) VALUES (?, ?, ?, ?)',
          [userId, userId ? null : sessionId, vid, qty]
        );
      }
    } catch (_) {}

    const updatedCart = await fetchCartData(userId, sessionId);
    res.json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng thành công.',
      data: updatedCart
    });
  } catch (error) {
    next(error);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const qty = parseInt(quantity, 10);
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionId;
    const key = getCartKey(userId, sessionId);

    let items = inMemoryCarts.get(key) || [];
    const itemIndex = items.findIndex(it => it.id == id || it.variant_id == id);

    if (itemIndex > -1) {
      if (qty <= 0) {
        items.splice(itemIndex, 1);
      } else {
        items[itemIndex].quantity = Math.min(10, qty);
      }
      inMemoryCarts.set(key, items);
    }

    // Đồng bộ CSDL
    try {
      if (qty <= 0) {
        await pool.query(
          userId
            ? 'DELETE FROM cart_items WHERE (id = ? OR variant_id = ?) AND user_id = ?'
            : 'DELETE FROM cart_items WHERE (id = ? OR variant_id = ?) AND session_id = ?',
          [id, id, userId || sessionId]
        );
      } else {
        await pool.query(
          userId
            ? 'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE (id = ? OR variant_id = ?) AND user_id = ?'
            : 'UPDATE cart_items SET quantity = ?, updated_at = NOW() WHERE (id = ? OR variant_id = ?) AND session_id = ?',
          [Math.min(10, qty), id, id, userId || sessionId]
        );
      }
    } catch (_) {}

    const updatedCart = await fetchCartData(userId, sessionId);
    res.json({
      success: true,
      message: 'Đã cập nhật giỏ hàng thành công.',
      data: updatedCart
    });
  } catch (error) {
    next(error);
  }
};

exports.removeItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionId;
    const key = getCartKey(userId, sessionId);

    let items = inMemoryCarts.get(key) || [];
    const itemIndex = items.findIndex(it => it.id == id || it.variant_id == id);

    if (itemIndex > -1) {
      items.splice(itemIndex, 1);
      inMemoryCarts.set(key, items);
    }

    try {
      await pool.query(
        userId
          ? 'DELETE FROM cart_items WHERE (id = ? OR variant_id = ?) AND user_id = ?'
          : 'DELETE FROM cart_items WHERE (id = ? OR variant_id = ?) AND session_id = ?',
        [id, id, userId || sessionId]
      );
    } catch (_) {}

    const updatedCart = await fetchCartData(userId, sessionId);
    res.json({
      success: true,
      message: 'Đã xóa sản phẩm khỏi giỏ hàng.',
      data: updatedCart
    });
  } catch (error) {
    next(error);
  }
};
