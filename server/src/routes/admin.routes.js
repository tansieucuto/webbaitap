const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));

router.get('/orders', adminController.listOrders);
router.patch('/orders/:orderCode/status', adminController.updateOrderStatus);
router.get('/products', adminController.listProducts);
router.post('/products', adminController.createProduct);
router.patch('/products/:id', adminController.updateProduct);
router.patch('/products/:id/variants', adminController.manageVariants);
router.get('/dashboard', adminController.getDashboard);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
