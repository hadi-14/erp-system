// types/competitive-pricing.ts

export interface CompetitivePricingMain {
  id: number;
  SellerSKU: string | null;
  status: string | null;
  Product_Identifiers_SKUIdentifier_MarketplaceId: string | null;
  Product_Identifiers_SKUIdentifier_SellerId: string | null;
  Product_Identifiers_SKUIdentifier_SellerSKU: string | null;
  Product_Identifiers_MarketplaceASIN_MarketplaceId: string | null;
  Product_Identifiers_MarketplaceASIN_ASIN: string | null;
  created_at: Date | null;
  sales_rankings: SalesRanking[];
  offer_listings: OfferListing[];
  competitive_prices: CompetitivePrice[];
}

export interface SalesRanking {
  competitive_pricing_main_id: number;
  seller_sku: string | null;
  product_category_id: string | null;
  rank: bigint | null;
  created_at: Date | null;
}

export interface OfferListing {
  competitive_pricing_main_id: number;
  seller_sku: string | null;
  condition: string | null;
  count: bigint | null;
  created_at: Date | null;
}

export interface CompetitivePrice {
  competitive_pricing_main_id: number;
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
}

export interface CompetitivePricingFilters {
  searchTerm?: string;
  statusFilter?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'SellerSKU' | 'status';
  sortOrder?: 'asc' | 'desc';
  categoryFilter?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
  totalOfferListings: number;
  averagePrice: number | null;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
}

export interface ServerActionResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface CreateCompetitivePricingData {
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
}

export interface UpdateCompetitivePricingData {
  sellerSKU?: string;
  status?: string;
  marketplaceId?: string;
  sellerId?: string;
  asin?: string;
}

// Enums for better type safety
export enum ProductStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
  SUSPENDED = 'Suspended'
}

export enum FulfillmentChannel {
  AMAZON = 'Amazon',
  MERCHANT = 'Merchant',
  BOTH = 'Both'
}

export enum ProductCondition {
  NEW = 'New',
  USED_LIKE_NEW = 'Used - Like New',
  USED_VERY_GOOD = 'Used - Very Good',
  USED_GOOD = 'Used - Good',
  USED_ACCEPTABLE = 'Used - Acceptable',
  COLLECTIBLE_LIKE_NEW = 'Collectible - Like New',
  COLLECTIBLE_VERY_GOOD = 'Collectible - Very Good',
  COLLECTIBLE_GOOD = 'Collectible - Good',
  COLLECTIBLE_ACCEPTABLE = 'Collectible - Acceptable',
  REFURBISHED = 'Refurbished'
}

export enum OfferType {
  B2C = 'B2C',
  B2B = 'B2B'
}