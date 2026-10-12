const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

// Middleware bọc kết quả validation của express-validator
const validate = (validations) => {
  return async (req, res, next) => {
    // Thực thi các luật validation
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Lấy lỗi đầu tiên hoặc mảng các lỗi
    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));

    next(new ValidationError('Dữ liệu không hợp lệ', extractedErrors));
  };
};

module.exports = validate;
