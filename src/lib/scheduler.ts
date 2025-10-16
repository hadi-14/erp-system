import cron from 'node-cron';
import { monitorPricesAndCreateAlerts, cleanupOldMonitoringData } from '@/actions/automated-price-monitoring';

export function startPriceMonitoringScheduler() {
  // Run price monitoring every hour
  cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running scheduled price monitoring...');
    try {
      await monitorPricesAndCreateAlerts({
        alertThresholdPercent: 0,
      });
    } catch (error) {
      console.error('Scheduled monitoring failed:', error);
    }
  });

  // Run cleanup daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running scheduled cleanup...');
    try {
      await cleanupOldMonitoringData();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  });

  console.log('📅 Price monitoring scheduler started');
}
