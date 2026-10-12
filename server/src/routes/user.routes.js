const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.patch('/password', userController.changePassword);
router.get('/addresses', userController.listAddresses);
router.post('/addresses', userController.addAddress);
router.patch('/addresses/:id', userController.updateAddress);
router.delete('/addresses/:id', userController.deleteAddress);

module.exports = router;
