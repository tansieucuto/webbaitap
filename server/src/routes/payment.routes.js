const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');

router.get('/vnpay-return', paymentController.vnpayReturn);
router.get('/vnpay-ipn', paymentController.vnpayIpn);

module.exports = router;
