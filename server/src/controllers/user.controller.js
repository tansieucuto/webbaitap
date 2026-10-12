const pool = require('../config/db');

exports.getProfile = async (req, res, next) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    next(error);
  }
};

exports.listAddresses = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

exports.addAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Thêm địa chỉ thành công' });
  } catch (error) {
    next(error);
  }
};

exports.updateAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Cập nhật địa chỉ thành công' });
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Xóa địa chỉ thành công' });
  } catch (error) {
    next(error);
  }
};
