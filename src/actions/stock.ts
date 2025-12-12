'use server';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== WAREHOUSE ACTIONS ====================

export async function getWarehouses() {
  try {
    return await prisma.warehouses.findMany({
      include: { racks: true },
      orderBy: { created_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    throw new Error('Failed to fetch warehouses');
  }
}

export async function getWarehouseById(id: number) {
  try {
    return await prisma.warehouses.findUnique({
      where: { id },
      include: {
        racks: true,
        stock_items: true
      }
    });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    throw new Error('Failed to fetch warehouse');
  }
}

export async function createWarehouse(data: {
  code: string;
  name: string;
  location: string;
  capacity: number;
}) {
  try {
    const existing = await prisma.warehouses.findUnique({
      where: { code: data.code }
    });

    if (existing) {
      throw new Error('Warehouse code already exists');
    }

    return await prisma.warehouses.create({
      data: {
        code: data.code,
        name: data.name,
        location: data.location,
        capacity: data.capacity,
        available_space: data.capacity
      }
    });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    throw error;
  }
}

export async function updateWarehouse(
  id: number,
  data: Partial<{
    code: string;
    name: string;
    location: string;
    capacity: number;
    status: string;
  }>
) {
  try {
    return await prisma.warehouses.update({
      where: { id },
      data
    });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    throw new Error('Failed to update warehouse');
  }
}

export async function deleteWarehouse(id: number) {
  try {
    const stockCount = await prisma.stock_items.count({
      where: { warehouse_id: id }
    });

    if (stockCount > 0) {
      throw new Error('Cannot delete warehouse with stock items');
    }

    return await prisma.warehouses.delete({
      where: { id }
    });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    throw error;
  }
}

// ==================== RACK ACTIONS ====================

export async function getRacks(warehouseId?: number) {
  try {
    return await prisma.racks.findMany({
      where: warehouseId ? { warehouse_id: warehouseId } : {},
      include: { warehouse: true },
      orderBy: { code: 'asc' }
    });
  } catch (error) {
    console.error('Error fetching racks:', error);
    throw new Error('Failed to fetch racks');
  }
}

export async function getRackById(id: number) {
  try {
    return await prisma.racks.findUnique({
      where: { id },
      include: {
        warehouse: true,
        stock_items: true
      }
    });
  } catch (error) {
    console.error('Error fetching rack:', error);
    throw new Error('Failed to fetch rack');
  }
}

export async function createRack(data: {
  warehouse_id: number;
  code: string;
  level: number;
  capacity: number;
}) {
  try {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id: data.warehouse_id }
    });

    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    const existing = await prisma.racks.findFirst({
      where: {
        warehouse_id: data.warehouse_id,
        code: data.code
      }
    });

    if (existing) {
      throw new Error('Rack code already exists in this warehouse');
    }

    return await prisma.racks.create({
      data: {
        warehouse_id: data.warehouse_id,
        code: data.code,
        level: data.level,
        capacity: data.capacity,
        available_space: data.capacity
      }
    });
  } catch (error) {
    console.error('Error creating rack:', error);
    throw error;
  }
}

export async function updateRack(
  id: number,
  data: Partial<{
    code: string;
    level: number;
    capacity: number;
    status: string;
  }>
) {
  try {
    return await prisma.racks.update({
      where: { id },
      data
    });
  } catch (error) {
    console.error('Error updating rack:', error);
    throw new Error('Failed to update rack');
  }
}

export async function deleteRack(id: number) {
  try {
    const stockCount = await prisma.stock_items.count({
      where: { rack_id: id }
    });

    if (stockCount > 0) {
      throw new Error('Cannot delete rack with stock items');
    }

    return await prisma.racks.delete({
      where: { id }
    });
  } catch (error) {
    console.error('Error deleting rack:', error);
    throw error;
  }
}

// ==================== STOCK ITEMS ACTIONS ====================

export async function getStockItems(filters?: {
  warehouseId?: number;
  rackId?: number;
  status?: string;
  searchSku?: string;
}) {
  try {
    return await prisma.stock_items.findMany({
      where: {
        ...(filters?.warehouseId && { warehouse_id: filters.warehouseId }),
        ...(filters?.rackId && { rack_id: filters.rackId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.searchSku && { sku: { contains: filters.searchSku, mode: 'insensitive' } })
      },
      include: {
        warehouse: true,
        rack: true,
        movements: { take: 5, orderBy: { created_at: 'desc' } }
      },
      orderBy: { updated_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching stock items:', error);
    throw new Error('Failed to fetch stock items');
  }
}

export async function getStockItemById(id: number) {
  try {
    return await prisma.stock_items.findUnique({
      where: { id },
      include: {
        warehouse: true,
        rack: true,
        movements: { orderBy: { created_at: 'desc' } }
      }
    });
  } catch (error) {
    console.error('Error fetching stock item:', error);
    throw new Error('Failed to fetch stock item');
  }
}

export async function createStockItem(data: {
  sku: string;
  warehouse_id: number;
  rack_id?: number;
  quantity: number;
  reorder_level?: number;
}) {
  try {
    const existing = await prisma.stock_items.findUnique({
      where: { sku: data.sku }
    });

    if (existing) {
      throw new Error('SKU already exists');
    }

    return await prisma.stock_items.create({
      data: {
        sku: data.sku,
        warehouse_id: data.warehouse_id,
        rack_id: data.rack_id || null,
        quantity: data.quantity,
        available_quantity: data.quantity,
        reorder_level: data.reorder_level || 10,
        status: data.quantity === 0 ? 'out_of_stock' : 'in_stock'
      }
    });
  } catch (error) {
    console.error('Error creating stock item:', error);
    throw error;
  }
}

export async function updateStockItem(
  id: number,
  data: Partial<{
    quantity: number;
    reserved_quantity: number;
    reorder_level: number;
    status: string;
    rack_id: number | null;
  }>
) {
  try {
    return await prisma.stock_items.update({
      where: { id },
      data
    });
  } catch (error) {
    console.error('Error updating stock item:', error);
    throw new Error('Failed to update stock item');
  }
}

export async function updateStockQuantity(
  id: number,
  quantity: number,
  movementType: string,
  reason?: string
) {
  try {
    const stockItem = await prisma.stock_items.findUnique({ 
      where: { id } 
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const newQuantity = movementType === 'inbound' 
      ? stockItem.quantity + quantity 
      : stockItem.quantity - quantity;

    if (newQuantity < 0) {
      throw new Error('Insufficient stock for outbound movement');
    }

    const updatedItem = await prisma.stock_items.update({
      where: { id },
      data: {
        quantity: newQuantity,
        available_quantity: newQuantity - stockItem.reserved_quantity,
        status: newQuantity === 0 ? 'out_of_stock' : 
                newQuantity <= stockItem.reorder_level ? 'low_stock' : 'in_stock'
      }
    });

    await prisma.stock_movements.create({
      data: {
        stock_item_id: id,
        movement_type: movementType,
        quantity,
        reason
      }
    });

    return updatedItem;
  } catch (error) {
    console.error('Error updating stock quantity:', error);
    throw error;
  }
}

export async function deleteStockItem(id: number) {
  try {
    return await prisma.stock_items.delete({
      where: { id }
    });
  } catch (error) {
    console.error('Error deleting stock item:', error);
    throw new Error('Failed to delete stock item');
  }
}

// ==================== STOCK MOVEMENTS ACTIONS ====================

export async function getStockMovements(stockItemId?: number) {
  try {
    return await prisma.stock_movements.findMany({
      where: stockItemId ? { stock_item_id: stockItemId } : {},
      include: { stock_item: true },
      orderBy: { created_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    throw new Error('Failed to fetch stock movements');
  }
}

export async function getStockMovementHistory(stockItemId: number, days: number = 30) {
  try {
    return await prisma.stock_movements.findMany({
      where: {
        stock_item_id: stockItemId,
        created_at: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { created_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching movement history:', error);
    throw new Error('Failed to fetch movement history');
  }
}

// ==================== TRANSIT ACTIONS ====================

export async function getTransits(filters?: { 
  status?: string; 
  warehouseId?: number;
  fromDate?: Date;
  toDate?: Date;
}) {
  try {
    return await prisma.transits.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.warehouseId && {
          OR: [
            { from_warehouse_id: filters.warehouseId },
            { to_warehouse_id: filters.warehouseId }
          ]
        }),
        ...(filters?.fromDate && {
          created_at: { gte: filters.fromDate }
        }),
        ...(filters?.toDate && {
          created_at: { lte: filters.toDate }
        })
      },
      include: {
        items: { 
          include: { stock_item: true } 
        }
      },
      orderBy: { created_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching transits:', error);
    throw new Error('Failed to fetch transits');
  }
}

export async function getTransitById(id: number) {
  try {
    return await prisma.transits.findUnique({
      where: { id },
      include: {
        items: { 
          include: { stock_item: true } 
        }
      }
    });
  } catch (error) {
    console.error('Error fetching transit:', error);
    throw new Error('Failed to fetch transit');
  }
}

export async function createTransit(data: {
  reference_no: string;
  from_warehouse_id?: number;
  to_warehouse_id?: number;
  items: Array<{ stock_item_id: number; quantity: number }>;
  expected_delivery?: Date;
}) {
  try {
    const existing = await prisma.transits.findUnique({
      where: { reference_no: data.reference_no }
    });

    if (existing) {
      throw new Error('Transit reference number already exists');
    }

    const transit = await prisma.transits.create({
      data: {
        reference_no: data.reference_no,
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        expected_delivery: data.expected_delivery,
        items: {
          create: data.items.map(item => ({
            stock_item_id: item.stock_item_id,
            quantity: item.quantity
          }))
        }
      },
      include: { items: true }
    });

    for (const item of data.items) {
      const stockItem = await prisma.stock_items.findUnique({
        where: { id: item.stock_item_id }
      });

      if (stockItem) {
        await prisma.stock_items.update({
          where: { id: item.stock_item_id },
          data: {
            reserved_quantity: stockItem.reserved_quantity + item.quantity,
            available_quantity: stockItem.available_quantity - item.quantity
          }
        });

        await prisma.stock_movements.create({
          data: {
            stock_item_id: item.stock_item_id,
            movement_type: 'transit',
            quantity: item.quantity,
            reference_id: transit.id.toString()
          }
        });
      }
    }

    return transit;
  } catch (error) {
    console.error('Error creating transit:', error);
    throw error;
  }
}

export async function updateTransitStatus(id: number, status: string) {
  try {
    const updates: any = { status };
    
    if (status === 'in_transit') {
      updates.shipped_date = new Date();
    } else if (status === 'received') {
      updates.received_date = new Date();
    }

    return await prisma.transits.update({
      where: { id },
      data: updates
    });
  } catch (error) {
    console.error('Error updating transit status:', error);
    throw new Error('Failed to update transit status');
  }
}

export async function receiveTransit(transitId: number, receivedItems: Array<{ id: number; quantity: number }>) {
  try {
    const transit = await prisma.transits.findUnique({
      where: { id: transitId },
      include: { items: true }
    });

    if (!transit) {
      throw new Error('Transit not found');
    }

    for (const received of receivedItems) {
      const transitItem = transit.items.find(i => i.id === received.id);
      if (!transitItem) continue;

      const stockItem = await prisma.stock_items.findUnique({
        where: { id: transitItem.stock_item_id }
      });

      if (stockItem) {
        await prisma.stock_items.update({
          where: { id: stockItem.id },
          data: {
            quantity: stockItem.quantity + received.quantity,
            available_quantity: stockItem.available_quantity + received.quantity,
            reserved_quantity: Math.max(0, stockItem.reserved_quantity - received.quantity),
            status: stockItem.quantity + received.quantity === 0 ? 'out_of_stock' :
                    stockItem.quantity + received.quantity <= stockItem.reorder_level ? 'low_stock' : 'in_stock'
          }
        });

        await prisma.stock_movements.create({
          data: {
            stock_item_id: stockItem.id,
            movement_type: 'received',
            quantity: received.quantity,
            reference_id: transitId.toString()
          }
        });
      }

      await prisma.transit_items.update({
        where: { id: received.id },
        data: {
          received_quantity: received.quantity,
          status: 'received'
        }
      });
    }

    await prisma.transits.update({
      where: { id: transitId },
      data: {
        status: 'received',
        received_date: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error receiving transit:', error);
    throw error;
  }
}

export async function cancelTransit(id: number) {
  try {
    const transit = await prisma.transits.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!transit) {
      throw new Error('Transit not found');
    }

    for (const item of transit.items) {
      const stockItem = await prisma.stock_items.findUnique({
        where: { id: item.stock_item_id }
      });

      if (stockItem) {
        await prisma.stock_items.update({
          where: { id: item.stock_item_id },
          data: {
            reserved_quantity: Math.max(0, stockItem.reserved_quantity - item.quantity),
            available_quantity: stockItem.available_quantity + item.quantity
          }
        });
      }
    }

    return await prisma.transits.update({
      where: { id },
      data: { status: 'cancelled' }
    });
  } catch (error) {
    console.error('Error cancelling transit:', error);
    throw error;
  }
}

// ==================== BULK UPLOAD ACTIONS ====================

export async function uploadStockBulk(file: File) {
  try {
    const text = await file.text();
    const lines = text.split('\n');
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const [sku, warehouse_id, rack_id, quantity, reorder_level] = line.split(',').map(s => s.trim());

        if (!sku || !warehouse_id || !quantity) {
          errorCount++;
          errors.push(`Row ${i}: Missing required fields (SKU, warehouse_id, quantity required)`);
          continue;
        }

        await prisma.stock_items.upsert({
          where: { sku },
          update: {
            quantity: parseInt(quantity),
            warehouse_id: parseInt(warehouse_id),
            rack_id: rack_id ? parseInt(rack_id) : null,
            reorder_level: reorder_level ? parseInt(reorder_level) : 10
          },
          create: {
            sku,
            warehouse_id: parseInt(warehouse_id),
            rack_id: rack_id ? parseInt(rack_id) : null,
            quantity: parseInt(quantity),
            available_quantity: parseInt(quantity),
            reorder_level: reorder_level ? parseInt(reorder_level) : 10
          }
        });

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    await prisma.bulk_uploads.create({
      data: {
        upload_type: 'stock',
        file_name: file.name,
        total_records: lines.length - 1,
        success_count: successCount,
        error_count: errorCount,
        status: errorCount === 0 ? 'completed' : 'completed',
        error_details: errors.length > 0 ? errors.join('\n') : null
      }
    });

    return { successCount, errorCount, errors };
  } catch (error) {
    console.error('Bulk upload failed:', error);
    throw new Error(`Bulk upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function downloadStockTemplate() {
  const headers = ['sku', 'warehouse_id', 'rack_id', 'quantity', 'reorder_level'];
  const sampleData = [
    ['SKU-001', '1', '1', '100', '10'],
    ['SKU-002', '1', '2', '50', '5'],
    ['SKU-003', '2', '', '200', '20']
  ];
  
  const csv = [headers, ...sampleData]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csv;
}

export async function getBulkUploadHistory() {
  try {
    return await prisma.bulk_uploads.findMany({
      orderBy: { created_at: 'desc' }
    });
  } catch (error) {
    console.error('Error fetching bulk upload history:', error);
    throw new Error('Failed to fetch upload history');
  }
}