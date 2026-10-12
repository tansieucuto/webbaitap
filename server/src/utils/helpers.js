/**
 * Format số tiền thành chuỗi VND
 * @param {number} amount Số tiền
 * @returns {string} Chuỗi format VND
 */
const formatVND = (amount) => {
  if (typeof amount !== 'number') return '0 ₫';
  return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

/**
 * Sanitize input
 */
const sanitize = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

module.exports = {
  formatVND,
  sanitize
};
