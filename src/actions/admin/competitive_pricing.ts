'use server';

import { prisma } from "@/lib/prisma"; // Use singleton instance
import { revalidatePath } from 'next/cache';

// Types for competitor mapping
export interface CompetitorMappingFilters {
  searchTerm?: string;
  priorityFilter?: string;
  activeFilter?: string;
  page?: number;
  limit?: number;
}

export interface CompetitorMappingData {
  id: string;
  our_seller_sku: string;
  our_asin: string | null;
  our_product_name: string | null;
  our_marketplace_id: string | null;
  competitor_asin: string;
  competitor_seller_id: string | null;
  competitor_seller_name: string | null;
  competitor_product_name: string | null;
  competitor_marketplace_id: string | null;
  mapping_reason: string | null;
  mapping_notes: string | null;
  mapping_priority: number;
  is_active: boolean;
  created_by_user_id: bigint | null;
  verified_by_user_id: bigint | null;
  last_price_check: Date | null;
  last_ranking_check: Date | null;
  created_at: Date;
  updated_at: Date;
  verified_at: Date | null;
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

export interface AvailableProduct {
  seller_sku: string;
  asin: string | null;
  product_name: string;
}

/**
 * Fetch competitor mapping data with filters and pagination
 */
export async function getCompetitorMappingData(
  filters: CompetitorMappingFilters = {}
): Promise<PaginatedResult<CompetitorMappingData>> {
  try {
    const {
      searchTerm = '',
      priorityFilter = 'all',
      activeFilter = 'all',
      page = 1,
      limit = 10
    } = filters;

    // Build where clause
    const whereClause: any = {};
    
    if (searchTerm) {
      whereClause.OR = [
        {
          our_seller_sku: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          our_asin: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          our_product_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          competitor_asin: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          competitor_seller_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          competitor_product_name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (priorityFilter !== 'all') {
      whereClause.mapping_priority = parseInt(priorityFilter);
    }

    if (activeFilter !== 'all') {
      whereClause.is_active = activeFilter === 'active';
    }

    // Get total count for pagination
    const total = await prisma.competitor_product_mappings.count({
      where: whereClause
    });

    // Get paginated data
    const data = await prisma.competitor_product_mappings.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map(item => ({
        ...item,
        id: item.id.toString() // Convert BigInt to string for JSON serialization
      })) as CompetitorMappingData[],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    console.error('Error fetching competitor mapping data:', error);
    throw new Error('Failed to fetch competitor mapping data');
  }
}

/**
 * Get dashboard statistics for competitor mappings
 */
export async function getCompetitorMappingStats(): Promise<{
  totalMappings: number;
  activeMappings: number;
  highPriorityMappings: number;
  recentMappings: number;
}> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalMappings,
      activeMappings,
      highPriorityMappings,
      recentMappings
    ] = await Promise.all([
      prisma.competitor_product_mappings.count(),
      prisma.competitor_product_mappings.count({
        where: { is_active: true }
      }),
      prisma.competitor_product_mappings.count({
        where: { mapping_priority: 1 }
      }),
      prisma.competitor_product_mappings.count({
        where: { 
          created_at: {
            gte: sevenDaysAgo
          }
        }
      })
    ]);

    return {
      totalMappings,
      activeMappings,
      highPriorityMappings,
      recentMappings
    };
  } catch (error) {
    console.error('Error fetching competitor mapping stats:', error);
    throw new Error('Failed to fetch dashboard statistics');
  }
}

/**
 * Get available products from our inventory
 */
export async function getAvailableProducts(searchTerm: string = ''): Promise<AvailableProduct[]> {
  try {
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

    // Get products from competitive pricing table (our main product source)
    const competitivePricingProducts = await prisma.aMZN_competitive_pricing_main.findMany({
      where: whereClause,
      select: {
        SellerSKU: true,
        Product_Identifiers_MarketplaceASIN_ASIN: true
      },
      // take: 50,
      distinct: ['SellerSKU']
    });

    // Also get products from Amazon product list
    const amazonProducts = await prisma.aMZN_PRODUCT_LIST.findMany({
      where: searchTerm ? {
        OR: [
          {
            seller_sku: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            item_name: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          },
          {
            asin1: {
              contains: searchTerm,
              mode: 'insensitive'
            }
          }
        ]
      } : {},
      select: {
        seller_sku: true,
        asin1: true,
        item_name: true
      },
      take: 25
    });

    // Combine and format results
    const results: AvailableProduct[] = [];
    
    // Add competitive pricing products
    competitivePricingProducts.forEach(product => {
      if (product.SellerSKU) {
        results.push({
          seller_sku: product.SellerSKU,
          asin: product.Product_Identifiers_MarketplaceASIN_ASIN,
          product_name: `Product: ${product.SellerSKU}`
        });
      }
    });

    // Add Amazon product list products
    amazonProducts.forEach(product => {
      if (product.seller_sku && !results.some(r => r.seller_sku === product.seller_sku)) {
        results.push({
          seller_sku: product.seller_sku,
          asin: product.asin1,
          product_name: product.item_name || `Product: ${product.seller_sku}`
        });
      }
    });

    return results.slice(0, 50); // Limit total results
  } catch (error) {
    console.error('Error fetching available products:', error);
    throw new Error('Failed to fetch available products');
  }
}

/**
 * Create a new competitor mapping
 */
export async function createCompetitorMapping(data: {
  our_seller_sku: string;
  our_asin?: string;
  our_product_name?: string;
  competitor_asin: string;
  competitor_seller_name?: string;
  competitor_product_name?: string;
  mapping_reason?: string;
  mapping_notes?: string;
  mapping_priority: number;
}): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    // Check if mapping already exists
    const existingMapping = await prisma.competitor_product_mappings.findFirst({
      where: {
        our_seller_sku: data.our_seller_sku,
        competitor_asin: data.competitor_asin
      }
    });

    if (existingMapping) {
      return {
        success: false,
        message: 'A mapping between this SKU and competitor ASIN already exists'
      };
    }

    const result = await prisma.competitor_product_mappings.create({
      data: {
        our_seller_sku: data.our_seller_sku,
        our_asin: data.our_asin || null,
        our_product_name: data.our_product_name || null,
        our_marketplace_id: 'ATVPDKIKX0DER', // Default to US marketplace
        competitor_asin: data.competitor_asin,
        competitor_seller_name: data.competitor_seller_name || null,
        competitor_product_name: data.competitor_product_name || null,
        competitor_marketplace_id: 'ATVPDKIKX0DER', // Default to US marketplace
        mapping_reason: data.mapping_reason || null,
        mapping_notes: data.mapping_notes || null,
        mapping_priority: data.mapping_priority,
        is_active: true
      }
    });

    revalidatePath('/admin/competitor-mapping');

    return {
      success: true,
      message: 'Competitor mapping created successfully',
      id: result.id.toString()
    };
  } catch (error) {
    console.error('Error creating competitor mapping:', error);
    return {
      success: false,
      message: 'Failed to create competitor mapping'
    };
  }
}

/**
 * Delete a competitor mapping
 */
export async function deleteCompetitorMapping(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.competitor_product_mappings.delete({
      where: { 
        id: BigInt(id)
      }
    });

    revalidatePath('/admin/competitor-mapping');

    return {
      success: true,
      message: 'Competitor mapping deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting competitor mapping:', error);
    return {
      success: false,
      message: 'Failed to delete competitor mapping'
    };
  }
}

/**
 * Toggle mapping active status
 */
export async function toggleMappingStatus(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const mapping = await prisma.competitor_product_mappings.findUnique({
      where: { id: BigInt(id) }
    });

    if (!mapping) {
      return {
        success: false,
        message: 'Mapping not found'
      };
    }

    await prisma.competitor_product_mappings.update({
      where: { id: BigInt(id) },
      data: {
        is_active: !mapping.is_active,
        updated_at: new Date()
      }
    });

    revalidatePath('/admin/competitor-mapping');

    return {
      success: true,
      message: 'Mapping status updated successfully'
    };
  } catch (error) {
    console.error('Error toggling mapping status:', error);
    return {
      success: false,
      message: 'Failed to update mapping status'
    };
  }
}

/**
 * Update competitor mapping
 */
export async function updateCompetitorMapping(
  id: string,
  data: {
    our_seller_sku?: string;
    our_asin?: string;
    our_product_name?: string;
    competitor_asin?: string;
    competitor_seller_name?: string;
    competitor_product_name?: string;
    mapping_reason?: string;
    mapping_notes?: string;
    mapping_priority?: number;
    is_active?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    await prisma.competitor_product_mappings.update({
      where: { id: BigInt(id) },
      data: {
        ...data,
        updated_at: new Date()
      }
    });

    revalidatePath('/admin/competitor-mapping');

    return {
      success: true,
      message: 'Competitor mapping updated successfully'
    };
  } catch (error) {
    console.error('Error updating competitor mapping:', error);
    return {
      success: false,
      message: 'Failed to update competitor mapping'
    };
  }
}

/**
 * Bulk delete competitor mappings
 */
export async function bulkDeleteCompetitorMappings(ids: string[]): Promise<{ 
  success: boolean; 
  message: string; 
  deletedCount: number 
}> {
  try {
    const bigIntIds = ids.map(id => BigInt(id));
    
    const result = await prisma.competitor_product_mappings.deleteMany({
      where: {
        id: {
          in: bigIntIds
        }
      }
    });

    revalidatePath('/admin/competitor-mapping');

    return {
      success: true,
      message: `${result.count} competitor mapping(s) deleted successfully`,
      deletedCount: result.count
    };
  } catch (error) {
    console.error('Error bulk deleting competitor mappings:', error);
    return {
      success: false,
      message: 'Failed to delete competitor mappings',
      deletedCount: 0
    };
  }
}

/**
 * Extract ASIN from Amazon URL or validate ASIN format
 */
export async function extractOrValidateAsin(input: string): Promise<{ 
  success: boolean; 
  asin?: string; 
  message: string 
}> {
  try {
    const trimmedInput = input.trim();
    
    // If it's already an ASIN format, validate it
    const asinRegex = /^[A-Z0-9]{10}$/;
    if (asinRegex.test(trimmedInput)) {
      return {
        success: true,
        asin: trimmedInput,
        message: 'Valid ASIN format'
      };
    }

    // Try to extract ASIN from Amazon URL
    const urlPatterns = [
      /(?:dp|product)\/([A-Z0-9]{10})/i,
      /\/([A-Z0-9]{10})(?:\/|$|\?)/i,
      /asin=([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i
    ];

    for (const pattern of urlPatterns) {
      const match = trimmedInput.match(pattern);
      if (match && match[1]) {
        const extractedAsin = match[1].toUpperCase();
        if (asinRegex.test(extractedAsin)) {
          return {
            success: true,
            asin: extractedAsin,
            message: 'ASIN extracted from URL'
          };
        }
      }
    }

    return {
      success: false,
      message: 'Invalid ASIN format or unable to extract ASIN from URL. Please provide a valid Amazon ASIN (10 characters) or Amazon product URL.'
    };
  } catch (error) {
    console.error('Error extracting/validating ASIN:', error);
    return {
      success: false,
      message: 'Error processing ASIN input'
    };
  }
}

