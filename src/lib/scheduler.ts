// Note: node-cron is a Node.js module and should only be used in server-side contexts
// For Next.js App Router, use API routes or middleware instead
// Example: Use /src/app/api/cron/monitor-prices/route.ts with Vercel Cron Jobs or similar

// Uncomment below if using this in a Node.js server context (not Next.js browser/edge)
// import cron from 'node-cron';
// import { monitorPricesAndCreateAlerts, cleanupOldMonitoringData } from '@/actions/automated-price-monitoring';

// This function should only be called from server-side contexts (API routes, middleware, or edge functions)
export function startPriceMonitoringScheduler() {
  // If using node-cron in a Node.js environment:
  // cron.schedule('0 * * * *', async () => {
  //   console.log('⏰ Running scheduled price monitoring...');
  //   try {
  //     await monitorPricesAndCreateAlerts({
  //       alertThresholdPercent: 0,
  //     });
  //   } catch (error) {
  //     console.error('Scheduled monitoring failed:', error);
  //   }
  // });

  // cron.schedule('0 2 * * *', async () => {
  //   console.log('🧹 Running scheduled cleanup...');
  //   try {
  //     await cleanupOldMonitoringData();
  //   } catch (error) {
  //     console.error('Scheduled cleanup failed:', error);
  //   }
  // });

  console.log('📅 Price monitoring scheduler configuration ready');
  console.log('   Use API routes with external cron service (Vercel Cron, EasyCron, etc.)');
}
