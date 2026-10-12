const app = require('./app');
const config = require('./config/env');
const pool = require('./config/db');

const startServer = async () => {
  try {
    // Kiểm tra kết nối CSDL
    const connection = await pool.getConnection();
    console.log('✅ Kết nối cơ sở dữ liệu thành công.');
    connection.release();

    app.listen(config.port, () => {
      console.log(`🚀 Server đang chạy tại chế độ ${config.env} trên cổng ${config.port}`);
      console.log(`🔗 API Base URL: ${config.baseUrl}`);
    });
  } catch (error) {
    console.error('❌ Lỗi khởi động server:', error.message);
    process.exit(1);
  }
};

startServer();
