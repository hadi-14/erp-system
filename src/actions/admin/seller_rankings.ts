"use server";

import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { revalidatePath } from "next/cache";

// Types for server actions
export interface CompetitivePricingFilters {
  searchTerm?: string;
  statusFilter?: string;
  alertFilter?: string;
  page?: number;
  limit?: number;
  sortBy?: 'sku' | 'status' | 'date' | 'price' | 'ranking' | null;
  sortOrder?: 'asc' | 'desc';
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
  updated_at?: Date | null;
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

export interface RelatedCompetitiveData {
  [key: string]: {
    competitorData: CompetitivePricingData[];
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
      searchTerm = "",
      statusFilter = "all",
      alertFilter = "all",
      page = 1,
      limit = 10,
      sortBy = null,
      sortOrder = 'asc',
    } = filters;

    const whereClause: any = {};

    if (searchTerm) {
      whereClause.OR = [
        {
          SellerSKU: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          Product_Identifiers_MarketplaceASIN_ASIN: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    if (statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    // Handle alert filtering
    if (alertFilter !== "all") {
      const priceAlerts = await prisma.price_change_alerts.findMany({
        where: {
          is_dismissed: false,
        },
        select: {
          asin: true,
          priority: true,
        },
      });

      let relevantAlerts = priceAlerts;

      if (alertFilter === "critical_alerts") {
        relevantAlerts = relevantAlerts.filter(alert => alert.priority === "critical");
      } else if (alertFilter === "high_alerts") {
        relevantAlerts = relevantAlerts.filter(alert => alert.priority === "high");
      }

      const asinsWithAlerts = [...new Set(relevantAlerts.map(alert => alert.asin))];

      if (alertFilter === "with_alerts" || alertFilter === "critical_alerts" || alertFilter === "high_alerts") {
        if (asinsWithAlerts.length > 0) {
          whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
            in: asinsWithAlerts
          };
        } else {
          return {
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
      } else if (alertFilter === "without_alerts") {
        if (asinsWithAlerts.length > 0) {
          whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
            notIn: asinsWithAlerts
          };
        }
      }
    }

    // For complex sorting (price, ranking, rating), use advanced sort
    if (sortBy === 'price' || sortBy === 'ranking' || sortBy === 'rating') {
      return getCompetitivePricingDataWithAdvancedSort(filters);
    }

    // Build orderBy clause for simple sorts
    let orderByClause: any = [{ created_at: 'desc' }];

    if (sortBy === 'sku') {
      orderByClause = [{ SellerSKU: sortOrder }];
    } else if (sortBy === 'status') {
      orderByClause = [{ status: sortOrder }];
    } else if (sortBy === 'date') {
      orderByClause = [{ created_at: sortOrder }];
    }

    const total = await prisma.aMZN_competitive_pricing_main.count({
      where: whereClause,
    });

    const data = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        sales_rankings: true,
        offer_listings: true,
        competitive_prices: true,
      },
      orderBy: orderByClause,
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as CompetitivePricingData[],
      pagination: { page, limit, total, totalPages },
    };
  } catch (error) {
    console.error("Error fetching competitive pricing data:", error);
    throw new Error("Failed to fetch competitive pricing data");
  }
}

// 3. Update the getCompetitivePricingDataWithAdvancedSort function to include rating logic

export async function getCompetitivePricingDataWithAdvancedSort(
  filters: CompetitivePricingFilters = {}
): Promise<PaginatedResult<CompetitivePricingData>> {
  try {
    const {
      searchTerm = "",
      statusFilter = "all",
      alertFilter = "all",
      page = 1,
      limit = 10,
      sortBy = null,
      sortOrder = 'asc',
    } = filters;

    const whereClause: any = {};

    if (searchTerm) {
      whereClause.OR = [
        {
          SellerSKU: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          Product_Identifiers_MarketplaceASIN_ASIN: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    if (statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    if (alertFilter !== "all") {
      const priceAlerts = await prisma.price_change_alerts.findMany({
        where: {
          is_dismissed: false,
        },
        select: {
          asin: true,
          priority: true,
        },
      });

      let relevantAlerts = priceAlerts;

      if (alertFilter === "critical_alerts") {
        relevantAlerts = relevantAlerts.filter(alert => alert.priority === "critical");
      } else if (alertFilter === "high_alerts") {
        relevantAlerts = relevantAlerts.filter(alert => alert.priority === "high");
      }

      const asinsWithAlerts = [...new Set(relevantAlerts.map(alert => alert.asin))];

      if (alertFilter === "with_alerts" || alertFilter === "critical_alerts" || alertFilter === "high_alerts") {
        if (asinsWithAlerts.length > 0) {
          whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
            in: asinsWithAlerts
          };
        } else {
          return {
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
      } else if (alertFilter === "without_alerts") {
        if (asinsWithAlerts.length > 0) {
          whereClause.Product_Identifiers_MarketplaceASIN_ASIN = {
            notIn: asinsWithAlerts
          };
        }
      }
    }

    // Fetch all matching records
    const allData = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      include: {
        sales_rankings: true,
        offer_listings: true,
        competitive_prices: true,
      },
    });

    // If sorting by rating, we need to fetch ratings
    let ratingsMap: { [key: string]: number } = {};
    if (sortBy === 'rating') {
      const asins = allData
        .map(item => item.Product_Identifiers_MarketplaceASIN_ASIN)
        .filter(Boolean) as string[];

      if (asins.length > 0) {
        const ratings = await prisma.amazon_ratings.findMany({
          where: {
            asin: { in: asins },
          },
          select: {
            asin: true,
            rating: true,
          },
        });

        ratings.forEach(r => {
          ratingsMap[r.asin] = r.rating || 0;
        });
      }
    }

    // Helper function to get best (minimum) rank
    const getBestRank = (rankings: Array<{ rank: bigint | null }> | undefined): bigint => {
      if (!rankings || rankings.length === 0) {
        return BigInt(Number.MAX_SAFE_INTEGER);
      }

      let bestRank = BigInt(Number.MAX_SAFE_INTEGER);
      for (const ranking of rankings) {
        if (ranking.rank !== null && ranking.rank < bestRank) {
          bestRank = ranking.rank;
        }
      }
      return bestRank;
    };

    // Helper function to get lowest price
    const getLowestPrice = (prices: Array<{ price_amount: number | null }> | undefined): number => {
      if (!prices || prices.length === 0) {
        return Number.MAX_VALUE;
      }

      let lowestPrice = Number.MAX_VALUE;
      for (const price of prices) {
        if (price.price_amount !== null && price.price_amount < lowestPrice) {
          lowestPrice = price.price_amount;
        }
      }
      return lowestPrice;
    };

    // Sort in-memory based on sortBy parameter
    let sortedData = [...allData];

    if (sortBy === 'price') {
      sortedData.sort((a, b) => {
        const priceA = getLowestPrice(a.competitive_prices);
        const priceB = getLowestPrice(b.competitive_prices);
        const diff = priceA - priceB;
        return sortOrder === 'asc' ? diff : -diff;
      });
    } else if (sortBy === 'ranking') {
      sortedData.sort((a, b) => {
        const rankA = getBestRank(a.sales_rankings);
        const rankB = getBestRank(b.sales_rankings);

        let result: number;
        if (rankA < rankB) {
          result = -1;
        } else if (rankA > rankB) {
          result = 1;
        } else {
          result = 0;
        }

        return sortOrder === 'asc' ? result : -result;
      });
    } else if (sortBy === 'rating') {
      sortedData.sort((a, b) => {
        const asin_a = a.Product_Identifiers_MarketplaceASIN_ASIN || '';
        const asin_b = b.Product_Identifiers_MarketplaceASIN_ASIN || '';

        const ratingA = ratingsMap[asin_a] ?? -1;
        const ratingB = ratingsMap[asin_b] ?? -1;

        const diff = ratingA - ratingB;
        return sortOrder === 'asc' ? diff : -diff;
      });
    } else if (sortBy === 'sku') {
      sortedData.sort((a, b) => {
        const skuA = (a.SellerSKU || '').toLowerCase();
        const skuB = (b.SellerSKU || '').toLowerCase();
        const result = skuA.localeCompare(skuB);
        return sortOrder === 'asc' ? result : -result;
      });
    } else if (sortBy === 'status') {
      sortedData.sort((a, b) => {
        const statusA = (a.status || '').toLowerCase();
        const statusB = (b.status || '').toLowerCase();
        const result = statusA.localeCompare(statusB);
        return sortOrder === 'asc' ? result : -result;
      });
    } else if (sortBy === 'date') {
      sortedData.sort((a, b) => {
        const dateA = a.created_at?.getTime() ?? 0;
        const dateB = b.created_at?.getTime() ?? 0;
        const diff = dateA - dateB;
        return sortOrder === 'asc' ? diff : -diff;
      });
    } else {
      // Default sort by date descending
      sortedData.sort((a, b) => {
        const dateA = a.created_at?.getTime() ?? 0;
        const dateB = b.created_at?.getTime() ?? 0;
        return dateB - dateA;
      });
    }

    // Apply pagination after sorting
    const total = sortedData.length;
    const paginatedData = sortedData.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedData as CompetitivePricingData[],
      pagination: { page, limit, total, totalPages },
    };
  } catch (error) {
    console.error("Error fetching competitive pricing data with advanced sort:", error);
    throw new Error("Failed to fetch competitive pricing data");
  }
}

/**
 * Bulk fetch related competitive data for multiple ASINs/SKUs (OPTIMIZED)
 * Replaces multiple getRelatedCompetitivePricingData calls
 */
export async function getBulkRelatedCompetitiveData(
  items: Array<{ asin?: string; sellerSku?: string }>
): Promise<RelatedCompetitiveData> {
  try {
    if (!items || items.length === 0) {
      return {};
    }

    // Extract all unique ASINs and SKUs
    const asins = [...new Set(items
      .map(item => item.asin)
      .filter(Boolean))] as string[];

    const sellerSkus = [...new Set(items
      .map(item => item.sellerSku)
      .filter(Boolean))] as string[];

    if (asins.length === 0 && sellerSkus.length === 0) {
      return {};
    }

    // Fetch all competitor mappings in one query
    const competitorMappings = await prisma.competitor_product_mappings.findMany({
      where: {
        OR: [
          ...(asins.length > 0 ? [{ our_asin: { in: asins } }] : []),
          ...(sellerSkus.length > 0 ? [{ our_seller_sku: { in: sellerSkus } }] : []),
        ],
      },
    });

    if (competitorMappings.length === 0) {
      return {};
    }

    // Get all unique competitor ASINs
    const competitorAsins = [...new Set(
      competitorMappings.map(m => m.competitor_asin)
    )];

    // Fetch ALL competitor data in one query
    const allCompetitors = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      where: {
        Product_Identifiers_MarketplaceASIN_ASIN: {
          in: competitorAsins,
        },
      },
      include: {
        sales_rankings: true,
        competitive_prices: true,
        offer_listings: true,
      },
    });

    // Create a map for quick lookup
    const competitorMap = new Map(
      allCompetitors.map(comp => [
        comp.Product_Identifiers_MarketplaceASIN_ASIN,
        comp
      ])
    );

    // Group mappings by our_asin and our_seller_sku
    const resultMap: RelatedCompetitiveData = {};

    items.forEach(item => {
      const key = item.asin || item.sellerSku || "";
      if (!key) return;

      const relevantMappings = competitorMappings.filter(m =>
        (item.asin && m.our_asin === item.asin) ||
        (item.sellerSku && m.our_seller_sku === item.sellerSku)
      );

      const competitorData = relevantMappings
        .map(mapping => {
          const competitor = competitorMap.get(mapping.competitor_asin);
          if (!competitor) return null;

          return {
            id: competitor.id,
            SellerSKU: competitor.SellerSKU || mapping.competitor_seller_id,
            status: competitor.status,
            Product_Identifiers_SKUIdentifier_MarketplaceId:
              competitor.Product_Identifiers_SKUIdentifier_MarketplaceId,
            Product_Identifiers_SKUIdentifier_SellerId:
              competitor.Product_Identifiers_SKUIdentifier_SellerId,
            Product_Identifiers_SKUIdentifier_SellerSKU:
              competitor.Product_Identifiers_SKUIdentifier_SellerSKU,
            Product_Identifiers_MarketplaceASIN_MarketplaceId:
              competitor.Product_Identifiers_MarketplaceASIN_MarketplaceId,
            Product_Identifiers_MarketplaceASIN_ASIN:
              competitor.Product_Identifiers_MarketplaceASIN_ASIN,
            created_at: competitor.created_at,
            updated_at: competitor.updated_at,
            sales_rankings: competitor.sales_rankings,
            competitive_prices: competitor.competitive_prices,
            offer_listings: competitor.offer_listings,
          } as CompetitivePricingData;
        })
        .filter(Boolean);

      resultMap[key] = { competitorData };
    });

    return resultMap;
  } catch (error) {
    console.error("Error fetching bulk related competitive data:", error);
    return {};
  }
}

/**
 * Single item related data fetch (for backward compatibility)
 */
export async function getRelatedCompetitivePricingData(
  asin?: string,
  sellerSku?: string
): Promise<{ competitorData: CompetitivePricingData[] }> {
  try {
    const result = await getBulkRelatedCompetitiveData([{ asin, sellerSku }]);
    const key = asin || sellerSku || "";
    return result[key] || { competitorData: [] };
  } catch (error) {
    console.error("Error fetching related competitive pricing data:", error);
    return { competitorData: [] };
  }
}

/**
 * Bulk fetch product ratings (OPTIMIZED)
 */
export async function getBulkProductRatings(
  asins: string[]
): Promise<{ [key: string]: any }> {
  try {
    if (!asins || asins.length === 0) return {};

    const uniqueAsins = [...new Set(asins)];

    const ratings = await prisma.amazon_ratings.findMany({
      where: {
        asin: { in: uniqueAsins },
      },
      select: {
        asin: true,
        rating: true,
        created_at: true,
      },
    });

    const ratingMap: { [key: string]: any } = {};
    ratings.forEach(rating => {
      ratingMap[rating.asin] = {
        asin: rating.asin,
        rating: rating.rating,
        created_at: rating.created_at,
      };
    });

    return ratingMap;
  } catch (error) {
    console.error("Error fetching bulk product ratings:", error);
    return {};
  }
}

/**
 * Bulk fetch competitor ratings (OPTIMIZED)
 */
export async function getBulkCompetitorRatings(
  asins: string[]
): Promise<{ [key: string]: any[] }> {
  try {
    if (!asins || asins.length === 0) return {};

    const uniqueAsins = [...new Set(asins)];

    const ratings = await prisma.competitor_ratings.findMany({
      where: {
        asin: { in: uniqueAsins },
      },
    });

    const ratingMap: { [key: string]: any[] } = {};
    ratings.forEach(rating => {
      if (!ratingMap[rating.asin]) {
        ratingMap[rating.asin] = [];
      }
      ratingMap[rating.asin].push(rating);
    });

    return ratingMap;
  } catch (error) {
    console.error("Error fetching bulk competitor ratings:", error);
    return {};
  }
}

export async function getCompetiveProductsMap() {
  try {
    const data = await prisma.competitor_product_mappings.findMany({
      select: {
        our_asin: true,
        competitor_asin: true,
      }
    });
    return data;
  } catch (error) {
    console.error("Error fetching competitive products map:", error);
    throw new Error("Failed to fetch competitive products map");
  }
}

export async function getCompetitionCompetitivePricingData(
  filters: CompetitivePricingFilters = {}
): Promise<PaginatedResult<CompetitivePricingData>> {
  try {
    const {
      searchTerm = "",
      statusFilter = "all",
      page = 1,
      limit = 10,
    } = filters;

    const whereClause: any = {};

    if (searchTerm) {
      whereClause.OR = [
        {
          SellerSKU: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
        {
          Product_Identifiers_MarketplaceASIN_ASIN: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      ];
    }

    if (statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    const total = await prisma.aMZN_competitive_pricing_main_competitors.count({
      where: whereClause,
    });

    const data = await prisma.aMZN_competitive_pricing_main_competitors.findMany({
      where: whereClause,
      include: {
        sales_rankings: true,
        competitive_prices: true,
        offer_listings: true,
      },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    const transformedData: CompetitivePricingData[] = data.map((item) => ({
      id: item.id,
      SellerSKU: item.SellerSKU,
      status: item.status,
      Product_Identifiers_SKUIdentifier_MarketplaceId:
        item.Product_Identifiers_SKUIdentifier_MarketplaceId,
      Product_Identifiers_SKUIdentifier_SellerId:
        item.Product_Identifiers_SKUIdentifier_SellerId,
      Product_Identifiers_SKUIdentifier_SellerSKU:
        item.Product_Identifiers_SKUIdentifier_SellerSKU,
      Product_Identifiers_MarketplaceASIN_MarketplaceId:
        item.Product_Identifiers_MarketplaceASIN_MarketplaceId,
      Product_Identifiers_MarketplaceASIN_ASIN:
        item.Product_Identifiers_MarketplaceASIN_ASIN,
      created_at: item.created_at,
      sales_rankings: item.sales_rankings,
      competitive_prices: item.competitive_prices,
      offer_listings: item.offer_listings,
    }));

    return {
      data: transformedData,
      pagination: { page, limit, total, totalPages },
    };
  } catch (error) {
    console.error("Error fetching competitor competitive pricing data:", error);
    throw new Error("Failed to fetch competitor competitive pricing data");
  }
}

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
      totalSalesRankings,
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main_competitors.count(),
      prisma.aMZN_competitive_pricing_main_competitors.count({
        where: { status: "Active" },
      }),
      prisma.aMZN_competitive_prices_competitors.count(),
      prisma.aMZN_sales_rankings_competitors.count(),
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
    };
  } catch (error) {
    console.error("Error fetching competitor stats:", error);
    throw new Error("Failed to fetch competitor dashboard statistics");
  }
}

export async function deleteCompetitivePricingRecord(
  id: number
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.aMZN_sales_rankings.deleteMany({
        where: { competitive_pricing_main_id: id },
      });

      await tx.aMZN_offer_listings.deleteMany({
        where: { competitive_pricing_main_id: id },
      });

      await tx.aMZN_competitive_prices.deleteMany({
        where: { competitive_pricing_main_id: id },
      });

      await tx.aMZN_competitive_pricing_main.delete({
        where: { id },
      });
    });

    revalidatePath("/dashboard/competitive-pricing");

    return {
      success: true,
      message: "Record deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting competitive pricing record:", error);
    return {
      success: false,
      message: "Failed to delete record",
    };
  }
}

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
      const mainRecord = await tx.aMZN_competitive_pricing_main.create({
        data: {
          SellerSKU: data.sellerSKU,
          status: data.status,
          Product_Identifiers_SKUIdentifier_MarketplaceId: data.marketplaceId,
          Product_Identifiers_SKUIdentifier_SellerId: data.sellerId,
          Product_Identifiers_SKUIdentifier_SellerSKU: data.sellerSKU,
          Product_Identifiers_MarketplaceASIN_MarketplaceId: data.marketplaceId,
          Product_Identifiers_MarketplaceASIN_ASIN: data.asin,
        },
      });

      if (data.salesRankings && data.salesRankings.length > 0) {
        await tx.aMZN_sales_rankings.createMany({
          data: data.salesRankings.map((ranking) => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            product_category_id: ranking.product_category_id,
            rank: BigInt(ranking.rank),
          })),
        });
      }

      if (data.offerListings && data.offerListings.length > 0) {
        await tx.aMZN_offer_listings.createMany({
          data: data.offerListings.map((offer) => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            condition: offer.condition,
            count: BigInt(offer.count),
          })),
        });
      }

      if (data.competitivePrices && data.competitivePrices.length > 0) {
        await tx.aMZN_competitive_prices.createMany({
          data: data.competitivePrices.map((price) => ({
            competitive_pricing_main_id: mainRecord.id,
            seller_sku: data.sellerSKU,
            belongs_to_requester: price.belongs_to_requester,
            condition: price.condition,
            fulfillment_channel: price.fulfillment_channel,
            offer_type: price.offer_type,
            price_amount: price.price_amount,
            price_currency: price.price_currency,
            shipping_amount: price.shipping_amount
              ? BigInt(price.shipping_amount)
              : null,
            shipping_currency: price.shipping_currency,
            subcategory: price.subcategory,
          })),
        });
      }

      return mainRecord;
    });

    revalidatePath("/dashboard/competitive-pricing");

    return {
      success: true,
      message: "Record created successfully",
      id: result.id,
    };
  } catch (error) {
    console.error("Error creating competitive pricing record:", error);
    return {
      success: false,
      message: "Failed to create record",
    };
  }
}

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
          Product_Identifiers_MarketplaceASIN_MarketplaceId: data.marketplaceId,
        }),
        ...(data.sellerId && {
          Product_Identifiers_SKUIdentifier_SellerId: data.sellerId,
        }),
        ...(data.sellerSKU && {
          Product_Identifiers_SKUIdentifier_SellerSKU: data.sellerSKU,
        }),
        ...(data.asin && {
          Product_Identifiers_MarketplaceASIN_ASIN: data.asin,
        }),
      },
    });

    revalidatePath("/dashboard/competitive-pricing");

    return {
      success: true,
      message: "Record updated successfully",
    };
  } catch (error) {
    console.error("Error updating competitive pricing record:", error);
    return {
      success: false,
      message: "Failed to update record",
    };
  }
}

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
      totalSalesRankings,
    ] = await Promise.all([
      prisma.aMZN_competitive_pricing_main.count(),
      prisma.price_change_alerts.count({ where: { alert_type: "competitor_undercut" } }),
      prisma.price_change_alerts.count({ where: { alert_type: "rank_comparison" } }),
      prisma.aMZN_competitive_pricing_main_competitors.count(),
    ]);

    return {
      totalProducts,
      activeProducts,
      totalPricePoints,
      totalSalesRankings,
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    throw new Error("Failed to fetch dashboard statistics");
  }
}

export async function bulkDeleteCompetitivePricingRecords(
  ids: number[]
): Promise<{ success: boolean; message: string; deletedCount: number }> {
  try {
    let deletedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        await tx.aMZN_sales_rankings.deleteMany({
          where: { competitive_pricing_main_id: id },
        });

        await tx.aMZN_offer_listings.deleteMany({
          where: { competitive_pricing_main_id: id },
        });

        await tx.aMZN_competitive_prices.deleteMany({
          where: { competitive_pricing_main_id: id },
        });

        const result = await tx.aMZN_competitive_pricing_main.delete({
          where: { id },
        });

        if (result) deletedCount++;
      }
    });

    revalidatePath("/dashboard/competitive-pricing");

    return {
      success: true,
      message: `${deletedCount} record(s) deleted successfully`,
      deletedCount,
    };
  } catch (error) {
    console.error("Error bulk deleting records:", error);
    return {
      success: false,
      message: "Failed to delete records",
      deletedCount: 0,
    };
  }
}