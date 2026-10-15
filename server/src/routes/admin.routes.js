const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const uploadMiddleware = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Đơn hàng
router.get('/orders', adminController.listOrders);
router.patch('/orders/:orderCode/status', adminController.updateOrderStatus);

// Sản phẩm & kho
router.get('/products', adminController.listProducts);
router.post('/products', adminController.createProduct);
router.patch('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);
router.patch('/products/:id/variants', adminController.manageVariants);

// Upload ảnh sản phẩm
router.post('/uploads/product-image', uploadMiddleware.single('image'), adminController.uploadProductImage);

// Khách hàng
router.get('/customers', adminController.listCustomers);

// Đánh giá
router.get('/reviews', adminController.listReviews);
router.patch('/reviews/:id', adminController.updateReviewStatus);

// Nhật ký kiểm toán
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
