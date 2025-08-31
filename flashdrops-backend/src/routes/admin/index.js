// flashdrops-backend/src/routes/admin/index.js
// (если у тебя уже есть общий adminRoutes — просто подключи ниже этот саб-роутер.
// ИЛИ импортируй этот файл как '/api/admin/cases' в app.js)
'use strict';
const express = require('express');

const router = express.Router();

router.use('/cases', require('./casesAdminRoutes'));

module.exports = router;
