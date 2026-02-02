import { Order, OrderItem } from '../config/database';
import {
  NotFoundError,
  ValidationError,
  logger,
} from '@cloudretail/middleware';
import { EventPublisher } from '../events/event-publisher';

export class OrderService {
  private eventPublisher: EventPublisher;
  private inventoryServiceUrl: string;
  private paymentServiceUrl: string;

  constructor() {
    this.eventPublisher = new EventPublisher();
    this.inventoryServiceUrl = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';
    this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
  }

  /**
   * Calculate order total from items
   */
  private calculateOrderTotal(items: OrderItem[]): number {
    return items.reduce((total, item) => {
      const subtotal = item.quantity * item.price;
      return total + subtotal;
    }, 0);
  }

  /**
   * Verify inventory availability
   */
  private async verifyInventory(items: OrderItem[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.inventoryServiceUrl}/api/inventory/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.success && result.data.available;
    } catch (error) {
      logger.error('Error verifying inventory', { error });
      return false;
    }
  }

  /**
   * Reserve inventory for order
   */
  private async reserveInventory(orderId: string, items: OrderItem[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.inventoryServiceUrl}/api/inventory/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, items }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      logger.error('Error reserving inventory', { error });
      return false;
    }
  }

  /**
   * Create a new order
   */
  async createOrder(orderData: {
    userId: string;
    items: OrderItem[];
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  }) {
    try {
      // Validate items
      if (!orderData.items || orderData.items.length === 0) {
        throw new ValidationError('Order must contain at least one item');
      }

      // Calculate total with subtotals
      const itemsWithSubtotals = orderData.items.map(item => ({
        ...item,
        subtotal: item.quantity * item.price,
      }));

      const totalAmount = this.calculateOrderTotal(itemsWithSubtotals);

      // Verify inventory availability
      const inventoryAvailable = await this.verifyInventory(itemsWithSubtotals);
      if (!inventoryAvailable) {
        throw new ValidationError('One or more items are out of stock');
      }

      // Create order
      const order = await Order.create({
        ...orderData,
        items: itemsWithSubtotals,
        totalAmount,
        status: 'pending',
      });

      // Reserve inventory
      const inventoryReserved = await this.reserveInventory(order.id, itemsWithSubtotals);
      if (!inventoryReserved) {
        await order.destroy();
        throw new ValidationError('Failed to reserve inventory');
      }

      // Publish order created event
      await this.eventPublisher.publishEvent({
        type: 'order.created',
        payload: {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
          items: order.items,
        },
      });

      logger.info('Order created successfully', { orderId: order.id });

      return order.toJSON();
    } catch (error) {
      logger.error('Error creating order', { error });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new NotFoundError('Order');
    }

    return order.toJSON();
  }

  /**
   * Get orders by user
   */
  async getOrdersByUser(userId: string, limit: number = 100, offset: number = 0) {
    const orders = await Order.findAndCountAll({
      where: { userId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      orders: orders.rows.map((o) => o.toJSON()),
      total: orders.count,
      limit,
      offset,
    };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) {
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new NotFoundError('Order');
    }

    const oldStatus = order.status;
    await order.update({ status });

    // Publish order status updated event
    await this.eventPublisher.publishEvent({
      type: 'order.status_updated',
      payload: {
        orderId: order.id,
        oldStatus,
        newStatus: status,
        userId: order.userId,
      },
    });

    // If order is cancelled, release inventory
    if (status === 'cancelled') {
      await this.releaseInventory(orderId, order.items);

      // Publish order cancelled event
      await this.eventPublisher.publishEvent({
        type: 'order.cancelled',
        payload: {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
        },
      });
    }

    // If order is confirmed, trigger payment processing
    if (status === 'confirmed') {
      await this.eventPublisher.publishEvent({
        type: 'order.confirmed',
        payload: {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
        },
      });
    }

    logger.info('Order status updated', { orderId, oldStatus, newStatus: status });

    return order.toJSON();
  }

  /**
   * Update payment ID for order
   */
  async updatePaymentId(orderId: string, paymentId: string) {
    const order = await Order.findByPk(orderId);

    if (!order) {
      throw new NotFoundError('Order');
    }

    await order.update({ paymentId });

    logger.info('Order payment ID updated', { orderId, paymentId });

    return order.toJSON();
  }

  /**
   * Release inventory for order
   */
  private async releaseInventory(orderId: string, items: OrderItem[]): Promise<void> {
    try {
      await fetch(`${this.inventoryServiceUrl}/api/inventory/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId, items }),
      });
    } catch (error) {
      logger.error('Error releasing inventory', { error });
    }
  }

  /**
   * Get all orders (admin only)
   */
  async getAllOrders(filters?: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    const orders = await Order.findAndCountAll({
      where,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['createdAt', 'DESC']],
    });

    return {
      orders: orders.rows.map((o) => o.toJSON()),
      total: orders.count,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    };
  }
}
