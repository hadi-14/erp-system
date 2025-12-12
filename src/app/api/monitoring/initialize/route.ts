import { NextRequest, NextResponse } from 'next/server';
import { initializeMonitoringForProducts } from '@/actions/automated-price-monitoring';

export async function POST(request: NextRequest) {
  try {
    const { asins } = await request.json();
    
    if (!asins || !Array.isArray(asins)) {
      return NextResponse.json(
        { error: 'ASINs array is required' },
        { status: 400 }
      );
    }

    const result = await initializeMonitoringForProducts(asins);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Failed to initialize monitoring:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}