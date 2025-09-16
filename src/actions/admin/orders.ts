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
        baseInfo_id: orderIdBigInt.toString(),
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

    const groupedOrders = groupOrdersByBaseId(orders);
    return groupedOrders;
  } catch (error) {
    console.error(
      `Error fetching orders batch (offset: ${offset}, size: ${batchSize}):`,
      error
    );
    throw new Error(`Failed to fetch orders batch`);
  }
}

// Update single order approval status
export async function updateOrderApproval(orderId: string, approved: boolean) {
  try {
    if (!orderId || typeof approved !== "boolean") {
      return { success: false, error: "Invalid request data" };
    }

    // Convert string to BigInt for baseInfo_id comparison
    const updatedOrder = await prisma.orders_by_products.updateMany({
      where: {
        baseInfo_id: BigInt(orderId).toString(),
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

// Bulk update order approval status
export async function bulkUpdateOrderApproval(
  orderIds: string[],
  approved: boolean
) {
  try {
    if (!Array.isArray(orderIds) || typeof approved !== "boolean") {
      return { success: false, error: "Invalid request data" };
    }

    // Convert string array to BigInt array for baseInfo_id comparison
    // const bigIntOrderIds = orderIds.map(id => Number(id));
    // console.log('Bulk updating orders:', bigIntOrderIds, 'to approved:', approved, orderIds);

    const updatedOrders = await prisma.orders_by_products.updateMany({
      where: {
        baseInfo_idOfStr: {
          in: orderIds,
        },
      },
      data: {
        approved_: approved,
      },
    });

    revalidatePath("/orders");
    return {
      success: true,
      message: `${updatedOrders.count} order items updated successfully`,
      count: updatedOrders.count,
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
