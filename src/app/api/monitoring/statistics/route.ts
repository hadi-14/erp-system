import { NextResponse } from 'next/server';
import { getMonitoringStatistics } from '@/actions/automated-price-monitoring';

export async function GET() {
  try {
    const result = await getMonitoringStatistics();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to get monitoring statistics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
