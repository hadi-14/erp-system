"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Updated types to match the serialized data structure from orders.ts
interface Product {
  productID: string;
  name: string;
  quantity: string;
  price: number;
  itemAmount: number;
  productImgUrl: string | null;
  product_list_en?: {
    productID: string;
    name: string;
    price: number;
    productImgUrl: string;
    productSnapshotUrl: string;
    unit: string;
  } | null;
}

interface Order {
  productItems_productID: string;
  productItems_quantity: number;
  productItems_price: number;
  productItems_itemAmount: number;
  id: string;
  baseInfo_id: string;
  baseInfo_createTime: Date | null;
  baseInfo_totalAmount: number | null;
  baseInfo_status: string | null;
  baseInfo_buyerID: string | null;
  baseInfo_buyerContact_name: string | null;
  baseInfo_buyerContact_companyName: string | null;
  approved_: boolean | null;
  products: Product[];
  product_list_en?: {
    productID: string;
    name: string;
    price: number;
    productImgUrl: string;
    productSnapshotUrl: string;
    unit: string;
  } | null;
}

// Fixed interface to match actual data structure
interface TopBuyer {
  baseInfo_buyerID: string;
  baseInfo_buyerContact_name: string;
  baseInfo_buyerContact_companyName: string;
  _count: { id: number };
  _sum: { baseInfo_totalAmount: number };
}

interface TopProduct {
  productItems_productID: string;
  productItems_name: string;
  _count: { id: number };
  _sum: { productItems_quantity: string; productItems_itemAmount: number };
}

interface OrderStats {
  total: number;
  approved: number;
  pending: number;
  totalValue: number;
  topBuyers: TopBuyer[];
  topProducts: TopProduct[];
}

// Proper typing for grouped orders
interface RawOrderData {
  id: bigint;
  baseInfo_id: bigint;
  baseInfo_createTime: Date | null;
  baseInfo_totalAmount: number | null;
  baseInfo_buyerID: string | null;
  baseInfo_buyerContact_name: string | null;
  baseInfo_buyerContact_companyName: string | null;
  baseInfo_status: string | null;
  productItems_productID: bigint | null;
  productItems_name: string | null;
  productItems_quantity: number | null;
  productItems_price: number | null;
  productItems_itemAmount: number | null;
  productItems_productImgUrl: string | null;
  approved_: boolean | null;
  product_list_en?: {
    productID: bigint;
    name: string;
    price: number;
    productImgUrl: string;
    productSnapshotUrl: string;
    unit: string;
  } | null;
}

// Helper function to serialize Prisma data (convert Decimal to number, bigint to string)
function serializeOrder(order: Order) {
  return {
    ...order,
    id: order.id.toString(),
    baseInfo_id: order.baseInfo_id.toString(),
    baseInfo_totalAmount: order.baseInfo_totalAmount
      ? Number(order.baseInfo_totalAmount)
      : null,
    productItems_productID: order.productItems_productID
      ? order.productItems_productID.toString()
      : null,
    productItems_quantity: order.productItems_quantity
      ? order.productItems_quantity.toString()
      : null,
    productItems_price: order.productItems_price
      ? Number(order.productItems_price)
      : null,
    productItems_itemAmount: order.productItems_itemAmount
      ? Number(order.productItems_itemAmount)
      : null,
    product_list_en: order.product_list_en
      ? {
        productID: order.product_list_en.productID.toString(),
        name: order.product_list_en.name,
        price: Number(order.product_list_en.price),
        productImgUrl: order.product_list_en.productImgUrl,
        productSnapshotUrl: order.product_list_en.productSnapshotUrl,
        unit: order.product_list_en.unit,
      }
      : null,
  };
}

// Helper function to group orders by baseInfo_id and aggregate products
function groupOrdersByBaseId(orders: RawOrderData[]) {
  const groupedOrders = new Map();

  orders.forEach((order) => {
    const baseId = order.baseInfo_id.toString();

    if (!groupedOrders.has(baseId)) {
      // Create base order structure
      groupedOrders.set(baseId, {
        id: order.id,
        baseInfo_id: order.baseInfo_id,
        baseInfo_createTime: order.baseInfo_createTime,
        baseInfo_totalAmount: order.baseInfo_totalAmount,
        baseInfo_buyerID: order.baseInfo_buyerID,
        baseInfo_buyerContact_name: order.baseInfo_buyerContact_name,
        baseInfo_buyerContact_companyName:
          order.baseInfo_buyerContact_companyName,
        baseInfo_status: order.baseInfo_status,
        approved_: order.approved_,
        products: [],
      });
    }

    // Add product to the order
    const existingOrder = groupedOrders.get(baseId);
    if (order.productItems_productID) {
      existingOrder.products.push({
        productID: order.productItems_productID,
        name: order.productItems_name,
        quantity: order.productItems_quantity,
        price: order.productItems_price,
        itemAmount: order.productItems_itemAmount,
        productImgUrl: order.productItems_productImgUrl,
        product_list_en: order.product_list_en,
      });
    }
  });

  return Array.from(groupedOrders.values()).map((order) => ({
    ...serializeOrder(order),
    products: order.products.map((product: Product) => ({
      productID: product.productID ? product.productID.toString() : null,
      name: product.name,
      quantity: product.quantity ? product.quantity.toString() : null,
      price: product.price ? Number(product.price) : null,
      itemAmount: product.itemAmount ? Number(product.itemAmount) : null,
      productImgUrl: product.productImgUrl,
      product_list_en: product.product_list_en
        ? {
          productID: product.product_list_en.productID.toString(),
          name: product.product_list_en.name,
          price: Number(product.product_list_en.price),
          productImgUrl: product.product_list_en.productImgUrl,
          productSnapshotUrl: product.product_list_en.productSnapshotUrl,
          unit: product.product_list_en.unit,
        }
        : null,
    })),
  }));
}

// Helper function to serialize stats data
function serializeStats(stats: OrderStats): OrderStats {
  return {
    total: stats.total,
    approved: stats.approved,
    pending: stats.pending,
    totalValue: Number(stats.totalValue),
    topBuyers: stats.topBuyers.map((buyer: TopBuyer) => ({
      baseInfo_buyerID: buyer.baseInfo_buyerID,
      baseInfo_buyerContact_name: buyer.baseInfo_buyerContact_name,
      baseInfo_buyerContact_companyName:
        buyer.baseInfo_buyerContact_companyName,
      _count: buyer._count,
      _sum: {
        baseInfo_totalAmount: buyer._sum.baseInfo_totalAmount
          ? Number(buyer._sum.baseInfo_totalAmount)
          : 0,
      },
    })),
    topProducts: stats.topProducts.map((product: TopProduct) => ({
      productItems_productID: product.productItems_productID.toString(),
      productItems_name: product.productItems_name,
      _count: product._count,
      _sum: {
        productItems_quantity: product._sum.productItems_quantity
          ? product._sum.productItems_quantity.toString()
          : "0",
        productItems_itemAmount: product._sum.productItems_itemAmount
          ? Number(product._sum.productItems_itemAmount)
          : 0,
      },
    })),
  };
}

// Get all orders with products grouped by order ID
export async function getOrdersWithProducts() {
  try {
    const orders = await prisma.orders_by_products.findMany({
      select: {
        id: true,
        baseInfo_id: true,
        baseInfo_createTime: true,
        baseInfo_totalAmount: true,
        baseInfo_buyerID: true,
        baseInfo_buyerContact_name: true,
        baseInfo_buyerContact_companyName: true,
        baseInfo_status: true,
        productItems_productID: true,
        productItems_name: true,
        productItems_quantity: true,
        productItems_price: true,
        productItems_itemAmount: true,
        productItems_productImgUrl: true,
        approved_: true,
        product_list_en: {
          select: {
            productID: true,
            name: true,
            price: true,
            productImgUrl: true,
            productSnapshotUrl: true,
            unit: true,
          },
        },
      },
      orderBy: {
        baseInfo_createTime: "desc",
      },
    });

    // Group orders by baseInfo_id and aggregate products
    // Convert Decimal fields to bigint for RawOrderData compatibility
    const ordersWithBigInt = orders.map((order) => ({
      ...order,
      baseInfo_id: BigInt(order.baseInfo_id.toString()),
      id: BigInt(order.id.toString()),
      productItems_productID:
        order.productItems_productID !== null
          ? BigInt(order.productItems_productID.toString())
          : null,
      productItems_quantity:
        order.productItems_quantity !== null
          ? Number(order.productItems_quantity)
          : null,
      product_list_en: order.product_list_en
        ? {
          ...order.product_list_en,
          productID: BigInt(order.product_list_en.productID.toString()),
        }
        : null,
    }));
    const groupedOrders = groupOrdersByBaseId(ordersWithBigInt);
    return groupedOrders;
  } catch (error) {
    console.error("Error fetching orders:", error);

    // Fallback query without relationships
    try {
      console.log("Trying fallback query without product relationship...");
      const basicOrders = await prisma.orders_by_products.findMany({
        select: {
          id: true,
          baseInfo_id: true,
          baseInfo_createTime: true,
          baseInfo_totalAmount: true,
          baseInfo_buyerID: true,
          baseInfo_buyerContact_name: true,
          baseInfo_buyerContact_companyName: true,
          baseInfo_status: true,
          productItems_productID: true,
          productItems_name: true,
          productItems_quantity: true,
          productItems_price: true,
          productItems_itemAmount: true,
          productItems_productImgUrl: true,
          approved_: true,
          product_list_en: true,
        },
        orderBy: {
          baseInfo_createTime: 'desc',
        },
        take: 50,
      });

      // Convert Decimal fields to bigint for RawOrderData compatibility
      const basicOrdersWithBigInt = basicOrders.map((order) => ({
        ...order,
        baseInfo_id: BigInt(order.baseInfo_id.toString()),
        id: BigInt(order.id.toString()),
        productItems_productID:
          order.productItems_productID !== null
            ? BigInt(order.productItems_productID.toString())
            : null,
        productItems_quantity:
          order.productItems_quantity !== null
            ? Number(order.productItems_quantity)
            : null,
        product_list_en: order.product_list_en
          ? {
            ...order.product_list_en,
            productID: BigInt(order.product_list_en.productID.toString()),
          }
          : null,
      }));
      const groupedBasicOrders = groupOrdersByBaseId(basicOrdersWithBigInt);
      return groupedBasicOrders;
    } catch (fallbackError) {
      console.error("Fallback query also failed:", fallbackError);
      throw new Error(
        "Failed to fetch orders - database connection or data integrity issue"
      );
    }
  }
}

// Get comprehensive order details by order ID
export async function getOrderDetails(orderId: string) {
  try {
    const orderIdBigInt = BigInt(orderId);

    const orderItems = await prisma.orders_by_products.findMany({
      where: {
        baseInfo_id: Number(orderIdBigInt),
      },
      select: {
        id: true,
        baseInfo_id: true,
        baseInfo_createTime: true,
        baseInfo_totalAmount: true,
        baseInfo_buyerID: true,
        baseInfo_buyerContact_name: true,
        baseInfo_buyerContact_companyName: true,
        baseInfo_status: true,
        productItems_productID: true,
        productItems_name: true,
        productItems_quantity: true,
        productItems_price: true,
        productItems_itemAmount: true,
        productItems_productImgUrl: true,
        approved_: true,
        product_list_en: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (orderItems.length === 0) {
      return null;
    }

    // Group the items into a single order with multiple products
    const orderItemsWithBigInt = orderItems.map((order) => ({
      ...order,
      baseInfo_id: BigInt(order.baseInfo_id.toString()),
      id: BigInt(order.id.toString()),
      productItems_productID:
        order.productItems_productID !== null
          ? BigInt(order.productItems_productID.toString())
          : null,
      productItems_quantity:
        order.productItems_quantity !== null
          ? Number(order.productItems_quantity)
          : null,
      product_list_en: order.product_list_en
        ? {
          ...order.product_list_en,
          productID: BigInt(order.product_list_en.productID.toString()),
        }
        : null,
    }));
    const groupedOrders = groupOrdersByBaseId(orderItemsWithBigInt);
    return groupedOrders[0] || null;
  } catch (error) {
    console.error("Error fetching order details:", error);
    return null;
  }
}

// Alternative function to fetch orders in batches
export async function getOrdersInBatches(
  batchSize: number = 50,
  offset: number = 0
) {
  try {
    // First get unique order IDs with pagination
    const uniqueOrderIds = await prisma.orders_by_products.groupBy({
      by: ["baseInfo_id"],
      orderBy: {
        baseInfo_id: "desc",
      },
      skip: offset,
      take: batchSize,
    });

    // Then get all products for these orders
    const orderIdsBigInt = uniqueOrderIds.map((order) => order.baseInfo_id);

    const orders = await prisma.orders_by_products.findMany({
      where: {
        baseInfo_id: {
          in: orderIdsBigInt,
        },
      },
      select: {
        id: true,
        baseInfo_id: true,
        baseInfo_createTime: true,
        baseInfo_totalAmount: true,
        baseInfo_buyerID: true,
        baseInfo_buyerContact_name: true,
        baseInfo_buyerContact_companyName: true,
        baseInfo_status: true,
        productItems_productID: true,
        productItems_name: true,
        productItems_quantity: true,
        productItems_price: true,
        productItems_itemAmount: true,
        productItems_productImgUrl: true,
        approved_: true,
        product_list_en: true,
      },
      orderBy: [
        { baseInfo_createTime: 'desc' },
        { id: 'asc' }
      ],
    });

    // Convert Decimal fields to bigint for RawOrderData compatibility
    const ordersWithBigInt = orders.map((order) => ({
      ...order,
      baseInfo_id: BigInt(order.baseInfo_id.toString()),
      id: BigInt(order.id.toString()),
      productItems_productID:
        order.productItems_productID !== null
          ? BigInt(order.productItems_productID.toString())
          : null,
      productItems_quantity:
        order.productItems_quantity !== null
          ? Number(order.productItems_quantity)
          : null,
      product_list_en: order.product_list_en
        ? {
            ...order.product_list_en,
            productID: BigInt(order.product_list_en.productID.toString()),
          }
        : null,
    }));
    const groupedOrders = groupOrdersByBaseId(ordersWithBigInt);
    return groupedOrders;
  } catch (error) {
    console.error(
      `Error fetching orders batch (offset: ${offset}, size: ${batchSize}):`,
      error
    );
    throw new Error(`Failed to fetch orders batch`);
  }
}

// Update single order approval status with stock management
export async function updateOrderApproval(orderId: string, approved: boolean) {
  try {
    if (!orderId || typeof approved !== "boolean") {
      return { success: false, error: "Invalid request data" };
    }

    // Only process stock updates when approving, not when disapproving
    if (approved) {
      // Get order details with products - orderId comes as baseInfo_id (Float)
      const orderItems = await prisma.orders_by_products.findMany({
        where: {
          baseInfo_id: parseFloat(orderId),
        },
        select: {
          productItems_productID: true,
          productItems_quantity: true,
          baseInfo_totalAmount: true,
          baseInfo_status: true,
        },
      });

      if (orderItems.length === 0) {
        return { success: false, error: "Order not found" };
      }

      // Process each product in the order
      const stockUpdates = [];
      const mappingCreations = [];

      for (const item of orderItems) {
        if (!item.productItems_productID || !item.productItems_quantity) {
          continue;
        }

        const productIdFloat = parseFloat(item.productItems_productID.toString());
        const quantity = Number(item.productItems_quantity);

        // Try to find existing mapping using cn_product_id
        const existingMapping = await prisma.order_mappings.findFirst({
          where: {
            cn_product_id: productIdFloat,
          },
          select: {
            amzn_sku: true,
            amzn_asin: true,
            id: true,
            mapping_confidence: true,
          },
        });

        if (existingMapping?.amzn_sku && existingMapping?.amzn_asin) {
          // Found mapped Amazon product - queue for stock update
          stockUpdates.push({
            sku: existingMapping.amzn_sku,
            asin: existingMapping.amzn_asin,
            quantity: quantity,
            orderId: orderId,
            mappingId: existingMapping.id,
          });
        } else {
          // No mapping found - get CN product details and create partial mapping
          const cnProduct = await prisma.product_list_en.findUnique({
            where: {
              productID: productIdFloat,
            },
            select: {
              productID: true,
              name: true,
              price: true,
              productImgUrl: true,
              unit: true,
            },
          });

          mappingCreations.push({
            cn_product_id: productIdFloat,
            quantity: quantity,
            orderId: orderId,
            productName: cnProduct?.name || `Product ${productIdFloat}`,
            cn_price: cnProduct?.price || null,
            cn_image_url: cnProduct?.productImgUrl || null,
            cn_unit: cnProduct?.unit || null,
          });
        }
      }

      // Execute stock updates for mapped products
      for (const update of stockUpdates) {
        try {
          // Upsert stock item - create if doesn't exist, otherwise update
          await prisma.stock_items.upsert({
            where: { sku: update.sku },
            update: {
              quantity: {
                increment: update.quantity,
              },
              available_quantity: {
                increment: update.quantity,
              },
              updated_at: new Date(),
            },
            create: {
              sku: update.sku,
              quantity: update.quantity,
              available_quantity: update.quantity,
              status: "in_stock",
              warehouse: { connect: { id: 1 } },
            },
          });

          // Log the stock movement
          const stockItem = await prisma.stock_items.findUnique({
            where: { sku: update.sku },
            select: { id: true },
          });

          if (stockItem) {
            await prisma.stock_movements.create({
              data: {
                stock_item_id: stockItem.id,
                movement_type: "inbound",
                quantity: update.quantity,
                reason: "Order approval",
                reference_id: update.orderId,
                notes: `Stock increased from approved order ${update.orderId}`,
              },
            });
          }
        } catch (updateError) {
          console.error(`Failed to update stock for SKU ${update.sku}:`, updateError);
          // Continue with other products even if one fails
        }
      }

      // Create partial mappings for unmapped CN products
      for (const mapping of mappingCreations) {
        try {
          await prisma.order_mappings.create({
            data: {
              custom_sku: `CN-${mapping.cn_product_id}-${Date.now()}`,
              cn_product_id: mapping.cn_product_id,
              cn_product_name: mapping.productName,
              cn_quantity: mapping.quantity,
              cn_price: mapping.cn_price,
              cn_product_image_url: mapping.cn_image_url,
              mapping_confidence: 0.0, // Low confidence - needs manual verification
              mapping_method: "auto_partial",
              mapping_notes: `Partial mapping auto-created during order ${mapping.orderId} approval. CN Product: ${mapping.productName}. Awaiting Amazon SKU/ASIN assignment.`,
              is_verified: false,
            },
          });
        } catch (mappingError) {
          console.error(`Failed to create mapping for product ${mapping.cn_product_id}:`, mappingError);
          // Continue with other products even if one fails
        }
      }
    }

    // Update order approval status for all items in this order
    const updatedOrder = await prisma.orders_by_products.updateMany({
      where: {
        baseInfo_id: parseFloat(orderId),
      },
      data: {
        approved_: approved,
      },
    });

    revalidatePath("/orders");
    return {
      success: true,
      message: "Order approval status updated successfully",
      count: updatedOrder.count,
    };
  } catch (error) {
    console.error("Error updating order approval:", error);
    return { success: false, error: "Failed to update order approval status" };
  }
}

// Bulk update with stock management
export async function bulkUpdateOrderApproval(
  orderIds: string[],
  approved: boolean
) {
  try {
    if (!Array.isArray(orderIds) || typeof approved !== "boolean") {
      return { success: false, error: "Invalid request data" };
    }

    if (orderIds.length === 0) {
      return { success: false, error: "No orders selected" };
    }

    let totalUpdatedItems = 0;
    const failedOrders = [];

    // Process each order individually to properly handle stock management
    for (const orderId of orderIds) {
      try {
        const result = await updateOrderApproval(orderId, approved);
        if (result.success) {
          totalUpdatedItems += result.count || 0;
        } else {
          failedOrders.push({ orderId, error: result.error });
        }
      } catch (orderError) {
        console.error(`Error processing order ${orderId}:`, orderError);
        failedOrders.push({ orderId, error: "Processing failed" });
      }
    }

    revalidatePath("/orders");

    if (failedOrders.length > 0) {
      return {
        success: true, // Partial success
        message: `Updated ${totalUpdatedItems} items with ${failedOrders.length} orders failed`,
        count: totalUpdatedItems,
        failedOrders,
      };
    }

    return {
      success: true,
      message: `${totalUpdatedItems} order items updated successfully`,
      count: totalUpdatedItems,
    };
  } catch (error) {
    console.error("Error bulk updating orders:", error);
    return { success: false, error: "Failed to bulk update orders" };
  }
}

// Helper interface for buyer statistics
interface BuyerStatistic {
  baseInfo_buyerID: string;
  baseInfo_buyerContact_name: string;
  baseInfo_buyerContact_companyName: string;
  _count: { id: number };
  _sum: { baseInfo_totalAmount: number };
  orderIds: Set<string>;
}

// Get comprehensive order statistics
export async function getOrderStats(): Promise<OrderStats> {
  try {
    // Get unique order counts first
    const uniqueOrderCounts = await prisma.orders_by_products.groupBy({
      by: ["baseInfo_id", "approved_"],
      _count: {
        baseInfo_id: true,
      },
    });

    const total = new Set(
      uniqueOrderCounts.map((item) => item.baseInfo_id.toString())
    ).size;
    const approved = uniqueOrderCounts.filter((item) => item.approved_).length;
    const pending = uniqueOrderCounts.filter((item) => !item.approved_).length;

    const [totalValue, topBuyers, topProducts] = await Promise.all([
      // Total order value - handle potential null values
      prisma.orders_by_products
        .groupBy({
          by: ["baseInfo_id"],
          _sum: {
            baseInfo_totalAmount: true,
          },
          where: {
            baseInfo_totalAmount: {
              not: null,
            },
          },
        })
        .then((results) => {
          return results.reduce(
            (sum, order) =>
              sum + (Number(order._sum.baseInfo_totalAmount) || 0),
            0
          );
        }),

      // Top buyers by order count (unique orders only)
      prisma.orders_by_products
        .groupBy({
          by: [
            "baseInfo_buyerID",
            "baseInfo_buyerContact_name",
            "baseInfo_buyerContact_companyName",
            "baseInfo_id",
          ],
          _sum: {
            baseInfo_totalAmount: true,
          },
          where: {
            baseInfo_buyerID: {
              not: null,
            },
          },
        })
        .then((results) => {
          // Group by buyer and count unique orders
          // type BuyerStatTemp = BuyerStatistic & { orderIds: Set<string> };
          const buyerMap = new Map<string, BuyerStatistic>();
          results.forEach((result) => {
            const buyerId = result.baseInfo_buyerID!;
            if (!buyerMap.has(buyerId)) {
              buyerMap.set(buyerId, {
                baseInfo_buyerID: buyerId,
                baseInfo_buyerContact_name:
                  result.baseInfo_buyerContact_name || "",
                baseInfo_buyerContact_companyName:
                  result.baseInfo_buyerContact_companyName || "",
                _count: { id: 0 },
                _sum: { baseInfo_totalAmount: 0 },
                orderIds: new Set(),
              });
            }

            const buyer = buyerMap.get(buyerId)!;
            if (!buyer.orderIds.has(result.baseInfo_id.toString())) {
              buyer.orderIds.add(result.baseInfo_id.toString());
              buyer._count.id++;
              buyer._sum.baseInfo_totalAmount += Number(
                result._sum.baseInfo_totalAmount || 0
              );
            }
          });

          return Array.from(buyerMap.values())
            .sort((a, b) => b._count.id - a._count.id)
            .slice(0, 5)
            .map((buyer) => ({
              baseInfo_buyerID: buyer.baseInfo_buyerID,
              baseInfo_buyerContact_name: buyer.baseInfo_buyerContact_name,
              baseInfo_buyerContact_companyName:
                buyer.baseInfo_buyerContact_companyName,
              _count: { id: buyer._count.id },
              _sum: { baseInfo_totalAmount: buyer._sum.baseInfo_totalAmount },
            }));
        }),

      // Top products by order frequency
      prisma.orders_by_products
        .groupBy({
          by: ["productItems_productID", "productItems_name"],
          _count: {
            id: true,
          },
          _sum: {
            productItems_quantity: true,
            productItems_itemAmount: true,
          },
          where: {
            productItems_productID: {
              not: null,
            },
          },
          orderBy: {
            _count: {
              id: "desc",
            },
          },
          take: 5,
        })
        .then((results) =>
          results.map((product) => ({
            productItems_productID:
              product.productItems_productID?.toString() || "",
            productItems_name: product.productItems_name || "",
            _count: product._count,
            _sum: {
              productItems_quantity:
                product._sum.productItems_quantity?.toString() || "0",
              productItems_itemAmount:
                Number(product._sum.productItems_itemAmount) || 0,
            },
          }))
        ),
    ]);

    const stats: OrderStats = {
      total,
      approved,
      pending,
      totalValue,
      topBuyers,
      topProducts,
    };

    // Serialize the stats to handle Decimal and BigInt types
    return serializeStats(stats);
  } catch (error) {
    console.error("Error fetching order stats:", error);
    return {
      total: 0,
      approved: 0,
      pending: 0,
      totalValue: 0,
      topBuyers: [],
      topProducts: [],
    };
  }
}

// Get product details with related orders
export async function getProductDetails(productId: string) {
  try {
    const productIdBigInt = BigInt(productId);

    const [product, relatedOrders, likesCount] = await Promise.all([
      prisma.product_list_en.findUnique({
        where: {
          productID: productIdBigInt,
        },
      }),

      prisma.orders_by_products.findMany({
        where: {
          productItems_productID: productIdBigInt,
        },
        orderBy: {
          baseInfo_createTime: "desc",
        },
        take: 10,
        select: {
          baseInfo_id: true,
          baseInfo_createTime: true,
          baseInfo_status: true,
          baseInfo_buyerContact_name: true,
          productItems_quantity: true,
          productItems_price: true,
          approved_: true,
        },
      }),

      // Return 0 for likes count since user_product_likes model doesn't exist
      Promise.resolve(0),
    ]);

    // Serialize the product details
    const serializedProduct = product
      ? {
        productID: product.productID.toString(),
        name: product.name,
        price: Number(product.price),
        productImgUrl: product.productImgUrl,
        productSnapshotUrl: product.productSnapshotUrl,
        unit: product.unit,
      }
      : null;

    const serializedRelatedOrders = relatedOrders.map((order) => ({
      baseInfo_id: order.baseInfo_id.toString(),
      baseInfo_createTime: order.baseInfo_createTime,
      baseInfo_status: order.baseInfo_status,
      baseInfo_buyerContact_name: order.baseInfo_buyerContact_name,
      productItems_quantity: order.productItems_quantity
        ? order.productItems_quantity.toString()
        : null,
      productItems_price: order.productItems_price
        ? Number(order.productItems_price)
        : null,
      approved_: order.approved_,
    }));

    return {
      product: serializedProduct,
      relatedOrders: serializedRelatedOrders,
      likesCount,
    };
  } catch (error) {
    console.error("Error fetching product details:", error);
    return {
      product: null,
      relatedOrders: [],
      likesCount: 0,
    };
  }
}
