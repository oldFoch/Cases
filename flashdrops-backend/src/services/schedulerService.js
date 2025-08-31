const { syncWaxpeer } = require('./waxpeerService');
const { syncUniqueOnce } = require('./uniqueService');

const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 минут

async function runScheduledSync() {
  try {
    console.log('🚀 Запуск планового обновления цен...');
    
    const waxpeerResult = await syncWaxpeer();
    if (waxpeerResult.ok) {
      console.log(`✅ Waxpeer: обновлено ${waxpeerResult.count} предметов`);
    } else {
      console.log('❌ Waxpeer: ошибка', waxpeerResult.error);
    }

    const uniqueResult = await syncUniqueOnce();
    if (uniqueResult.ok) {
      console.log(`✅ Unique items: обновлено ${uniqueResult.count} предметов`);
    } else {
      console.log('❌ Unique items: ошибка', uniqueResult.error);
    }

    console.log('✅ Плановое обновление завершено');
  } catch (error) {
    console.error('❌ Ошибка в плановом обновлении:', error.message);
  }
}

function startScheduler() {
  console.log('⏰ Планировщик запущен (обновление каждые 30 минут)');
  
  // Запускаем сразу при старте
  runScheduledSync();
  
  // И каждые 30 минут
  setInterval(runScheduledSync, UPDATE_INTERVAL);
}

module.exports = { startScheduler, runScheduledSync };