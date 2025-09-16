'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// Types for server actions
export interface CompetitivePricingFilters {
  searchTerm?: string;
  statusFilter?: string;
  page?: number;
  limit?: number;
}

export interface CompetitivePricingData {
  id: number;
  SellerSKU: string | null;
  status: string | null;
  Product_Identifiers_SKUIdentifier_MarketplaceId: string | null;
  Product_Identifiers_SKUIdentifier_SellerId: string | null;
  Product_Identifiers_SKUIdentifier_SellerSKU: string | null;
  Product_Identifiers_MarketplaceASIN_MarketplaceId: string | null;
  Product_Identifiers_MarketplaceASIN_ASIN: string | null;
  created_at: Date | null;
  sales_rankings: Array<{
    id: number;
    seller_sku: string | null;
    product_category_id: string | null;
    rank: bigint | null;
    created_at: Date | null;
  }>;
  offer_listings: Array<{
    id: number;
    seller_sku: string | null;
    condition: string | null;
    count: bigint | null;
    created_at: Date | null;
  }>;
  competitive_prices: Array<{
    id: number;
    seller_sku: string | null;
    belongs_to_requester: boolean | null;
    condition: string | null;
    fulfillment_channel: string | null;
    offer_type: string | null;
    price_amount: number | null;
    price_currency: string | null;
    shipping_amount: bigint | null;
    shipping_currency: string | null;
    subcategory: string | null;
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

/**
 * Fetch competitive pricing data with filters and pagination
 */
export async function getCompetitivePricingData(
  filters: CompetitivePricingFilters = {}
): Promise<PaginatedResult<CompetitivePricingData>> {
  try {
    const {
      searchTerm = '',
      statusFilter = 'all',
      page = 1,
      limit = 10
    } = filters;

    // Build where clause
    const whereClause: any = {};
    
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

    // Get total count for pagination
    const total = await prisma.aMZN_competitive_pricing_main.count({
      where: whereClause
    });

    // Get paginated data with relations
    const data = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        sales_rankings: {
          orderBy: {
            created_at: 'desc'
          }
        },
        offer_listings: {
          orderBy: {
            created_at: 'desc'
          }
        },
        competitive_prices: {
          orderBy: {
            created_at: 'desc'
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as CompetitivePricingData[],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    console.error('Error fetching competitive pricing data:', error);
    throw new Error('Failed to fetch competitive pricing data', error);
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

    // Build where clause for competitor data
    const whereClause: any = {};
    
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

    // Get total count for pagination
    const total = await prisma.aMZN_competitive_pricing_main_competitors.count({
      where: whereClause
    });

    // Get paginated data with relations
    const data = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      where: whereClause,
      include: {
        sales_rankings: {
          orderBy: {
            created_at: 'desc'
          }
        },
        competitive_prices: {
          orderBy: {
            created_at: 'desc'
          }
        },
        offer_listings: {
          orderBy: {
            created_at: 'desc'
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    const totalPages = Math.ceil(total / limit);

    // Transform the data to match the expected CompetitivePricingData interface
    const transformedData: CompetitivePricingData[] = data.map(item => ({
      id: item.id,
      SellerSKU: item.SellerSKU,
      status: item.status,
      Product_Identifiers_SKUIdentifier_MarketplaceId: item.Product_Identifiers_SKUIdentifier_MarketplaceId,
      Product_Identifiers_SKUIdentifier_SellerId: item.Product_Identifiers_SKUIdentifier_SellerId,
      Product_Identifiers_SKUIdentifier_SellerSKU: item.Product_Identifiers_SKUIdentifier_SellerSKU,
      Product_Identifiers_MarketplaceASIN_MarketplaceId: item.Product_Identifiers_MarketplaceASIN_MarketplaceId,
      Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
      created_at: item.created_at,
      sales_rankings: item.sales_rankings,
      competitive_prices: item.competitive_prices,
      offer_listings: item.offer_listings
    }));

    return {
      data: transformedData,
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

/**
 * Get competitor competitive pricing statistics
 */
export async function getCompetitorCompetitivePricingStats(): Promise<{
  totalProducts: number;
  activeProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
}> {
  try {
    const [
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main_competitors.count(),
      prisma.aMZN_competitive_pricing_main_competitors.count({
        where: { status: 'Active' }
      }),
      prisma.aMZN_competitive_prices_competitors.count(),
      prisma.aMZN_sales_rankings_competitors.count()
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings
    };
  } catch (error) {
    console.error('Error fetching competitor competitive pricing stats:', error);
    throw new Error('Failed to fetch competitor dashboard statistics');
  }
}

/**
 * Get related competitive pricing data (your products vs competitors by ASIN)
 */
export async function getRelatedCompetitivePricingData(asin?: string, sellerSku?: string): Promise<{
  ourData: CompetitivePricingData | null;
  competitorData: CompetitivePricingData[];
}> {
  try {
    let ourData: CompetitivePricingData | null = null;
    let competitorData: CompetitivePricingData[] = [];

    // If we have an ASIN, find our product and competitor products with same ASIN
    if (asin) {
      // Get our product data
      const ourProduct = await prisma.aMZN_competitive_pricing_main.findFirst({
        where: {
          Product_Identifiers_MarketplaceASIN_ASIN: asin
        },
        include: {
          sales_rankings: { orderBy: { created_at: 'desc' } },
          competitive_prices: { orderBy: { created_at: 'desc' } },
          offer_listings: { orderBy: { created_at: 'desc' } }
        }
      });

      if (ourProduct) {
        ourData = {
          id: ourProduct.id,
          SellerSKU: ourProduct.SellerSKU,
          status: ourProduct.status,
          Product_Identifiers_SKUIdentifier_MarketplaceId: ourProduct.Product_Identifiers_SKUIdentifier_MarketplaceId,
          Product_Identifiers_SKUIdentifier_SellerId: ourProduct.Product_Identifiers_SKUIdentifier_SellerId,
          Product_Identifiers_SKUIdentifier_SellerSKU: ourProduct.Product_Identifiers_SKUIdentifier_SellerSKU,
          Product_Identifiers_MarketplaceASIN_MarketplaceId: ourProduct.Product_Identifiers_MarketplaceASIN_MarketplaceId,
          Product_Identifiers_MarketplaceASIN_ASIN: ourProduct.Product_Identifiers_MarketplaceASIN_ASIN,
          created_at: ourProduct.created_at,
          sales_rankings: ourProduct.sales_rankings,
          competitive_prices: ourProduct.competitive_prices,
          offer_listings: ourProduct.offer_listings
        };
      }

      // Get competitor products with same ASIN
      const competitorProducts = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
        where: {
          Product_Identifiers_MarketplaceASIN_ASIN: asin
        },
        include: {
          sales_rankings: { orderBy: { created_at: 'desc' } },
          competitive_prices: { orderBy: { created_at: 'desc' } },
          offer_listings: { orderBy: { created_at: 'desc' } }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      competitorData = competitorProducts.map(item => ({
        id: item.id,
        SellerSKU: item.SellerSKU,
        status: item.status,
        Product_Identifiers_SKUIdentifier_MarketplaceId: item.Product_Identifiers_SKUIdentifier_MarketplaceId,
        Product_Identifiers_SKUIdentifier_SellerId: item.Product_Identifiers_SKUIdentifier_SellerId,
        Product_Identifiers_SKUIdentifier_SellerSKU: item.Product_Identifiers_SKUIdentifier_SellerSKU,
        Product_Identifiers_MarketplaceASIN_MarketplaceId: item.Product_Identifiers_MarketplaceASIN_MarketplaceId,
        Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
        created_at: item.created_at,
        sales_rankings: item.sales_rankings,
        competitive_prices: item.competitive_prices,
        offer_listings: item.offer_listings
      }));
    }

    // If we have a seller SKU, find our product by SKU
    if (sellerSku && !ourData) {
      const ourProduct = await prisma.aMZN_competitive_pricing_main.findFirst({
        where: {
          SellerSKU: sellerSku
        },
        include: {
          sales_rankings: { orderBy: { created_at: 'desc' } },
          competitive_prices: { orderBy: { created_at: 'desc' } },
          offer_listings: { orderBy: { created_at: 'desc' } }
        }
      });

      if (ourProduct) {
        ourData = {
          id: ourProduct.id,
          SellerSKU: ourProduct.SellerSKU,
          status: ourProduct.status,
          Product_Identifiers_SKUIdentifier_MarketplaceId: ourProduct.Product_Identifiers_SKUIdentifier_MarketplaceId,
          Product_Identifiers_SKUIdentifier_SellerId: ourProduct.Product_Identifiers_SKUIdentifier_SellerId,
          Product_Identifiers_SKUIdentifier_SellerSKU: ourProduct.Product_Identifiers_SKUIdentifier_SellerSKU,
          Product_Identifiers_MarketplaceASIN_MarketplaceId: ourProduct.Product_Identifiers_MarketplaceASIN_MarketplaceId,
          Product_Identifiers_MarketplaceASIN_ASIN: ourProduct.Product_Identifiers_MarketplaceASIN_ASIN,
          created_at: ourProduct.created_at,
          sales_rankings: ourProduct.sales_rankings,
          competitive_prices: ourProduct.competitive_prices,
          offer_listings: ourProduct.offer_listings
        };

        // If we found our product by SKU and it has an ASIN, get competitors for that ASIN
        if (ourProduct.Product_Identifiers_MarketplaceASIN_ASIN) {
          const competitorProducts = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
            where: {
              Product_Identifiers_MarketplaceASIN_ASIN: ourProduct.Product_Identifiers_MarketplaceASIN_ASIN
            },
            include: {
              sales_rankings: { orderBy: { created_at: 'desc' } },
              competitive_prices: { orderBy: { created_at: 'desc' } },
              offer_listings: { orderBy: { created_at: 'desc' } }
            },
            orderBy: {
              created_at: 'desc'
            }
          });

          competitorData = competitorProducts.map(item => ({
            id: item.id,
            SellerSKU: item.SellerSKU,
            status: item.status,
            Product_Identifiers_SKUIdentifier_MarketplaceId: item.Product_Identifiers_SKUIdentifier_MarketplaceId,
            Product_Identifiers_SKUIdentifier_SellerId: item.Product_Identifiers_SKUIdentifier_SellerId,
            Product_Identifiers_SKUIdentifier_SellerSKU: item.Product_Identifiers_SKUIdentifier_SellerSKU,
            Product_Identifiers_MarketplaceASIN_MarketplaceId: item.Product_Identifiers_MarketplaceASIN_MarketplaceId,
            Product_Identifiers_MarketplaceASIN_ASIN: item.Product_Identifiers_MarketplaceASIN_ASIN,
            created_at: item.created_at,
            sales_rankings: item.sales_rankings,
            competitive_prices: item.competitive_prices,
            offer_listings: item.offer_listings
          }));
        }
      }
    }

    return {
      ourData,
      competitorData
    };
  } catch (error) {
    console.error('Error fetching related competitive pricing data:', error);
    throw new Error('Failed to fetch related competitive pricing data');
  }
}

/**
 * Delete a competitive pricing record and all related data
 */
export async function deleteCompetitivePricingRecord(id: number): Promise<{ success: boolean; message: string }> {
  try {
    // Delete in transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete related records first due to foreign key constraints
      await tx.aMZN_sales_rankings.deleteMany({
        where: { competitive_pricing_main_id: id }
      });

      await tx.aMZN_offer_listings.deleteMany({
        where: { competitive_pricing_main_id: id }
      });

      await tx.aMZN_competitive_prices.deleteMany({
        where: { competitive_pricing_main_id: id }
      });

      // Delete main record
      await tx.aMZN_competitive_pricing_main.delete({
        where: { id }
      });
    });

    // Revalidate the path to refresh the UI
    revalidatePath('/dashboard/competitive-pricing');

    return {
      success: true,
      message: 'Record deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting competitive pricing record:', error);
    return {
      success: false,
      message: 'Failed to delete record'
    };
  }
}

/**
 * Create a new competitive pricing record
 */
export async function createCompetitivePricingRecord(data: {
  sellerSKU: string;
  status: string;
  marketplaceId: string;
  sellerId: string;
  asin: string;
  salesRankings?: Array<{
    product_category_id: string;
    rank: number;
  }>;
  offerListings?: Array<{
    condition: string;
    count: number;
  }>;
  competitivePrices?: Array<{
    belongs_to_requester: boolean;
    condition: string;
    fulfillment_channel: string;
    offer_type: string;
    price_amount: number;
    price_currency: string;
    shipping_amount?: number;
    shipping_currency?: string;
    subcategory?: string;
  }>;
}): Promise<{ success: boolean; message: string; id?: number }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create main record
      const mainRecord = await tx.aMZN_competitive_pricing_main.create({
        data: {
          SellerSKU: data.sellerSKU,
          status: data.status,
          Product_Identifiers_SKUIdentifier_MarketplaceId: data.marketplaceId,
          Product_Identifiers_SKUIdentifier_SellerId: data.sellerId,
          Product_Identifiers_SKUIdentifier_SellerSKU: data.sellerSKU,
          Product_Identifiers_MarketplaceASIN_MarketplaceId: data.marketplaceId,
          Product_Identifiers_MarketplaceASIN_ASIN: data.asin
        }
      });

      // Create sales rankings if provided
      if (data.salesRankings && data.salesRankings.length > 0) {
        await tx.aMZN_sales_rankings.createMany({
          data: data.salesRankings.map(ranking => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            product_category_id: ranking.product_category_id,
            rank: BigInt(ranking.rank)
          }))
        });
      }

      // Create offer listings if provided
      if (data.offerListings && data.offerListings.length > 0) {
        await tx.aMZN_offer_listings.createMany({
          data: data.offerListings.map(offer => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            condition: offer.condition,
            count: BigInt(offer.count)
          }))
        });
      }

      // Create competitive prices if provided
      if (data.competitivePrices && data.competitivePrices.length > 0) {
        await tx.aMZN_competitive_prices.createMany({
          data: data.competitivePrices.map(price => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            belongs_to_requester: price.belongs_to_requester,
            condition: price.condition,
            fulfillment_channel: price.fulfillment_channel,
            offer_type: price.offer_type,
            price_amount: price.price_amount,
            price_currency: price.price_currency,
            shipping_amount: price.shipping_amount ? BigInt(price.shipping_amount) : null,
            shipping_currency: price.shipping_currency,
            subcategory: price.subcategory
          }))
        });
      }

      return mainRecord;
    });

    revalidatePath('/dashboard/competitive-pricing');

    return {
      success: true,
      message: 'Record created successfully',
      id: result.id
    };
  } catch (error) {
    console.error('Error creating competitive pricing record:', error);
    return {
      success: false,
      message: 'Failed to create record'
    };
  }
}

/**
 * Update a competitive pricing record
 */
export async function updateCompetitivePricingRecord(
  id: number,
  data: {
    sellerSKU?: string;
    status?: string;
    marketplaceId?: string;
    sellerId?: string;
    asin?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.aMZN_competitive_pricing_main.update({
      where: { id },
      data: {
        ...(data.sellerSKU && { SellerSKU: data.sellerSKU }),
        ...(data.status && { status: data.status }),
        ...(data.marketplaceId && { 
          Product_Identifiers_SKUIdentifier_MarketplaceId: data.marketplaceId,
          Product_Identifiers_MarketplaceASIN_MarketplaceId: data.marketplaceId 
        }),
        ...(data.sellerId && { Product_Identifiers_SKUIdentifier_SellerId: data.sellerId }),
        ...(data.sellerSKU && { Product_Identifiers_SKUIdentifier_SellerSKU: data.sellerSKU }),
        ...(data.asin && { Product_Identifiers_MarketplaceASIN_ASIN: data.asin })
      }
    });

    revalidatePath('/dashboard/competitive-pricing');

    return {
      success: true,
      message: 'Record updated successfully'
    };
  } catch (error) {
    console.error('Error updating competitive pricing record:', error);
    return {
      success: false,
      message: 'Failed to update record'
    };
  }
}

/**
 * Get dashboard statistics
 */
export async function getCompetitivePricingStats(): Promise<{
  totalProducts: number;
  activeProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
}> {
  try {
    const [
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.count(),
      prisma.aMZN_competitive_pricing_main.count({
        where: { status: 'Active' }
      }),
      prisma.aMZN_competitive_prices.count(),
      prisma.aMZN_sales_rankings.count()
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw new Error('Failed to fetch dashboard statistics');
  }
}

/**
 * Bulk delete competitive pricing records
 */
export async function bulkDeleteCompetitivePricingRecords(ids: number[]): Promise<{ success: boolean; message: string; deletedCount: number }> {
  try {
    let deletedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        // Delete related records first
        await tx.aMZN_sales_rankings.deleteMany({
          where: { competitive_pricing_main_id: id }
        });

        await tx.aMZN_offer_listings.deleteMany({
          where: { competitive_pricing_main_id: id }
        });

        await tx.aMZN_competitive_prices.deleteMany({
          where: { competitive_pricing_main_id: id }
        });

        // Delete main record
        const result = await tx.aMZN_competitive_pricing_main.delete({
          where: { id }
        });

        if (result) deletedCount++;
      }
    });

    revalidatePath('/dashboard/competitive-pricing');

    return {
      success: true,
      message: `${deletedCount} record(s) deleted successfully`,
      deletedCount
    };
  } catch (error) {
    console.error('Error bulk deleting records:', error);
    return {
      success: false,
      message: 'Failed to delete records',
      deletedCount: 0
    };
  }
}