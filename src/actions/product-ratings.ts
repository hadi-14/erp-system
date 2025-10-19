'use server';

import { prisma } from '@/lib/prisma';

export interface ProductRatingData {
    asin: string;
    rating: number | null;
    created_at: Date;
}

export interface CompetitorRatingData {
    asin: string;
    rating: number | null;
    competitor_name: string | null;
    created_at: Date;
}

/**
 * Helper function to convert Decimal to number
 */
const decimalToNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    return Number(value);
};

/**
 * Fetch product ratings from the amazon_ratings table by ASIN
 */
export async function getProductRatings(asin: string): Promise<ProductRatingData | null> {
    try {
        if (!asin || asin.trim() === '') {
            return null;
        }

        const ratingData = await prisma.amazon_ratings.findUnique({
            where: {
                asin: asin.trim()
            },
            select: {
                asin: true,
                rating: true,
                created_at: true
            }
        });

        if (!ratingData) {
            return null;
        }

        return {
            asin: ratingData.asin,
            rating: decimalToNumber(ratingData.rating),
            created_at: ratingData.created_at
        };
    } catch (error) {
        console.error(`Error fetching ratings for ASIN ${asin}:`, error);
        return null;
    }
}

/**
 * Fetch competitor ratings by ASIN
 */
export async function getCompetitorRatings(asin: string): Promise<CompetitorRatingData[]> {
    try {
        if (!asin || asin.trim() === '') {
            return [];
        }

        const competitorRatings = await prisma.competitor_ratings.findMany({
            where: {
                asin: asin.trim()
            },
            select: {
                asin: true,
                rating: true,
                competitor_name: true,
                created_at: true
            },
            orderBy: {
                rating: 'desc'
            }
        });

        return competitorRatings.map(rating => ({
            asin: rating.asin,
            rating: decimalToNumber(rating.rating),
            competitor_name: rating.competitor_name,
            created_at: rating.created_at
        }));
    } catch (error) {
        console.error(`Error fetching competitor ratings for ASIN ${asin}:`, error);
        return [];
    }
}

/**
 * Fetch product ratings for multiple ASINs
 */
export async function getProductRatingsBatch(asins: string[]): Promise<ProductRatingData[]> {
    try {
        const validAsins = asins.filter(asin => asin && asin.trim() !== '');

        if (validAsins.length === 0) {
            return [];
        }

        const ratingsData = await prisma.amazon_ratings.findMany({
            where: {
                asin: {
                    in: validAsins
                }
            },
            select: {
                asin: true,
                rating: true,
                created_at: true
            }
        });

        return ratingsData.map(rating => ({
            asin: rating.asin,
            rating: decimalToNumber(rating.rating),
            created_at: rating.created_at
        }));
    } catch (error) {
        console.error('Error fetching ratings batch:', error);
        return [];
    }
}

/**
 * Get average rating stats across all products
 */
export async function getAverageRatingStats() {
    try {
        const stats = await prisma.amazon_ratings.aggregate({
            _avg: {
                rating: true
            },
            _count: true,
            where: {
                rating: {
                    not: null
                }
            }
        });

        const productsWithReviews = await prisma.amazon_ratings.count({
            where: {}
        });

        return {
            averageRating: stats._avg.rating ? Number(decimalToNumber(stats._avg.rating)).toFixed(2) : null,
            ratedProductsCount: stats._count,
            productsWithReviewsCount: productsWithReviews
        };
    } catch (error) {
        console.error('Error fetching average rating stats:', error);
        return {
            averageRating: null,
            ratedProductsCount: 0,
            productsWithReviewsCount: 0
        };
    }
}

/**
 * Get top rated products
 */
export async function getTopRatedProducts(limit: number = 10) {
    try {
        const topProducts = await prisma.amazon_ratings.findMany({
            where: {
                rating: {
                    not: null
                }
            },
            select: {
                asin: true,
                rating: true,
                created_at: true,
                product: {
                    select: {
                        asin1: true,
                        item_name: true,
                        price: true,
                        status: true
                    }
                }
            },
            orderBy: {
                rating: 'desc'
            },
            take: limit
        });

        return topProducts.map(product => ({
            asin: product.asin,
            rating: decimalToNumber(product.rating),
            created_at: product.created_at,
            product_name: product.product?.item_name,
            product_price: decimalToNumber(product.product?.price),
            product_status: product.product?.status
        }));
    } catch (error) {
        console.error('Error fetching top rated products:', error);
        return [];
    }
}

/**
 * Get low rated products (potential issue products)
 */
export async function getLowRatedProducts(limit: number = 10, minReviews: number = 5) {
    try {
        const lowProducts = await prisma.amazon_ratings.findMany({
            where: {
                rating: {
                    lte: 3,
                    not: null
                }
            },
            select: {
                asin: true,
                rating: true,
                created_at: true,
                product: {
                    select: {
                        asin1: true,
                        item_name: true,
                        price: true,
                        status: true
                    }
                }
            },
            orderBy: {
                rating: 'asc'
            },
            take: limit
        });

        return lowProducts.map(product => ({
            asin: product.asin,
            rating: decimalToNumber(product.rating),
            created_at: product.created_at,
            product_name: product.product?.item_name,
            product_price: decimalToNumber(product.product?.price),
            product_status: product.product?.status
        }));
    } catch (error) {
        console.error('Error fetching low rated products:', error);
        return [];
    }
}