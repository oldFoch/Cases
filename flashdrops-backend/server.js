// flashdrops-backend/server.js
require('dotenv').config();
const app = require('./src/app');

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '127.0.0.1';

// 👉 Запускаем ТОЛЬКО HTTP в dev, чтобы не было SSL-ошибок с Vite-прокси
app.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`🚀 HTTP on http://${shownHost}:${PORT}`);
});
