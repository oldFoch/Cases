'use strict';
const http = require('http');
const app = require('./src/app');
const PORT = Number(process.env.PORT) || 5000;

http.createServer(app).listen(PORT, 'localhost', () => {
  console.log(`✅ API listening on http://localhost:${PORT}`);
});
