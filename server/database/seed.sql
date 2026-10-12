USE tovang_db;

-- Admin User
INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active)
VALUES (
    'admin@tovang.vn',
    '$argon2id$v=19$m=65536,t=3,p=4$rYx2+jG3xUo2/ZqO9Qe0tw$L5jV+F0hG1e9T4tWvJz2xN8/I6dK9R5aP0gC3bQ4', -- placeholder hash
    'Quản trị viên',
    '0901234567',
    'admin',
    TRUE,
    TRUE
);

-- Product
INSERT INTO products (name, slug, description, short_description, origin, ingredients, shelf_life, is_active)
VALUES (
    'Mật ong rừng Hà Tĩnh',
    'mat-ong-rung-ha-tinh',
    'Mật ong rừng tự nhiên nguyên chất từ vùng núi Hà Tĩnh, được thu hoạch thủ công.',
    'Mật ong nguyên chất 100% từ tự nhiên.',
    'Hà Tĩnh, Việt Nam',
    '100% mật ong rừng',
    '24 tháng',
    TRUE
);

SET @product_id = LAST_INSERT_ID();

-- Product Variants
INSERT INTO product_variants (product_id, name, sku, price, stock, weight_grams, sort_order)
VALUES 
    (@product_id, '500ml', 'MOR-HT-500', 250000, 100, 700, 1),
    (@product_id, '1 lít', 'MOR-HT-1000', 450000, 50, 1400, 2);

-- Settings
INSERT INTO settings (`key`, value) VALUES
    ('shipping_fee', '30000'),
    ('free_shipping_threshold', '500000'),
    ('demo_mode', 'true'),
    ('max_cod_pending', '2'),
    ('vnpay_timeout_minutes', '15'),
    ('transfer_timeout_hours', '24');
