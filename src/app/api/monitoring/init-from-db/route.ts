import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { initializeMonitoringForProducts, monitorPricesAndCreateAlerts } from '@/actions/automated-price-monitoring';

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 50, maxAsins = 0 } = await request.json();
    
    console.log('Starting database ASIN initialization...');
    console.log(`Config: batchSize=${batchSize}, maxAsins=${maxAsins}`);
    
    // Step 1: Fetch unique ASINs from competitive pricing tables
    const uniqueASINs = await fetchUniqueASINsFromDB();
    console.log(`Found ${uniqueASINs.length} unique ASINs`);
    
    if (uniqueASINs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No ASINs found in competitive pricing tables',
        processed: 0,
        alertsCreated: 0
      });
    }

    // Step 2: Check for existing historical data
    const newASINs = await filterNewASINs(uniqueASINs);
    console.log(`${newASINs.length} ASINs need initialization`);

    if (newASINs.length === 0) {
      console.log('All ASINs already have historical data, running monitoring only...');
      
      // Still run monitoring to create alerts
      const monitoringResult = await monitorPricesAndCreateAlerts({
        alertThresholdPercent: 0,
      });

      return NextResponse.json({
        success: true,
        message: 'All ASINs already initialized, ran monitoring only',
        processed: monitoringResult.processed || 0,
        alertsCreated: monitoringResult.alertsCreated || 0,
        alreadyInitialized: uniqueASINs.length
      });
    }

    // Step 3: Limit ASINs if specified
    let asinsToProcess = newASINs;
    if (maxAsins > 0 && newASINs.length > maxAsins) {
      asinsToProcess = newASINs.slice(0, maxAsins);
      console.log(`Limited to first ${maxAsins} ASINs`);
    }

    // Step 4: Process in batches
    let totalProcessed = 0;
    let totalFailed = 0;
    
    const batches = createBatches(asinsToProcess, batchSize);
    console.log(`Processing ${asinsToProcess.length} ASINs in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} ASINs)`);
      
      try {
        const result = await initializeMonitoringForProducts(batch);
        
        if (result.success) {
          totalProcessed += result.initialized || 0;
          totalFailed += result.failed || 0;
          console.log(`Batch ${i + 1} completed: ${result.initialized} initialized, ${result.failed} failed`);
        } else {
          console.error(`Batch ${i + 1} failed: ${result.error}`);
          totalFailed += batch.length;
        }
      } catch (error) {
        console.error(`Batch ${i + 1} error:`, error);
        totalFailed += batch.length;
      }
      
      // Small delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Step 5: Run monitoring to create alerts
    console.log('Running price monitoring to create alerts...');
    const monitoringResult = await monitorPricesAndCreateAlerts({
      alertThresholdPercent: 0,
    });

    console.log('Initialization complete!');
    
    return NextResponse.json({
      success: true,
      message: 'Historical data initialization completed',
      totalASINsFound: uniqueASINs.length,
      asinsProcessed: asinsToProcess.length,
      initialized: totalProcessed,
      failed: totalFailed,
      successRate: Math.round((totalProcessed / asinsToProcess.length) * 100),
      monitoring: {
        processed: monitoringResult.processed || 0,
        alertsCreated: monitoringResult.alertsCreated || 0
      }
    });

  } catch (error) {
    console.error('Initialization failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to fetch unique ASINs from database
async function fetchUniqueASINsFromDB(): Promise<string[]> {
  try {
    // Get ASINs from main competitive pricing
    const mainPricing = await prisma.aMZN_competitive_pricing_main.findMany({
      select: {
        Product_Identifiers_MarketplaceASIN_ASIN: true,
      },
      where: {
        Product_Identifiers_MarketplaceASIN_ASIN: {
          not: null
        }
      }
    });

    // Get ASINs from competitor pricing
    const competitorPricing = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      select: {
        Product_Identifiers_MarketplaceASIN_ASIN: true,
      },
      where: {
        Product_Identifiers_MarketplaceASIN_ASIN: {
          not: null
        }
      }
    });

    // Get ASINs from product list
    const productList = await prisma.aMZN_PRODUCT_LIST.findMany({
      select: {
        asin1: true,
      },
    });

    // Combine and deduplicate
    const allASINs = new Set<string>();
    
    mainPricing.forEach(item => {
      if (item.Product_Identifiers_MarketplaceASIN_ASIN) {
        allASINs.add(item.Product_Identifiers_MarketplaceASIN_ASIN);
      }
    });

    competitorPricing.forEach(item => {
      if (item.Product_Identifiers_MarketplaceASIN_ASIN) {
        allASINs.add(item.Product_Identifiers_MarketplaceASIN_ASIN);
      }
    });

    productList.forEach(item => {
      if (item.asin1) {
        allASINs.add(item.asin1);
      }
    });

    return Array.from(allASINs);
    
  } catch (error) {
    console.error('Error fetching ASINs from database:', error);
    return [];
  }
}

// Helper function to filter ASINs that need initialization
async function filterNewASINs(asins: string[]): Promise<string[]> {
  try {
    const existingASINs = await prisma.competitive_historical_prices.findMany({
      select: { asin: true },
      where: {
        asin: { in: asins }
      },
      distinct: ['asin']
    });

    const existingSet = new Set(existingASINs.map(item => item.asin));
    return asins.filter(asin => !existingSet.has(asin));
    
  } catch (error) {
    console.error('Error checking existing ASINs:', error);
    return asins; // Return all if check fails
  }
}

// Helper function to create batches
function createBatches<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}