const { AppError } = require('../utils/errors');
const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Lỗi không phải là AppError
  if (!(error instanceof AppError)) {
    console.error('Unexpected Error:', err);
    const statusCode = error.statusCode || 500;
    const message = config.env === 'development' ? err.message : 'Đã có lỗi xảy ra từ máy chủ';
    error = new AppError(message, statusCode);
  }

  const response = {
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(config.env === 'development' && { stack: err.stack }),
  };

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
