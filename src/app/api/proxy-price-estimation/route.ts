// app/api/proxy-price-estimation/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface FeeEstimateResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<FeeEstimateResponse>> {
  const { searchParams } = new URL(request.url);
  
  const asin = searchParams.get('asin');
  const price = searchParams.get('price');
  const currency = searchParams.get('currency');

  // Validate required parameters
  if (!asin || !price || !currency) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Missing required parameters: asin, price, currency' 
      },
      { status: 400 }
    );
  }

  // Validate price is a number
  const priceNum = parseFloat(price);
  if (isNaN(priceNum)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Price must be a valid number' 
      },
      { status: 400 }
    );
  }

  try {
    // Call the insecure HTTP API from your backend (server-side is safe)
    const apiUrl = `http://212.85.24.65:5000/api/get-price-estimation?asin=${encodeURIComponent(asin)}&price=${price}&currency=${currency}`;
    
    console.log('Calling external API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`External API returned status ${response.status}`);
    }

    const data = (await response.json()).data;
    
    return NextResponse.json({ 
      success: true, 
      data
    });
  } catch (error) {
    console.error('Price estimation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to fetch price estimation: ${errorMessage}` 
      },
      { status: 500 }
    );
  }
}