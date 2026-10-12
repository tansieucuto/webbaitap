const pool = require('../config/db');

// Fallback danh mục sản phẩm cao cấp nếu CSDL bảo trì hoặc chưa sẵn sàng
const fallbackProducts = [
  {
    id: 1,
    name: 'Mật Ong Rừng Đặc Biệt',
    slug: 'mat-ong-rung-dac-biet',
    description: 'Chiết xuất từ những bọng ong khoái tự nhiên tại đại ngàn Vũ Quang, đạt độ sánh chuẩn 1.42 tỷ trọng và hương thơm nồng nàn.',
    short_description: 'Mật ong rừng già Vũ Quang tuyển chọn mùa xuân.',
    origin: 'Vũ Quang, Hà Tĩnh',
    ingredients: '100% mật ong rừng thô tự nhiên',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1952-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 5.0,
    review_count: 18,
    primary_image: 'assets/images/honey-forest-wide.jpg',
    images: [{ url: 'assets/images/honey-forest-wide.jpg' }],
    variants: [
      { id: 1, product_id: 1, name: 'Hũ Thủy Tinh 500ml', sku: 'MOR-500', price: 280000, stock: 45 },
      { id: 2, product_id: 1, name: 'Chai Rót Cao Cấp 1000ml', sku: 'MOR-1000', price: 520000, stock: 30 }
    ]
  },
  {
    id: 2,
    name: 'Mật Ong Hoa Rừng Cổ Thụ',
    slug: 'mat-ong-hoa-rung-co-thu',
    description: 'Thu hoạch từ các tầng tán cây cổ thụ trăm năm tuổi, sắc nâu hổ phách sẫm, hậu vị sâu lắng đặc trưng.',
    short_description: 'Mật ong tầng tán rừng nguyên sinh.',
    origin: 'Hương Khê, Hà Tĩnh',
    ingredients: '100% mật ong rừng tự nhiên',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1953-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 4.9,
    review_count: 14,
    primary_image: 'assets/images/honey-deep-ancient.jpg',
    images: [{ url: 'assets/images/honey-deep-ancient.jpg' }],
    variants: [
      { id: 3, product_id: 2, name: 'Hũ Thủy Tinh 500ml', sku: 'MCT-500', price: 310000, stock: 25 },
      { id: 4, product_id: 2, name: 'Hũ Gốm Mộc 750ml', sku: 'MCT-750', price: 460000, stock: 20 }
    ]
  },
  {
    id: 3,
    name: 'Mật Ong Kem Hoa Bạc Hà',
    slug: 'mat-ong-kem-hoa-bac-ha',
    description: 'Kết tinh tự nhiên thành kết cấu kem mềm mịn như nhung, mang vị ngọt thanh thoát và the nhẹ quý giá.',
    short_description: 'Mật ong kem kết tinh tự nhiên.',
    origin: 'Dãy Giăng Màn, Hà Tĩnh',
    ingredients: '100% mật ong hoa bạc hà rừng',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1954-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 5.0,
    review_count: 22,
    primary_image: 'assets/images/honey-creamed-velvet.jpg',
    images: [{ url: 'assets/images/honey-creamed-velvet.jpg' }],
    variants: [
      { id: 5, product_id: 3, name: 'Hũ Thủy Tinh 380ml', sku: 'MBH-380', price: 295000, stock: 15 }
    ]
  },
  {
    id: 4,
    name: 'Mật Ong Hoa Cam Rừng',
    slug: 'mat-ong-hoa-cam-rung',
    description: 'Hương thơm thanh tao ngát hương hoa cam rừng nở rộ đầu hạ, màu vàng óng ả sóng sánh đầy sức sống.',
    short_description: 'Mật ong hoa cam rừng thanh mát.',
    origin: 'Thượng nguồn sông Ngàn Sâu, Hà Tĩnh',
    ingredients: '100% mật ong hoa cam tự nhiên',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1955-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 4.8,
    review_count: 9,
    primary_image: 'assets/images/honey-citrus-blossom.jpg',
    images: [{ url: 'assets/images/honey-citrus-blossom.jpg' }],
    variants: [
      { id: 6, product_id: 4, name: 'Hũ Thủy Tinh 500ml', sku: 'MHC-500', price: 260000, stock: 35 }
    ]
  },
  {
    id: 5,
    name: 'Mật Ong Rừng Hũ Thủy Tinh',
    slug: 'mat-ong-rung-hu-thuy-tinh',
    description: 'Dòng sản phẩm truyền thống thân thiện cho gia đình, thu hoạch thủ công gìn giữ trọn vẹn enzyme sống.',
    short_description: 'Mật ong rừng thô nguyên chất hũ 500ml.',
    origin: 'Hương Khê, Hà Tĩnh',
    ingredients: '100% mật ong rừng nguyên chất',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1956-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 4.9,
    review_count: 31,
    primary_image: 'assets/images/honey-forest-500ml.jpg',
    images: [{ url: 'assets/images/honey-forest-500ml.jpg' }],
    variants: [
      { id: 7, product_id: 5, name: 'Hũ Thủy Tinh 500ml', sku: 'MRH-500', price: 270000, stock: 50 }
    ]
  },
  {
    id: 6,
    name: 'Hộp Quà Mật Ong Thượng Hạng',
    slug: 'hop-qua-mat-ong-thuong-hang',
    description: 'Bộ quà tặng cao cấp gồm 3 hũ mật ong tuyển chọn đặt trong hộp gỗ thông điêu khắc tinh xảo kèm muỗng gỗ dẻ gai.',
    short_description: 'Bộ quà tặng ba mùa hoa rừng sang trọng.',
    origin: 'Hà Tĩnh, Việt Nam',
    ingredients: '100% mật ong rừng ba mùa hoa',
    shelf_life: '24 tháng',
    self_declaration_number: 'CB-1957-HT/2026',
    warning_text: 'Không dùng cho trẻ em dưới 1 tuổi.',
    average_rating: 5.0,
    review_count: 27,
    primary_image: 'assets/images/honey-gift-box.jpg',
    images: [{ url: 'assets/images/honey-gift-box.jpg' }],
    variants: [
      { id: 8, product_id: 6, name: 'Hộp Quà Gỗ 3 Món (3x250ml)', sku: 'HQ-03', price: 580000, stock: 20 }
    ]
  }
];

exports.listProducts = async (req, res, next) => {
  try {
    const [products] = await pool.query('SELECT * FROM products WHERE is_active = TRUE ORDER BY id ASC');
    
    // Nạp kèm biến thể và hình ảnh cho từng sản phẩm
    for (let p of products) {
      const [variants] = await pool.query('SELECT * FROM product_variants WHERE product_id = ? AND is_active = TRUE ORDER BY sort_order ASC', [p.id]);
      const [images] = await pool.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [p.id]);
      p.variants = variants;
      p.images = images;
      p.primary_image = images.find(img => img.is_primary)?.url || images[0]?.url || 'assets/images/honey-forest-wide.jpg';
    }

    res.json({ success: true, data: products });
  } catch (error) {
    console.warn('⚠️ CSDL chưa sẵn sàng, trả về danh mục dự phòng:', error.message);
    res.json({ success: true, data: fallbackProducts });
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const [products] = await pool.query('SELECT * FROM products WHERE slug = ?', [slug]);
    
    if (products.length === 0) {
      const fb = fallbackProducts.find(p => p.slug === slug);
      if (fb) return res.json({ success: true, data: fb });
      return res.status(404).json({ success: false, error: { message: 'Không tìm thấy sản phẩm' } });
    }

    const product = products[0];
    const [variants] = await pool.query('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC', [product.id]);
    const [images] = await pool.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC', [product.id]);
    
    product.variants = variants;
    product.images = images;
    product.primary_image = images.find(img => img.is_primary)?.url || images[0]?.url || 'assets/images/honey-forest-wide.jpg';

    // Đánh giá
    const [reviews] = await pool.query(
      `SELECT r.*, u.full_name as author_name
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC LIMIT 10`,
      [product.id]
    );
    product.recent_reviews = reviews;

    res.json({ success: true, data: product });
  } catch (error) {
    console.warn('⚠️ CSDL chưa sẵn sàng, trả về chi tiết sản phẩm dự phòng:', error.message);
    const { slug } = req.params;
    const fb = fallbackProducts.find(p => p.slug === slug) || fallbackProducts[0];
    res.json({ success: true, data: fb });
  }
};

