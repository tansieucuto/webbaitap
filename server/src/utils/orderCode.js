const { customAlphabet } = require('nanoid');

// Sinh mã đơn hàng dạng TV-XXXXXXXX
// X bao gồm chữ cái in hoa và số
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);

const generateOrderCode = () => {
  return `TV-${nanoid()}`;
};

module.exports = generateOrderCode;
