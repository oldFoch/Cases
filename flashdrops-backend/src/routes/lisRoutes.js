// flashdrops-backend/src/routes/lisRoutes.js
'use strict';

/**
 * Заглушка для LIS-маршрутов, чтобы бэк не падал из-за отсутствующих зависимостей.
 * Если LIS не используешь — этого файла достаточно. Он даёт живой /api/lis/health.
 * Если захочешь вернуть настоящую интеграцию — подключай здесь реальную логику.
 */

const express = require('express');
const router = express.Router();

// простая проверка здоровья
router.get('/health', (_req, res) => {
  res.json({ ok: true, provider: 'lis', stub: true });
});

// на всякий случай мягкий ответ на неизвестные пути в /api/lis/*
router.all('*', (_req, res) => {
  res.status(200).json({ ok: true, provider: 'lis', stub: true });
});

module.exports = router;
