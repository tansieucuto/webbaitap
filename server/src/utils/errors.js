class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu đầu vào không hợp lệ', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Chưa xác thực') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Không có quyền truy cập') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError
};
