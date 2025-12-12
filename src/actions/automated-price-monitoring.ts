'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from 'next/cache';
import { compareAndCreateAlerts, storeHistoricalPrice } from './price-alerts';

// Types
export interface CompetitivePricingFilters {
  searchTerm?: string;
  statusFilter?: string;
  alertFilter?: string;
  page?: number;
  limit?: number;
}

export interface CompetitivePricingData {
  id: number;
  SellerSKU: string | null;
  status: string | null;
  Product_Identifiers_MarketplaceASIN_ASIN: string | null;
  created_at: Date | null;
  updated_at?: Date | null;
  competitive_prices: Array<{
    id: number;
    price_amount: number | null;
    price_currency: string | null;
    condition: string | null;
    fulfillment_channel: string | null;
    belongs_to_requester: boolean | null;
    shipping_amount: number | null;
    shipping_currency: string | null;
    created_at: Date | null;
  }>;
  sales_rankings: Array<{
    id: number;
    product_category_id: string | null;
    rank: bigint | null;
    created_at: Date | null;
  }>;
  offer_listings: Array<{
    id: number;
    condition: string | null;
    count: bigint | null;
    created_at: Date | null;
  }>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RelatedData {
  ourData: CompetitivePricingData | null;
  competitorData: CompetitivePricingData[];
}

interface CompetitorPrice {
  asin: string;
  seller_sku?: string;
  price: number;
  currency: string;
  condition: string;
  fulfillment_channel?: string;
  competitor_name?: string;
  product_name?: string;
  rank?: number | null;
  isCompetitor?: boolean;
}

interface PriceMonitoringConfig {
  alertThresholdPercent: number;
  monitoringInterval: number;
  enabledASINs?: string[];
  enabledSKUs?: string[];
  competitorSellerIds?: string[];
}

// Default configuration
const defaultConfig: PriceMonitoringConfig = {
  alertThresholdPercent: 0,
  monitoringInterval: 1,
  enabledASINs: [],
  enabledSKUs: [],
  competitorSellerIds: [],
};

export async function getCompetitivePricingData(
  filters: CompetitivePricingFilters = {}
): Promise<PaginatedResult<CompetitivePricingData>> {
  try {
    const {
      searchTerm = '',
      statusFilter = 'all',
      alertFilter = 'all',
      page = 1,
      limit = 10
    } = filters;

    const skip = (page - 1) * limit;

    let whereClause: any = {};

    if (searchTerm) {
      whereClause.OR = [
        {
          SellerSKU: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          Product_Identifiers_MarketplaceASIN_ASIN: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }

    if (alertFilter !== 'all') {
      const alertWhereClause = await buildAlertFilterClause(alertFilter);
      whereClause = { ...whereClause, ...alertWhereClause };
    }

    const total = await prisma.aMZN_competitive_pricing_main.count({
      where: whereClause
    });

    const rawData = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        competitive_prices: {
          orderBy: { created_at: 'desc' }
        },
        sales_rankings: {
          orderBy: { created_at: 'desc' }
        },
        offer_listings: {
          orderBy: { created_at: 'desc' }
        }
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    });

    const data = rawData.map(item => ({
      id: Number(item.id),
      SellerSKU: item.SellerSKU,
      status: item.status,
      Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
      created_at: item.created_at,
      competitive_prices: item.competitive_prices.map(price => ({
        id: Number(price.id),
        price_amount: price.price_amount,
        price_currency: price.price_currency,
        condition: price.condition,
        fulfillment_channel: price.fulfillment_channel,
        belongs_to_requester: price.belongs_to_requester,
        shipping_amount: price.shipping_amount,
        shipping_currency: price.shipping_currency,
        created_at: price.created_at
      })),
      sales_rankings: item.sales_rankings.map(ranking => ({
        id: Number(ranking.id),
        product_category_id: ranking.product_category_id,
        rank: ranking.rank,
        created_at: ranking.created_at
      })),
      offer_listings: item.offer_listings.map(offer => ({
        id: Number(offer.id),
        condition: offer.condition,
        count: offer.count,
        created_at: offer.created_at
      }))
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    console.error('Error fetching competitive pricing data:', error);
    throw new Error('Failed to fetch competitive pricing data');
  }
}

async function buildAlertFilterClause(alertFilter: string) {
  let alertWhereClause: any = {};

  switch (alertFilter) {
    case 'with_alerts': {
      const activeAlertAsinsSku = await prisma.price_change_alerts.findMany({
        where: { is_dismissed: false },
        select: { asin: true, seller_sku: true }
      });

      const asinsWithAlerts = [...new Set(activeAlertAsinsSku.map(a => a.asin))];
      const skusWithAlerts = [...new Set(activeAlertAsinsSku.map(a => a.seller_sku).filter(Boolean))];

      alertWhereClause.OR = [
        { Product_Identifiers_MarketplaceASIN_ASIN: { in: asinsWithAlerts } },
        ...(skusWithAlerts.length > 0 ? [{ SellerSKU: { in: skusWithAlerts } }] : [])
      ];
      break;
    }

    case 'without_alerts': {
      const activeAlertAsinsSkuExclude = await prisma.price_change_alerts.findMany({
        where: { is_dismissed: false },
        select: { asin: true, seller_sku: true }
      });

      const asinsToExclude = [...new Set(activeAlertAsinsSkuExclude.map(a => a.asin))];
      const skusToExclude = [...new Set(activeAlertAsinsSkuExclude.map(a => a.seller_sku).filter(Boolean))];

      alertWhereClause.AND = [
        { Product_Identifiers_MarketplaceASIN_ASIN: { notIn: asinsToExclude } },
        ...(skusToExclude.length > 0 ? [{ SellerSKU: { notIn: skusToExclude } }] : [])
      ];
      break;
    }

    case 'critical_alerts': {
      const criticalAlertAsinsSku = await prisma.price_change_alerts.findMany({
        where: {
          is_dismissed: false,
          priority: 'critical'
        },
        select: { asin: true, seller_sku: true }
      });

      const criticalAsins = [...new Set(criticalAlertAsinsSku.map(a => a.asin))];
      const criticalSkus = [...new Set(criticalAlertAsinsSku.map(a => a.seller_sku).filter(Boolean))];

      alertWhereClause.OR = [
        { Product_Identifiers_MarketplaceASIN_ASIN: { in: criticalAsins } },
        ...(criticalSkus.length > 0 ? [{ SellerSKU: { in: criticalSkus } }] : [])
      ];
      break;
    }

    case 'high_alerts': {
      const highAlertAsinsSku = await prisma.price_change_alerts.findMany({
        where: {
          is_dismissed: false,
          priority: { in: ['critical', 'high'] }
        },
        select: { asin: true, seller_sku: true }
      });

      const highAsins = [...new Set(highAlertAsinsSku.map(a => a.asin))];
      const highSkus = [...new Set(highAlertAsinsSku.map(a => a.seller_sku).filter(Boolean))];

      alertWhereClause.OR = [
        { Product_Identifiers_MarketplaceASIN_ASIN: { in: highAsins } },
        ...(highSkus.length > 0 ? [{ SellerSKU: { in: highSkus } }] : [])
      ];
      break;
    }
  }

  return alertWhereClause;
}

export async function getCompetitivePricingStats() {
  try {
    const [
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
      activeAlerts,
      productsWithAlerts
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.count(),
      prisma.aMZN_competitive_pricing_main.count({
        where: { status: 'Active' }
      }),
      prisma.aMZN_competitive_prices.count(),
      prisma.aMZN_sales_rankings.count(),
      prisma.price_change_alerts.count({
        where: { is_dismissed: false }
      }),
      prisma.price_change_alerts.findMany({
        where: { is_dismissed: false },
        select: { asin: true, seller_sku: true },
        distinct: ['asin', 'seller_sku']
      }).then(alerts => {
        const uniqueProducts = new Set();
        alerts.forEach(alert => {
          uniqueProducts.add(`${alert.asin}-${alert.seller_sku || 'null'}`);
        });
        return uniqueProducts.size;
      })
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
      activeAlerts,
      productsWithAlerts
    };
  } catch (error) {
    console.error('Error fetching competitive pricing stats:', error);
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalPricePoints: 0,
      totalSalesRankings: 0,
      activeAlerts: 0,
      productsWithAlerts: 0
    };
  }
}

export async function getCompetitionCompetitivePricingData(
  filters: CompetitivePricingFilters = {}
): Promise<PaginatedResult<CompetitivePricingData>> {
  try {
    const {
      searchTerm = '',
      statusFilter = 'all',
      page = 1,
      limit = 10
    } = filters;

    const skip = (page - 1) * limit;

    let whereClause: any = {};

    if (searchTerm) {
      whereClause.OR = [
        {
          SellerSKU: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          Product_Identifiers_MarketplaceASIN_ASIN: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }

    const total = await prisma.aMZN_competitive_pricing_main_competitors.count({
      where: whereClause
    });

    const rawData = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      where: whereClause,
      include: {
        competitive_prices: {
          orderBy: { created_at: 'desc' }
        },
        sales_rankings: {
          orderBy: { created_at: 'desc' }
        },
        offer_listings: {
          orderBy: { created_at: 'desc' }
        }
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    });

    const data = rawData.map(item => ({
      id: Number(item.id),
      SellerSKU: item.SellerSKU,
      status: item.status,
      Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
      created_at: item.created_at,
      competitive_prices: item.competitive_prices.map(price => ({
        id: Number(price.id),
        price_amount: price.price_amount,
        price_currency: price.price_currency,
        condition: price.condition,
        fulfillment_channel: price.fulfillment_channel,
        belongs_to_requester: price.belongs_to_requester,
        shipping_amount: price.shipping_amount,
        shipping_currency: price.shipping_currency,
        created_at: price.created_at
      })),
      sales_rankings: item.sales_rankings.map(ranking => ({
        id: Number(ranking.id),
        product_category_id: ranking.product_category_id,
        rank: ranking.rank,
        created_at: ranking.created_at
      })),
      offer_listings: item.offer_listings.map(offer => ({
        id: Number(offer.id),
        condition: offer.condition,
        count: offer.count,
        created_at: offer.created_at
      }))
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    console.error('Error fetching competitor competitive pricing data:', error);
    throw new Error('Failed to fetch competitor competitive pricing data');
  }
}

export async function getRelatedCompetitivePricingData(
  asin?: string,
  sellerSku?: string
): Promise<RelatedData> {
  try {
    if (!asin && !sellerSku) {
      return {
        ourData: null,
        competitorData: []
      };
    }

    let ourWhereClause: any = {};
    let competitorWhereClause: any = {};

    if (asin) {
      ourWhereClause.Product_Identifiers_MarketplaceASIN_ASIN = asin;
      competitorWhereClause.Product_Identifiers_MarketplaceASIN_ASIN = asin;
    }

    if (sellerSku) {
      ourWhereClause.SellerSKU = sellerSku;
      competitorWhereClause.SellerSKU = sellerSku;
    }

    const [ourData, competitorData] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.findFirst({
        where: ourWhereClause,
        include: {
          competitive_prices: { orderBy: { created_at: 'desc' } },
          sales_rankings: { orderBy: { created_at: 'desc' } },
          offer_listings: { orderBy: { created_at: 'desc' } }
        }
      }),
      prisma.aMZN_competitive_pricing_main_competitors.findMany({
        where: competitorWhereClause,
        include: {
          competitive_prices: { orderBy: { created_at: 'desc' } },
          sales_rankings: { orderBy: { created_at: 'desc' } },
          offer_listings: { orderBy: { created_at: 'desc' } }
        },
        take: 10
      })
    ]);

    const transformData = (item: any) => ({
      id: Number(item.id),
      SellerSKU: item.SellerSKU,
      status: item.status,
      Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
      created_at: item.created_at,
      updated_at: item.updated_at,
      competitive_prices: item.competitive_prices.map((price: any) => ({
        id: Number(price.id),
        price_amount: price.price_amount,
        price_currency: price.price_currency,
        condition: price.condition,
        fulfillment_channel: price.fulfillment_channel,
        belongs_to_requester: price.belongs_to_requester,
        shipping_amount: price.shipping_amount,
        shipping_currency: price.shipping_currency,
        created_at: price.created_at
      })),
      sales_rankings: item.sales_rankings.map((ranking: any) => ({
        id: Number(ranking.id),
        product_category_id: ranking.product_category_id,
        rank: ranking.rank,
        created_at: ranking.created_at
      })),
      offer_listings: item.offer_listings.map((offer: any) => ({
        id: Number(offer.id),
        condition: offer.condition,
        count: offer.count,
        created_at: offer.created_at
      }))
    });

    return {
      ourData: ourData ? transformData(ourData) : null,
      competitorData: competitorData.map(transformData)
    };
  } catch (error) {
    console.error('Error fetching related competitive pricing data:', error);
    throw new Error('Failed to fetch related competitive pricing data');
  }
}

export async function deleteCompetitivePricingRecord(id: number) {
  try {
    await prisma.aMZN_competitive_pricing_main.delete({
      where: { id: BigInt(id) }
    });

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error deleting competitive pricing record:', error);
    return {
      success: false,
      message: 'Failed to delete record. It may be referenced by other data.'
    };
  }
}

interface OurProductPrice {
  asin: string;
  seller_sku?: string;
  price: number;
  currency: string;
  condition: string;
  fulfillment_channel?: string;
  product_name?: string;
}

interface CompetitorPriceComparison extends CompetitorPrice {
  ourPrice?: number;
  priceDifference?: number;
  percentageDifference?: number;
}

async function fetchOurProductPrices(
  config: PriceMonitoringConfig
): Promise<OurProductPrice[]> {
  try {
    let whereClause: any = {};

    if (config.enabledASINs && config.enabledASINs.length > 0) {
      whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
        in: config.enabledASINs,
      };
    }
    if (config.enabledSKUs && config.enabledSKUs.length > 0) {
      whereClause.SellerSKU = {
        in: config.enabledSKUs,
      };
    }

    const ourProducts = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        competitive_prices: {
          orderBy: { created_at: "desc" },
          take: 1, // Get only the latest price
        },
      },
    });

    const prices: OurProductPrice[] = [];

    for (const product of ourProducts) {
      if (product.competitive_prices.length > 0) {
        const latestPrice = product.competitive_prices[0];
        if (latestPrice.price_amount && latestPrice.price_amount > 0) {
          prices.push({
            asin: product.Product_Identifiers_MarketplaceASIN_ASIN || "",
            seller_sku: product.SellerSKU || undefined,
            price: latestPrice.price_amount,
            currency: latestPrice.price_currency || "USD",
            condition: latestPrice.condition || "New",
            fulfillment_channel: latestPrice.fulfillment_channel || undefined,
          });
        }
      }
    }

    return prices;
  } catch (error) {
    console.error("Error fetching our product prices:", error);
    return [];
  }
}

async function fetchCompetitorPricesForComparison(
  config: PriceMonitoringConfig,
  ourPrices: OurProductPrice[]
): Promise<CompetitorPriceComparison[]> {
  try {
    const sellerSkus = ourPrices.map(p => p.seller_sku).filter((sku): sku is string => typeof sku === 'string');

    const skuToCompetitorAsinMap = new Map<string, string[]>();
    const skuToOurAsinMap = new Map<string, string>();
    
    // Build mapping from our SKUs to our ASINs
    ourPrices.forEach(p => {
      if (p.seller_sku) {
        skuToOurAsinMap.set(p.seller_sku, p.asin);
      }
    });

    const competitorMappings = await prisma.competitor_product_mappings.findMany({
      where: {
        ...(sellerSkus.length > 0 ? { our_seller_sku: { in: sellerSkus } } : {})
      }
    });

    for (const mapping of competitorMappings) {
      if (mapping.our_seller_sku && mapping.competitor_asin) {
        if (!skuToCompetitorAsinMap.has(mapping.our_seller_sku)) {
          skuToCompetitorAsinMap.set(mapping.our_seller_sku, []);
        }
        skuToCompetitorAsinMap.get(mapping.our_seller_sku)!.push(mapping.competitor_asin);
      }
    }
    
    const competitor_asins = Array.from(skuToCompetitorAsinMap.values()).flat();

    console.log(`Found ${competitor_asins.length} competitor ASINs for price comparison`);

    if (competitor_asins.length === 0) return [];

    const competitorProducts = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      where: {
        Product_Identifiers_MarketplaceASIN_ASIN: { in: competitor_asins },
      },
      include: {
        competitive_prices: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    const comparisons: CompetitorPriceComparison[] = [];
    const comparisonDetails: Array<{ ourSku: string, competitorAsin: string, ourPrice: number, competitorPrice: number }> = [];

    for (const competitor of competitorProducts) {
      if (competitor.competitive_prices.length === 0) continue;

      const competitorPrices = competitor.competitive_prices
        .filter(p => p.price_amount && p.price_amount > 0)
        .map(p => p.price_amount!);

      if (competitorPrices.length === 0) continue;

      const competitorLowestPrice = Math.min(...competitorPrices);
      const competitorHighestPrice = Math.max(...competitorPrices);

      // Find matching our product
      const ourProduct = ourPrices.find(
        p => p.seller_sku !== undefined &&
          skuToCompetitorAsinMap.get(p.seller_sku)?.includes(competitor.Product_Identifiers_MarketplaceASIN_ASIN ?? "")
      );

      if (ourProduct) {
        comparisonDetails.push({
          ourSku: ourProduct.seller_sku!,
          competitorAsin: competitor.Product_Identifiers_MarketplaceASIN_ASIN || "",
          ourPrice: ourProduct.price,
          competitorPrice: competitorLowestPrice
        });

        // Only add to comparisons if competitor price is LOWER than ours (undercutting)
        if (competitorLowestPrice < ourProduct.price) {
          const priceDiff = ourProduct.price - competitorLowestPrice;
          const percentDiff = (priceDiff / ourProduct.price) * 100;

          comparisons.push({
            asin: ourProduct.asin, // Use our ASIN for the alert
            seller_sku: ourProduct.seller_sku,
            price: competitorLowestPrice,
            currency: ourProduct.currency,
            condition: ourProduct.condition,
            fulfillment_channel: ourProduct.fulfillment_channel,
            competitor_name: `${competitor.Product_Identifiers_MarketplaceASIN_ASIN}`,
            ourPrice: ourProduct.price,
            priceDifference: -priceDiff, // Negative because competitor is lower
            percentageDifference: percentDiff, // Positive percentage
            isCompetitor: true,
          });
        }
      }
    }

    console.log(`Price comparison details:`, comparisonDetails);
    console.log(`Found ${comparisons.length} cases where competitors are undercutting our prices`);

    return comparisons;
  } catch (error) {
    console.error("Error fetching competitor prices for comparison:", error);
    return [];
  }
}

async function processPriceComparison(
  comparison: CompetitorPriceComparison,
  thresholdPercent: number
): Promise<{ success: boolean; alertCreated: boolean }> {
  try {
    if (!comparison.ourPrice || !comparison.priceDifference || !comparison.percentageDifference) {
      return { success: true, alertCreated: false };
    }

    // Only create alert if competitor price is lower than ours (negative difference)
    if (comparison.priceDifference >= 0) {
      console.log(`Competitor price is higher or equal for ${comparison.asin}, no alert needed`);
      return { success: true, alertCreated: false };
    }

    const absolutePercentDiff = Math.abs(comparison.percentageDifference);

    // Check if difference exceeds threshold
    if (absolutePercentDiff < thresholdPercent) {
      console.log(`Price difference ${absolutePercentDiff.toFixed(2)}% below threshold ${thresholdPercent}% for ${comparison.asin}`);
      return { success: true, alertCreated: false };
    }

    // Check for recent alert to avoid duplicates
    const recentAlert = await prisma.price_change_alerts.findFirst({
      where: {
        asin: comparison.asin,
        alert_type: 'competitor_undercut',
        is_dismissed: false,
        created_at: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
        },
      },
    });

    if (recentAlert) {
      console.log(`Recent alert exists for ${comparison.asin}, skipping`);
      return { success: true, alertCreated: false };
    }

    // Determine priority based on price difference
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (absolutePercentDiff >= 30) {
      priority = 'critical';
    } else if (absolutePercentDiff >= 20) {
      priority = 'high';
    } else if (absolutePercentDiff >= 10) {
      priority = 'medium';
    }

    const productInfo = await getProductInfo(comparison.asin, comparison.seller_sku);


    // Create alert
    await prisma.price_change_alerts.create({
      data: {
        asin: comparison.asin,
        seller_sku: comparison.seller_sku,
        product_name: productInfo?.name,
        old_price: comparison.ourPrice,
        new_price: comparison.price,
        price_change: comparison.priceDifference,
        price_change_percent: comparison.percentageDifference,
        currency: comparison.currency,
        alert_type: 'competitor_undercut',
        competitor_name: comparison.competitor_name,
        priority: priority,
        threshold_triggered: thresholdPercent,
        is_read: false,
        is_dismissed: false,
      },
    });

    console.log(
      `Alert created for ${comparison.asin}: Competitor price ${comparison.price} vs our ${comparison.ourPrice} (${comparison.percentageDifference.toFixed(2)}%)`
    );

    return { success: true, alertCreated: true };
  } catch (error) {
    console.error(`Error processing price comparison for ${comparison.asin}:`, error);
    return { success: false, alertCreated: false };
  }
}

// Updated monitorPricesAndCreateAlerts function
export async function monitorPricesAndCreateAlerts(
  config: Partial<PriceMonitoringConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };

  console.log("Starting automated price monitoring...");

  try {
    // Fetch our product prices
    const ourPrices = await fetchOurProductPrices(finalConfig);
    console.log(`Found ${ourPrices.length} of our products with prices`);

    if (ourPrices.length === 0) {
      console.log("No products to monitor");
      return {
        success: true,
        processed: 0,
        failed: 0,
        priceAlertsCreated: 0,
        rankAlertsCreated: 0,
      };
    }

    // Fetch competitor prices and compare
    const priceComparisons = await fetchCompetitorPricesForComparison(finalConfig, ourPrices);
    console.log(`Found ${priceComparisons.length} competitor prices to compare`);

    // Process price comparisons
    const priceResults = await Promise.allSettled(
      priceComparisons.map((comparison) =>
        processPriceComparison(comparison, finalConfig.alertThresholdPercent)
      )
    );

    // Process rank comparisons separately
    const rankAlertsCreated = await processRankComparisons(finalConfig);

    const priceSuccessful = priceResults.filter((r) => r.status === "fulfilled").length;
    const priceFailed = priceResults.filter((r) => r.status === "rejected").length;
    const priceAlerts = priceResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .filter((r) => r.value.alertCreated).length;

    console.log(`Price monitoring completed:`);
    console.log(`   - ${priceSuccessful} price comparisons processed successfully`);
    console.log(`   - ${priceFailed} price comparisons failed`);
    console.log(`   - ${priceAlerts} new price alerts created`);
    console.log(`   - ${rankAlertsCreated} new rank alerts created`);

    return {
      success: true,
      processed: priceSuccessful,
      failed: priceFailed,
      priceAlertsCreated: priceAlerts,
      rankAlertsCreated: rankAlertsCreated,
    };
  } catch (error) {
    console.error("Price monitoring failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}


async function processRankComparisons(config: PriceMonitoringConfig): Promise<number> {
  try {
    let whereClause: any = {};

    if (config.enabledASINs && config.enabledASINs.length > 0) {
      whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
        in: config.enabledASINs,
      };
    }
    if (config.enabledSKUs && config.enabledSKUs.length > 0) {
      whereClause.SellerSKU = {
        in: config.enabledSKUs,
      };
    }

    // Fetch our rankings with latest rank data
    const ourRankingData = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        sales_rankings: {
          orderBy: { created_at: "desc" },
          // take: 5, // Get recent ranks for better comparison
        },
      },
    });

    let alertsCreated = 0;

    for (const ourRecord of ourRankingData) {
      if (!ourRecord.Product_Identifiers_MarketplaceASIN_ASIN || ourRecord.sales_rankings.length === 0) {
        continue;
      }

      const asin = ourRecord.Product_Identifiers_MarketplaceASIN_ASIN;
      const sellerSku = ourRecord.SellerSKU;
      const ourRanks = ourRecord.sales_rankings
        .map(r => typeof r.rank === 'bigint' ? Number(r.rank) : r.rank)
        .filter((r): r is number => typeof r === 'number' && r > 0);

      if (ourRanks.length === 0) continue;

      const ourBestRank = Math.min(...ourRanks);
      const ourWorstRank = Math.max(...ourRanks);
      // console.debug(`Processing rank comparison for ASIN ${asin}: Our best rank is ${ourBestRank}`);

      // Check if we already have a recent alert for this ASIN to avoid duplicates
      const recentAlert = await prisma.price_change_alerts.findFirst({
        where: {
          asin: asin,
          currency: 'RANK',
          is_dismissed: false,
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
          }
        }
      });

      if (recentAlert) {
        // console.log(`Skipping rank comparison for ${asin}: Recent alert already exists`);
        continue;
      }

      const competitor_asins = await prisma.competitor_product_mappings.findMany({
        where: {
          ...(sellerSku ? { our_seller_sku: sellerSku } : {})
        }
      }).then(records => records.map(r => r.competitor_asin));

      // console.debug(`Found ${competitor_asins} competitor ASINs for our ASIN ${asin}`);

      // Fetch competitor rankings for the same ASIN
      const competitorRankingData = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
        where: {
          Product_Identifiers_MarketplaceASIN_ASIN: { in: competitor_asins },
        },
        include: {
          sales_rankings: {
            orderBy: { created_at: "desc" },
            // take: 3, // Get recent competitor ranks
          },
        },
      });

      if (competitorRankingData.length === 0) {
        // console.log(`No competitor data found for ASIN ${asin}`);
        continue;
      }
      console.log(`Competitor data found for ASIN ${asin}`);

      // Collect all competitor ranks
      const competitorRanks: number[] = [];
      const competitorDetails: Array<{ sellerId: string, rank: number }> = [];

      for (const competitorRecord of competitorRankingData) {
        const ranks = competitorRecord.sales_rankings
          .map(r => typeof r.rank === 'bigint' ? Number(r.rank) : r.rank)
          .filter((r): r is number => typeof r === 'number' && r > 0);

        if (ranks.length > 0) {
          const bestRank = Math.min(...ranks);
          competitorRanks.push(bestRank);
          competitorDetails.push({
            sellerId: competitorRecord.Product_Identifiers_MarketplaceASIN_ASIN || 'Unknown',
            rank: bestRank
          });
        }
      }

      if (competitorRanks.length === 0) {
        console.log(`No valid competitor ranks found for ASIN ${asin}`);
        continue;
      }

      const competitorBestRank = Math.min(...competitorRanks);
      const competitorsAheadCount = competitorRanks.filter(rank => rank < ourWorstRank).length;

      // Only create alert if competitors have better ranks (lower numbers)
      if (competitorBestRank < ourBestRank) {
        const rankDifference = ourBestRank - competitorBestRank;
        const percentageDifference = (rankDifference / ourBestRank) * 100;

        let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
        let alertMessage = '';

        if (percentageDifference >= 50) {
          priority = 'critical';
          alertMessage = `Critical: Competitor ranked significantly higher (${competitorBestRank} vs our ${ourBestRank})`;
        } else if (percentageDifference >= 25) {
          priority = 'high';
          alertMessage = `High: Competitor ranked considerably higher (${competitorBestRank} vs our ${ourBestRank})`;
        } else if (rankDifference >= 10) {
          priority = 'medium';
          alertMessage = `Medium: Competitor ranked higher (${competitorBestRank} vs our ${ourBestRank})`;
        } else {
          priority = 'low';
          alertMessage = `Low: Competitor ranked slightly higher (${competitorBestRank} vs our ${ourBestRank})`;
        }

        // Enhance priority if many competitors are ahead
        if (competitorsAheadCount >= competitorRanks.length * 0.7) {
          priority = priority === 'critical' ? 'critical' : 'high';
          alertMessage += ` | ${competitorsAheadCount}/${competitorRanks.length} competitors ahead`;
        }

        try {
          const productInfo = await getProductInfo(asin, ourRecord.SellerSKU || undefined);
          const bestCompetitor = competitorDetails.find(c => c.rank === competitorBestRank);

          await prisma.price_change_alerts.create({
            data: {
              asin: asin,
              seller_sku: ourRecord.SellerSKU,
              product_name: productInfo?.name,
              old_price: ourBestRank,
              new_price: competitorBestRank,
              price_change: rankDifference,
              price_change_percent: percentageDifference,
              currency: 'RANK',
              alert_type: 'rank_comparison',
              competitor_name: `Best: ${bestCompetitor?.sellerId || 'Unknown'} (${competitorsAheadCount}/${competitorRanks.length} ahead)`,
              priority: priority,
              threshold_triggered: 0,
              is_read: false,
              is_dismissed: false
            }
          });

          // Store historical rank data for both our rank and competitor best rank
          // await Promise.all([
          //   storeHistoricalPrice(asin, ourBestRank, 'RANK', ourRecord.SellerSKU || undefined, 'our_rank', 'New', undefined, 'rank_monitoring'),
          //   storeHistoricalPrice(asin, competitorBestRank, 'RANK', ourRecord.SellerSKU || undefined, 'competitor_best_rank', 'New', undefined, 'rank_monitoring')
          // ]);

          alertsCreated++;
          // console.log(`Rank alert created for ${asin}: ${alertMessage}`);
        } catch (error) {
          console.error(`Failed to create rank alert for ${asin}:`, error);
        }
      } else {
        // console.log(`No rank alert needed for ${asin}: Our rank ${ourBestRank} vs competitor ${competitorBestRank}`);
      }
    }

    console.log(`Rank comparison completed: ${alertsCreated} alerts created`);
    return alertsCreated;
  } catch (error) {
    console.error("Error processing rank comparisons:", error);
    return 0;
  }
}


async function getProductInfo(asin: string, sellerSku?: string) {
  try {
    const amazonProduct = await prisma.aMZN_PRODUCT_LIST.findFirst({
      where: { asin1: asin },
    });

    if (amazonProduct) {
      return {
        name: amazonProduct.item_name,
        sku: amazonProduct.seller_sku,
      };
    }

    const orderMapping = await prisma.order_mappings.findFirst({
      where: {
        OR: [{ amzn_asin: asin }, { amzn_sku: sellerSku }],
      },
    });

    if (orderMapping) {
      return {
        name:
          orderMapping.unified_product_name || orderMapping.amzn_product_name,
        sku: orderMapping.amzn_sku,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error getting product info for ASIN ${asin}:`, error);
    return null;
  }
}

export async function cleanupOldMonitoringData() {
  console.log("Starting cleanup of old monitoring data...");

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [deletedMain, deletedCompetitors] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.deleteMany({
        where: {
          created_at: { lt: thirtyDaysAgo },
        },
      }),
      prisma.aMZN_competitive_pricing_main_competitors.deleteMany({
        where: {
          created_at: { lt: thirtyDaysAgo },
        },
      }),
    ]);

    const deletedAlerts = await prisma.price_change_alerts.deleteMany({
      where: {
        created_at: { lt: sixtyDaysAgo },
        is_dismissed: true,
      },
    });

    console.log(`Cleanup completed:`);
    console.log(`   - ${deletedMain.count} main pricing records deleted`);
    console.log(`   - ${deletedCompetitors.count} competitor records deleted`);
    console.log(`   - ${deletedAlerts.count} old alerts deleted`);

    return {
      success: true,
      deletedMain: deletedMain.count,
      deletedCompetitors: deletedCompetitors.count,
      deletedAlerts: deletedAlerts.count,
    };
  } catch (error) {
    console.error("Cleanup failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function initializeMonitoringForProducts(asins: string[]) {
  console.log(`Initializing monitoring for ${asins.length} products...`);

  try {
    const results = await Promise.allSettled(
      asins.map(async (asin) => {
        // Initialize price monitoring
        const pricing = await prisma.aMZN_competitive_pricing_main.findFirst({
          where: {
            Product_Identifiers_MarketplaceASIN_ASIN: asin,
          },
          include: {
            competitive_prices: true,
            sales_rankings: true,
          },
          orderBy: {
            created_at: "desc",
          },
        });

        if (!pricing) {
          console.warn(`No pricing data found for ASIN: ${asin}`);
          throw new Error(`No pricing data found for ASIN: ${asin}`);
        }

        let historicalEntries = 0;

        // Store historical price data
        if (pricing.competitive_prices.length > 0) {
          const priceEntries = await Promise.all(
            pricing.competitive_prices.map((price) =>
              storeHistoricalPrice(
                asin,
                price.price_amount || 0,
                price.price_currency || "USD",
                pricing.SellerSKU || undefined,
                "baseline_price",
                price.condition || "New",
                price.fulfillment_channel || undefined,
                "initialization"
              )
            )
          );
          historicalEntries += priceEntries.length;
        }

        // // Store historical rank data
        // if (pricing.sales_rankings.length > 0) {
        //   const rankEntries = await Promise.all(
        //     pricing.sales_rankings.map((ranking) =>
        //       storeHistoricalPrice(
        //         asin,
        //         Number(ranking.rank) || 0,
        //         "RANK",
        //         pricing.SellerSKU || undefined,
        //         "baseline_rank",
        //         "New",
        //         undefined,
        //         "initialization"
        //       )
        //     )
        //   );
        //   historicalEntries += rankEntries.length;
        // }

        return {
          asin,
          historicalEntriesStored: historicalEntries,
        };
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Initialization completed:`);
    console.log(`   - ${successful} products initialized successfully`);
    console.log(`   - ${failed} products failed to initialize`);

    return {
      success: true,
      initialized: successful,
      failed,
    };
  } catch (error) {
    console.error("Initialization failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getMonitoringStatistics() {
  try {
    const [
      totalHistoricalRecords,
      totalAlerts,
      recentAlerts,
      monitoredASINs,
      lastMonitoringRun,
      priceAlerts,
      rankAlerts,
    ] = await Promise.all([
      prisma.competitive_historical_prices.count(),
      prisma.price_change_alerts.count(),
      prisma.price_change_alerts.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.competitive_historical_prices.groupBy({
        by: ["asin"],
        _count: true,
      }),
      prisma.competitive_historical_prices.findFirst({
        orderBy: { recorded_at: "desc" },
        select: { recorded_at: true },
      }),
      prisma.price_change_alerts.count({
        where: {
          currency: { not: "RANK" },
          is_dismissed: false
        },
      }),
      prisma.price_change_alerts.count({
        where: {
          currency: "RANK",
          is_dismissed: false
        },
      }),
    ]);

    return {
      success: true,
      statistics: {
        totalHistoricalRecords,
        totalAlerts,
        recentAlerts,
        priceAlerts,
        rankAlerts,
        monitoredProductsCount: monitoredASINs.length,
        lastMonitoringRun: lastMonitoringRun?.recorded_at,
      },
    };
  } catch (error) {
    console.error("Error getting monitoring statistics:", error);
    return {
      success: false,
      error: "Failed to get monitoring statistics",
    };
  }
}

export async function getRankHistory(
  asin: string,
  days: number = 30,
  limit: number = 100
) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await prisma.competitive_historical_prices.findMany({
      where: {
        asin,
        currency: 'RANK',
        recorded_at: { gte: startDate }
      },
      orderBy: { recorded_at: 'desc' },
      take: limit
    });

    const ourRanks = history.filter(h => h.price_type?.includes('baseline') || h.price_type?.includes('our'));
    const competitorRanks = history.filter(h => h.price_type?.includes('competitor'));

    return {
      success: true,
      history: history.map(record => ({
        ...record,
        id: Number(record.id),
        rank: record.price
      })),
      ourRanks: ourRanks.map(r => ({ ...r, rank: r.price })),
      competitorRanks: competitorRanks.map(r => ({ ...r, rank: r.price }))
    };
  } catch (error) {
    console.error('Error fetching rank history:', error);
    return {
      success: false,
      error: 'Failed to fetch rank history'
    };
  }
}

export async function getEnhancedCompetitivePricingStats() {
  try {
    const [
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
      activeAlerts,
      productsWithAlerts,
      rankAlerts,
      criticalRankAlerts,
      priceAlerts,
      criticalPriceAlerts
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.count(),
      prisma.aMZN_competitive_pricing_main.count({
        where: { status: 'Active' }
      }),
      prisma.aMZN_competitive_prices.count(),
      prisma.aMZN_sales_rankings.count(),
      prisma.price_change_alerts.count({
        where: { is_dismissed: false }
      }),
      prisma.price_change_alerts.findMany({
        where: { is_dismissed: false },
        select: { asin: true, seller_sku: true },
        distinct: ['asin', 'seller_sku']
      }).then(alerts => {
        const uniqueProducts = new Set();
        alerts.forEach(alert => {
          uniqueProducts.add(`${alert.asin}-${alert.seller_sku || 'null'}`);
        });
        return uniqueProducts.size;
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          currency: 'RANK'
        }
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          currency: 'RANK',
          priority: 'critical'
        }
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          currency: { not: 'RANK' }
        }
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          currency: { not: 'RANK' },
          priority: 'critical'
        }
      })
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
      activeAlerts,
      productsWithAlerts,
      rankAlerts,
      criticalRankAlerts,
      priceAlerts,
      criticalPriceAlerts
    };
  } catch (error) {
    console.error('Error fetching enhanced competitive pricing stats:', error);
    return {
      totalProducts: 0,
      activeProducts: 0,
      totalPricePoints: 0,
      totalSalesRankings: 0,
      activeAlerts: 0,
      productsWithAlerts: 0,
      rankAlerts: 0,
      criticalRankAlerts: 0,
      priceAlerts: 0,
      criticalPriceAlerts: 0
    };
  }
}

export async function getProductsWithRankingIssues(limit: number = 20) {
  try {
    const rankAlerts = await prisma.price_change_alerts.findMany({
      where: {
        currency: 'RANK',
        is_dismissed: false,
        is_read: false
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ],
      take: limit
    });

    return {
      success: true,
      products: rankAlerts.map(alert => ({
        ...alert,
        id: Number(alert.id),
        our_rank: alert.old_price,
        competitor_rank: alert.new_price,
        rank_difference: alert.price_change
      }))
    };
  } catch (error) {
    console.error('Error fetching products with ranking issues:', error);
    return {
      success: false,
      error: 'Failed to fetch products with ranking issues',
      products: []
    };
  }
}

// Helper function to get competitor mappings for ASIN-based rank comparison
export async function getCompetitorMappingsForRank(asin: string) {
  try {
    const mappings = await prisma.competitor_product_mappings.findMany({
      where: {
        OR: [
          { our_asin: asin },
          { competitor_asin: asin }
        ],
        is_active: true
      },
      orderBy: { mapping_priority: 'desc' }
    });

    return mappings;
  } catch (error) {
    console.error('Error fetching competitor mappings:', error);
    return [];
  }
}

// Enhanced function to create competitor comparison entries
export async function createCompetitorComparison(
  mappingId: bigint,
  ourPrice?: number,
  ourCurrency?: string,
  competitorPrice?: number,
  competitorCurrency?: string,
  ourRank?: number,
  competitorRank?: number,
  ourStockStatus?: string,
  competitorStockStatus?: string,
  dataSource?: string
) {
  try {
    const priceDifference = (ourPrice && competitorPrice) ?
      competitorPrice - ourPrice : null;
    const priceDifferencePercentage = (ourPrice && competitorPrice && ourPrice > 0) ?
      ((competitorPrice - ourPrice) / ourPrice) * 100 : null;

    await prisma.competitor_comparison_history.create({
      data: {
        competitor_mapping_id: mappingId,
        our_price: ourPrice,
        our_currency: ourCurrency,
        competitor_price: competitorPrice,
        competitor_currency: competitorCurrency,
        price_difference: priceDifference,
        price_difference_percentage: priceDifferencePercentage,
        our_sales_rank: ourRank ? BigInt(ourRank) : null,
        competitor_sales_rank: competitorRank ? BigInt(competitorRank) : null,
        our_stock_status: ourStockStatus,
        competitor_stock_status: competitorStockStatus,
        data_source: dataSource || 'automated_monitoring',
        comparison_date: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating competitor comparison:', error);
    return { success: false, error: 'Failed to create competitor comparison' };
  }
}