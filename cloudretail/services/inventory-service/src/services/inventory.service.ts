import { Inventory } from '../config/database';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  logger,
} from '@cloudretail/middleware';
import { EventPublisher } from '../events/event-publisher';
import sequelize from '../config/database';

const LOW_STOCK_THRESHOLD = 10;

export class InventoryService {
  private eventPublisher: EventPublisher;

  constructor() {
    this.eventPublisher = new EventPublisher();
  }

  /**
   * Create inventory record for a product
   */
  async createInventory(inventoryData: {
    productId: string;
    quantity: number;
    warehouseLocation: string;
  }) {
    try {
      // Check if inventory already exists for this product
      const existingInventory = await Inventory.findOne({
        where: { productId: inventoryData.productId },
      });

      if (existingInventory) {
        throw new ConflictError('Inventory already exists for this product');
      }

      // Validate quantity
      if (inventoryData.quantity < 0) {
        throw new ValidationError('Quantity must be a non-negative number');
      }

      // Create inventory
      const inventory = await Inventory.create({
        ...inventoryData,
        reservedQuantity: 0,
      });

      // Publish inventory created event
      await this.eventPublisher.publishEvent({
        type: 'inventory.created',
        payload: {
          inventoryId: inventory.id,
          productId: inventory.productId,
          quantity: inventory.quantity,
          warehouseLocation: inventory.warehouseLocation,
        },
      });

      logger.info('Inventory created successfully', { inventoryId: inventory.id });

      return inventory.toJSON();
    } catch (error) {
      logger.error('Error creating inventory', { error });
      throw error;
    }
  }

  /**
   * Get inventory by product ID
   */
  async getInventoryByProductId(productId: string) {
    const inventory = await Inventory.findOne({ where: { productId } });

    if (!inventory) {
      throw new NotFoundError('Inventory');
    }

    return {
      ...inventory.toJSON(),
      availableQuantity: inventory.getAvailableQuantity(),
    };
  }

  /**
   * Get inventory by ID
   */
  async getInventoryById(inventoryId: string) {
    const inventory = await Inventory.findByPk(inventoryId);

    if (!inventory) {
      throw new NotFoundError('Inventory');
    }

    return {
      ...inventory.toJSON(),
      availableQuantity: inventory.getAvailableQuantity(),
    };
  }

  /**
   * Update inventory quantity
   */
  async updateInventoryQuantity(productId: string, quantity: number) {
    const inventory = await Inventory.findOne({ where: { productId } });

    if (!inventory) {
      throw new NotFoundError('Inventory');
    }

    if (quantity < 0) {
      throw new ValidationError('Quantity must be a non-negative number');
    }

    if (quantity < inventory.reservedQuantity) {
      throw new ValidationError(
        'Quantity cannot be less than reserved quantity'
      );
    }

    const oldQuantity = inventory.quantity;
    await inventory.update({ quantity });

    // Publish inventory updated event
    await this.eventPublisher.publishEvent({
      type: 'inventory.updated',
      payload: {
        inventoryId: inventory.id,
        productId: inventory.productId,
        oldQuantity,
        newQuantity: quantity,
        availableQuantity: inventory.getAvailableQuantity(),
      },
    });

    // Check for low stock
    const availableQuantity = inventory.getAvailableQuantity();
    if (availableQuantity <= LOW_STOCK_THRESHOLD && availableQuantity > 0) {
      await this.eventPublisher.publishEvent({
        type: 'inventory.low_stock',
        payload: {
          inventoryId: inventory.id,
          productId: inventory.productId,
          availableQuantity,
          threshold: LOW_STOCK_THRESHOLD,
        },
      });
    }

    logger.info('Inventory quantity updated', {
      productId,
      oldQuantity,
      newQuantity: quantity,
    });

    return {
      ...inventory.toJSON(),
      availableQuantity: inventory.getAvailableQuantity(),
    };
  }

  /**
   * Verify inventory availability for items
   */
  async verifyInventory(items: Array<{ productId: string; quantity: number }>) {
    try {
      for (const item of items) {
        const inventory = await Inventory.findOne({
          where: { productId: item.productId },
        });

        if (!inventory) {
          return { available: false, reason: `Product ${item.productId} not found in inventory` };
        }

        const availableQuantity = inventory.getAvailableQuantity();
        if (availableQuantity < item.quantity) {
          return {
            available: false,
            reason: `Insufficient stock for product ${item.productId}. Available: ${availableQuantity}, Requested: ${item.quantity}`,
          };
        }
      }

      return { available: true };
    } catch (error) {
      logger.error('Error verifying inventory', { error });
      throw error;
    }
  }

  /**
   * Reserve inventory for order
   */
  async reserveInventory(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const transaction = await sequelize.transaction();

    try {
      // First verify availability
      const verification = await this.verifyInventory(items);
      if (!verification.available) {
        throw new ValidationError(verification.reason || 'Inventory not available');
      }

      // Reserve inventory for each item
      for (const item of items) {
        const inventory = await Inventory.findOne({
          where: { productId: item.productId },
          transaction,
        });

        if (!inventory) {
          throw new NotFoundError(`Inventory for product ${item.productId}`);
        }

        await inventory.update(
          {
            reservedQuantity: inventory.reservedQuantity + item.quantity,
          },
          { transaction }
        );

        // Check for low stock after reservation
        const availableQuantity = inventory.getAvailableQuantity();
        if (availableQuantity <= LOW_STOCK_THRESHOLD && availableQuantity > 0) {
          await this.eventPublisher.publishEvent({
            type: 'inventory.low_stock',
            payload: {
              inventoryId: inventory.id,
              productId: inventory.productId,
              availableQuantity,
              threshold: LOW_STOCK_THRESHOLD,
            },
          });
        }
      }

      await transaction.commit();

      // Publish inventory reserved event
      await this.eventPublisher.publishEvent({
        type: 'inventory.reserved',
        payload: {
          orderId,
          items,
        },
      });

      logger.info('Inventory reserved successfully', { orderId });

      return { success: true, message: 'Inventory reserved successfully' };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error reserving inventory', { error });
      throw error;
    }
  }

  /**
   * Release reserved inventory (e.g., when order is cancelled)
   */
  async releaseInventory(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const transaction = await sequelize.transaction();

    try {
      for (const item of items) {
        const inventory = await Inventory.findOne({
          where: { productId: item.productId },
          transaction,
        });

        if (!inventory) {
          throw new NotFoundError(`Inventory for product ${item.productId}`);
        }

        const newReservedQuantity = Math.max(0, inventory.reservedQuantity - item.quantity);
        await inventory.update(
          {
            reservedQuantity: newReservedQuantity,
          },
          { transaction }
        );
      }

      await transaction.commit();

      // Publish inventory released event
      await this.eventPublisher.publishEvent({
        type: 'inventory.released',
        payload: {
          orderId,
          items,
        },
      });

      logger.info('Inventory released successfully', { orderId });

      return { success: true, message: 'Inventory released successfully' };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error releasing inventory', { error });
      throw error;
    }
  }

  /**
   * Confirm inventory usage (e.g., when order is shipped)
   */
  async confirmInventoryUsage(orderId: string, items: Array<{ productId: string; quantity: number }>) {
    const transaction = await sequelize.transaction();

    try {
      for (const item of items) {
        const inventory = await Inventory.findOne({
          where: { productId: item.productId },
          transaction,
        });

        if (!inventory) {
          throw new NotFoundError(`Inventory for product ${item.productId}`);
        }

        await inventory.update(
          {
            quantity: inventory.quantity - item.quantity,
            reservedQuantity: Math.max(0, inventory.reservedQuantity - item.quantity),
          },
          { transaction }
        );

        // Check for out of stock
        if (inventory.quantity === 0) {
          await this.eventPublisher.publishEvent({
            type: 'inventory.out_of_stock',
            payload: {
              inventoryId: inventory.id,
              productId: inventory.productId,
            },
          });
        }
      }

      await transaction.commit();

      logger.info('Inventory usage confirmed', { orderId });

      return { success: true, message: 'Inventory usage confirmed' };
    } catch (error) {
      await transaction.rollback();
      logger.error('Error confirming inventory usage', { error });
      throw error;
    }
  }

  /**
   * Get all inventory records
   */
  async getAllInventory(filters?: {
    warehouseLocation?: string;
    lowStock?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.warehouseLocation) {
      where.warehouseLocation = filters.warehouseLocation;
    }

    const inventory = await Inventory.findAndCountAll({
      where,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['createdAt', 'DESC']],
    });

    let results = inventory.rows.map((inv) => ({
      ...inv.toJSON(),
      availableQuantity: inv.getAvailableQuantity(),
    }));

    // Filter by low stock if requested
    if (filters?.lowStock) {
      results = results.filter((inv) => inv.availableQuantity <= LOW_STOCK_THRESHOLD);
    }

    return {
      inventory: results,
      total: filters?.lowStock ? results.length : inventory.count,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    };
  }
}
