import { NextResponse } from 'next/server';
import { monitorPricesAndCreateAlerts } from '@/actions/automated-price-monitoring';

export async function POST() {
  try {
    const result = await monitorPricesAndCreateAlerts({
      alertThresholdPercent: 0,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Manual monitoring run failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}