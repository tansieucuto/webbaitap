const { AuthenticationError, AuthorizationError } = require('../utils/errors');

// Middleware xác thực (kiểm tra session)
const authenticate = (req, res, next) => {
  // Giả định session được lưu ở req.session.user
  // Sẽ tích hợp với cookie/session middleware sau
  if (!req.user && !req.session?.user) {
    return next(new AuthenticationError('Vui lòng đăng nhập để thực hiện chức năng này.'));
  }
  
  // Gắn thông tin user vào req.user nếu dùng session object
  if (!req.user && req.session?.user) {
    req.user = req.session.user;
  }

  next();
};

// Middleware kiểm tra quyền
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Vui lòng đăng nhập.'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError('Bạn không có quyền thực hiện thao tác này.'));
    }
    
    next();
  };
};

// Middleware kiểm tra đã xác thực email
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return next(new AuthenticationError('Vui lòng đăng nhập.'));
  }
  
  if (!req.user.is_verified) {
    return next(new AuthorizationError('Vui lòng xác thực email để thực hiện chức năng này.'));
  }
  
  next();
};

module.exports = {
  authenticate,
  requireRole,
  requireVerified
};
