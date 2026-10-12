const pool = require('../config/db');

exports.createReview = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Đánh giá thành công' });
  } catch (error) {
    next(error);
  }
};

exports.listReviews = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};
