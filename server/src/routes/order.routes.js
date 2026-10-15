const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth');

// Cho phép tạo đơn và xem chi tiết theo mã đơn (hỗ trợ cả khách & tài khoản)
router.post('/', orderController.createOrder);
router.get('/:orderCode', orderController.getOrder);
router.post('/:orderCode/demo-pay', orderController.demoPay);
router.post('/:orderCode/pay-again', authenticate, orderController.payAgain);

// Các thao tác quản lý đơn cá nhân yêu cầu đăng nhập
router.get('/', authenticate, orderController.listOrders);
router.post('/:orderCode/cancel', authenticate, orderController.cancelOrder);

module.exports = router;
