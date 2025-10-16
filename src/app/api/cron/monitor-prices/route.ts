import { NextRequest, NextResponse } from 'next/server';
import { monitorPricesAndCreateAlerts, cleanupOldMonitoringData } from '@/actions/automated-price-monitoring';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = request.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🚀 Starting scheduled price monitoring...');
    
    // Run price monitoring
    const monitoringResult = await monitorPricesAndCreateAlerts({
      alertThresholdPercent: 0, // 10% change threshold
      enabledASINs: [], // Empty means monitor all available ASINs
      enabledSKUs: []   // Empty means monitor all available SKUs
    });

    // Run cleanup once per day (you can add logic to check if cleanup should run)
    const shouldRunCleanup = new Date().getHours() === 2; // Run at 2 AM
    let cleanupResult = null;
    
    if (shouldRunCleanup) {
      cleanupResult = await cleanupOldMonitoringData();
    }
    
    return NextResponse.json({
      success: true,
      monitoring: monitoringResult,
      cleanup: cleanupResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
// .env.local example
/*
DATABASE_URL="your-database-url"
CRON_SECRET="your-secret-cron-key-here"
*/

// vercel.json example
/*
{
  "crons": [
    {
      "path": "/api/cron/monitor-prices",
      "schedule": "0 * * * *"
    }
  ]
}
*/