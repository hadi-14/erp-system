"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Types
interface PriceAlert {
  id: bigint;
  asin: string;
  seller_sku: string | null;
  product_name: string | null;
  old_price: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  currency: string;
  alert_type: string;
  competitor_name: string | null;
  is_read: boolean;
  priority: string;
  created_at: Date;
  threshold_triggered: number | null;
  is_dismissed: boolean;
}

interface CreateAlertData {
  asin: string;
  seller_sku?: string;
  product_name?: string;
  old_price: number;
  new_price: number;
  currency: string;
  competitor_name?: string;
  threshold_triggered?: number;
}

interface RankAlertOptions {
  type: "rank";
  competitorRank: number;
  ourRank: number;
  category?: string;
}

// Helper function to calculate alert type and priority
function calculateAlertDetails(
  oldPrice: number,
  newPrice: number,
  thresholdTriggered?: number,
  currency?: string
) {
  const priceChange = newPrice - oldPrice;
  const priceChangePercent = (priceChange / oldPrice) * 100;

  let alertType: string;
  let priority: string;

  // Handle rank alerts differently
  if (currency === "RANK") {
    alertType = "rank_change";

    // For ranks, lower is better, so positive change is worse
    const rankDifference = Math.abs(priceChange);
    const rankChangePercent = Math.abs(priceChangePercent);

    if (rankChangePercent >= 100 || rankDifference >= 50) {
      priority = "critical";
    } else if (rankChangePercent >= 50 || rankDifference >= 20) {
      priority = "high";
    } else if (rankChangePercent >= 25 || rankDifference >= 10) {
      priority = "medium";
    } else {
      priority = "low";
    }
  } else {
    // Regular price alerts
    if (Math.abs(priceChangePercent) >= 25) {
      alertType = "significant_change";
    } else if (priceChange > 0) {
      alertType = "price_increase";
    } else {
      alertType = "price_decrease";
    }

    // Determine priority based on percentage change
    const absChangePercent = Math.abs(priceChangePercent);
    if (absChangePercent >= 30) {
      priority = "critical";
    } else if (absChangePercent >= 15) {
      priority = "high";
    } else if (absChangePercent >= 5) {
      priority = "medium";
    } else {
      priority = "low";
    }
  }

  return { alertType, priority, priceChange, priceChangePercent };
}

// Get all price alerts with optional filtering and improved rank support
export async function getPriceAlerts(
  filter:
    | "all"
    | "unread"
    | "high_priority"
    | "rank_alerts"
    | "price_alerts" = "all",
  limit = 50,
  offset = 0
) {
  try {
    let whereClause: any = {
      is_dismissed: false,
    };

    switch (filter) {
      case "unread":
        whereClause.is_read = false;
        break;
      case "high_priority":
        whereClause.is_read = false;
        whereClause.priority = {
          in: ["high", "critical"],
        };
        break;
      case "rank_alerts":
        whereClause.alert_type = "rank_change";
        break;
      case "price_alerts":
        whereClause.alert_type = {
          not: "rank_change",
        };
        break;
    }

    const alerts = await prisma.price_change_alerts.findMany({
      where: whereClause,
      orderBy: [{ priority: "desc" }, { created_at: "desc" }],
      take: limit,
      skip: offset,
    });

    // Get counts for different filters
    const [
      totalCount,
      unreadCount,
      highPriorityCount,
      rankAlertsCount,
      priceAlertsCount,
    ] = await Promise.all([
      prisma.price_change_alerts.count({
        where: { is_dismissed: false },
      }),
      prisma.price_change_alerts.count({
        where: { is_dismissed: false, is_read: false },
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          is_read: false,
          priority: { in: ["high", "critical"] },
        },
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          alert_type: "rank_change",
        },
      }),
      prisma.price_change_alerts.count({
        where: {
          is_dismissed: false,
          alert_type: { not: "rank_change" },
        },
      }),
    ]);

    return {
      success: true,
      alerts: alerts.map((alert) => ({
        ...alert,
        id: Number(alert.id), // Convert BigInt to number for frontend
        // Add helper fields for rank alerts
        isRankAlert: alert.currency === "RANK",
        ourRank: alert.currency === "RANK" ? alert.old_price : undefined,
        competitorRank: alert.currency === "RANK" ? alert.new_price : undefined,
        rankDifference:
          alert.currency === "RANK" ? alert.price_change : undefined,
      })),
      counts: {
        total: totalCount,
        unread: unreadCount,
        highPriority: highPriorityCount,
        rankAlerts: rankAlertsCount,
        priceAlerts: priceAlertsCount,
      },
    };
  } catch (error) {
    console.error("Error fetching price alerts:", error);
    return {
      success: false,
      error: "Failed to fetch price alerts",
    };
  }
}

// Create a new price alert with rank support
export async function createPriceAlert(data: CreateAlertData) {
  try {
    const { alertType, priority, priceChange, priceChangePercent } =
      calculateAlertDetails(
        data.old_price,
        data.new_price,
        data.threshold_triggered,
        data.currency
      );

    const alert = await prisma.price_change_alerts.create({
      data: {
        asin: data.asin,
        seller_sku: data.seller_sku,
        product_name: data.product_name,
        old_price: data.old_price,
        new_price: data.new_price,
        price_change: priceChange,
        price_change_percent: priceChangePercent,
        currency: data.currency,
        alert_type: alertType,
        competitor_name: data.competitor_name,
        priority,
        threshold_triggered: data.threshold_triggered,
        is_read: false,
        is_dismissed: false,
      },
    });

    revalidatePath("/");

    return {
      success: true,
      alert: {
        ...alert,
        id: Number(alert.id),
      },
    };
  } catch (error) {
    console.error("Error creating price alert:", error);
    return {
      success: false,
      error: "Failed to create price alert",
    };
  }
}

// Mark a single alert as read
export async function markAlertAsRead(alertId: number) {
  try {
    const alert = await prisma.price_change_alerts.update({
      where: { id: BigInt(alertId) },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    revalidatePath("/");

    return {
      success: true,
      alert: {
        ...alert,
        id: Number(alert.id),
      },
    };
  } catch (error) {
    console.error("Error marking alert as read:", error);
    return {
      success: false,
      error: "Failed to mark alert as read",
    };
  }
}

// Mark all alerts as read
export async function markAllAlertsAsRead() {
  try {
    const result = await prisma.price_change_alerts.updateMany({
      where: {
        is_read: false,
        is_dismissed: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    revalidatePath("/");

    return {
      success: true,
      updated: result.count,
    };
  } catch (error) {
    console.error("Error marking all alerts as read:", error);
    return {
      success: false,
      error: "Failed to mark all alerts as read",
    };
  }
}

// Dismiss an alert (soft delete)
export async function dismissAlert(alertId: number) {
  try {
    const alert = await prisma.price_change_alerts.update({
      where: { id: BigInt(alertId) },
      data: {
        is_dismissed: true,
        dismissed_at: new Date(),
      },
    });

    revalidatePath("/");

    return {
      success: true,
      alert: {
        ...alert,
        id: Number(alert.id),
      },
    };
  } catch (error) {
    console.error("Error dismissing alert:", error);
    return {
      success: false,
      error: "Failed to dismiss alert",
    };
  }
}

// Dismiss multiple alerts
export async function dismissMultipleAlerts(alertIds: number[]) {
  try {
    const bigIntIds = alertIds.map((id) => BigInt(id));

    const result = await prisma.price_change_alerts.updateMany({
      where: {
        id: { in: bigIntIds },
      },
      data: {
        is_dismissed: true,
        dismissed_at: new Date(),
      },
    });

    revalidatePath("/");

    return {
      success: true,
      dismissed: result.count,
    };
  } catch (error) {
    console.error("Error dismissing multiple alerts:", error);
    return {
      success: false,
      error: "Failed to dismiss alerts",
    };
  }
}

// Get alert statistics with rank breakdown
export async function getAlertStatistics(days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalAlerts,
      unreadAlerts,
      criticalAlerts,
      alertsByType,
      alertsByPriority,
      rankAlerts,
      priceAlerts,
      recentAlerts,
    ] = await Promise.all([
      // Total alerts in the period
      prisma.price_change_alerts.count({
        where: {
          created_at: { gte: startDate },
          is_dismissed: false,
        },
      }),

      // Unread alerts
      prisma.price_change_alerts.count({
        where: {
          is_read: false,
          is_dismissed: false,
        },
      }),

      // Critical alerts in the period
      prisma.price_change_alerts.count({
        where: {
          priority: "critical",
          created_at: { gte: startDate },
          is_dismissed: false,
        },
      }),

      // Alerts grouped by type
      prisma.price_change_alerts.groupBy({
        by: ["alert_type"],
        where: {
          created_at: { gte: startDate },
          is_dismissed: false,
        },
        _count: true,
      }),

      // Alerts grouped by priority
      prisma.price_change_alerts.groupBy({
        by: ["priority"],
        where: {
          created_at: { gte: startDate },
          is_dismissed: false,
        },
        _count: true,
      }),

      // Rank alerts specifically
      prisma.price_change_alerts.count({
        where: {
          alert_type: "rank_change",
          created_at: { gte: startDate },
          is_dismissed: false,
        },
      }),

      // Price alerts specifically
      prisma.price_change_alerts.count({
        where: {
          alert_type: { not: "rank_change" },
          created_at: { gte: startDate },
          is_dismissed: false,
        },
      }),

      // Recent alerts trend (last 7 days, grouped by day)
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(CASE WHEN alert_type = 'rank_change' THEN 1 ELSE 0 END) as rank_count,
          SUM(CASE WHEN alert_type != 'rank_change' THEN 1 ELSE 0 END) as price_count
        FROM price_change_alerts 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND is_dismissed = false
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
    ]);

    return {
      success: true,
      statistics: {
        total: totalAlerts,
        unread: unreadAlerts,
        critical: criticalAlerts,
        rankAlerts,
        priceAlerts,
        byType: alertsByType.reduce((acc, item) => {
          acc[item.alert_type] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byPriority: alertsByPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {} as Record<string, number>),
        recentTrend: recentAlerts,
      },
    };
  } catch (error) {
    console.error("Error fetching alert statistics:", error);
    return {
      success: false,
      error: "Failed to fetch alert statistics",
    };
  }
}

// Store historical price data
export async function storeHistoricalPrice(
  asin: string,
  price: number,
  currency: string = "USD",
  sellerSku?: string,
  priceType: string = "listing",
  condition: string = "New",
  fulfillmentChannel?: string,
  dataSource: string = "api"
) {
  try {
    await prisma.competitive_historical_prices.deleteMany({
      where: {
        asin,
      },
    });

    const historicalPrice = await prisma.competitive_historical_prices.create({
      data: {
        asin,
        seller_sku: sellerSku,
        price,
        currency,
        price_type: priceType,
        condition,
        fulfillment_channel: fulfillmentChannel,
        data_source: dataSource,
        recorded_at: new Date(),
        notified: false,
      },
    });

    return {
      success: true,
      historicalPrice: {
        ...historicalPrice,
        id: Number(historicalPrice.id),
      },
    };
  } catch (error) {
    console.error("Error storing historical price:", error);
    return {
      success: false,
      error: "Failed to store historical price",
    };
  }
}

// Compare current price with historical data and create alerts if necessary
export async function compareAndCreateAlerts(
  asin: string,
  currentPrice: number,
  currency: string = "USD",
  sellerSku?: string,
  productName?: string,
  competitorName?: string,
  thresholdPercent: number = 10
) {
  try {
    // Get the most recent historical price for this ASIN
    const lastPrice = await prisma.competitive_historical_prices.findFirst({
      where: { asin },
      orderBy: { recorded_at: "desc" },
    });

    if (!lastPrice) {
      // No historical data, just store current price
      await storeHistoricalPrice(asin, currentPrice, currency, sellerSku);
      return {
        success: true,
        alertCreated: false,
        message: "No historical data found, stored current price",
      };
    }
    const priceChangePercent = Math.abs(
      ((currentPrice - lastPrice.price) / lastPrice.price) * 100
    );

    // Check if price change exceeds threshold
    if (priceChangePercent >= thresholdPercent) {
      // Create alert
      const alertResult = await createPriceAlert({
        asin,
        seller_sku: sellerSku,
        product_name: productName,
        old_price: lastPrice.price,
        new_price: currentPrice,
        currency,
        competitor_name: competitorName,
        threshold_triggered: thresholdPercent,
      });

      // Store new historical price
      await storeHistoricalPrice(asin, currentPrice, currency, sellerSku);

      return {
        success: true,
        alertCreated: true,
        alert: alertResult.alert,
        priceChange: currentPrice - lastPrice.price,
        priceChangePercent,
      };
    } else {
      // No significant change, just update historical data
      await storeHistoricalPrice(asin, currentPrice, currency, sellerSku);

      return {
        success: true,
        alertCreated: false,
        message: "Price change below threshold",
        priceChange: currentPrice - lastPrice.price,
        priceChangePercent,
      };
    }
  } catch (error) {
    console.error("Error comparing prices and creating alerts:", error);
    return {
      success: false,
      error: "Failed to compare prices and create alerts",
    };
  }
}

// Get price history for a specific ASIN
export async function getPriceHistory(asin: string, days = 30, limit = 100) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await prisma.competitive_historical_prices.findMany({
      where: {
        asin,
        recorded_at: { gte: startDate },
      },
      orderBy: { recorded_at: "desc" },
      take: limit,
    });

    return {
      success: true,
      history: history.map((record) => ({
        ...record,
        id: Number(record.id),
      })),
    };
  } catch (error) {
    console.error("Error fetching price history:", error);
    return {
      success: false,
      error: "Failed to fetch price history",
    };
  }
}

// Clean up old alerts and historical data
export async function cleanupOldData(alertDays = 90, historyDays = 365) {
  try {
    const alertCutoff = new Date();
    alertCutoff.setDate(alertCutoff.getDate() - alertDays);

    const historyCutoff = new Date();
    historyCutoff.setDate(historyCutoff.getDate() - historyDays);

    const [deletedAlerts, deletedHistory] = await Promise.all([
      prisma.price_change_alerts.deleteMany({
        where: {
          created_at: { lt: alertCutoff },
          is_dismissed: true,
        },
      }),

      prisma.competitive_historical_prices.deleteMany({
        where: {
          recorded_at: { lt: historyCutoff },
        },
      }),
    ]);

    return {
      success: true,
      deletedAlerts: deletedAlerts.count,
      deletedHistoryRecords: deletedHistory.count,
    };
  } catch (error) {
    console.error("Error cleaning up old data:", error);
    return {
      success: false,
      error: "Failed to clean up old data",
    };
  }
}
