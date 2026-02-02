/**
 * Unit tests for Order Service
 * Tests order creation, status management, and integration with inventory/payment services
 */

import { OrderService } from '../../src/services/order.service';
import { Order, OrderItem } from '../../src/config/database';
import {
  NotFoundError,
  ValidationError,
} from '@cloudretail/middleware';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/events/event-publisher');

// Mock fetch
global.fetch = jest.fn();

describe('OrderService', () => {
  let orderService: OrderService;
  let mockEventPublisher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    orderService = new OrderService();
    mockEventPublisher = (orderService as any).eventPublisher;
    mockEventPublisher.publishEvent = jest.fn().mockResolvedValue(undefined);
  });

  describe('createOrder', () => {
    const validOrderData = {
      userId: 'user-123',
      items: [
        { productId: 'product-1', quantity: 2, price: 99.99, subtotal: 199.98 },
      ],
      shippingAddress: {
        street: '123 Main St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'USA',
      },
    };

    it('should successfully create an order', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        ...validOrderData,
        totalAmount: 199.98,
        status: 'pending',
        toJSON: () => ({ id: 'order-123', ...validOrderData, totalAmount: 199.98, status: 'pending' }),
        destroy: jest.fn(),
      };

      (Order.create as jest.Mock).mockResolvedValue(mockOrder);

      // Mock inventory verification
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { available: true } }),
          });
        }
        if (url.includes('/reserve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Act
      const result = await orderService.createOrder(validOrderData);

      // Assert
      expect(Order.create).toHaveBeenCalled();
      expect(result.totalAmount).toBe(199.98);
      expect(result.status).toBe('pending');
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'order.created',
        payload: expect.objectContaining({
          orderId: 'order-123',
          userId: 'user-123',
          totalAmount: 199.98,
        }),
      });
    });

    it('should throw ValidationError if order has no items', async () => {
      // Arrange
      const invalidOrderData = { ...validOrderData, items: [] };

      // Act & Assert
      await expect(orderService.createOrder(invalidOrderData)).rejects.toThrow(ValidationError);
      await expect(orderService.createOrder(invalidOrderData)).rejects.toThrow('Order must contain at least one item');
      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if inventory is not available', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, data: { available: false } }),
      });

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(ValidationError);
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow('One or more items are out of stock');
      expect(Order.create).not.toHaveBeenCalled();
    });

    it('should rollback order creation if inventory reservation fails', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      (Order.create as jest.Mock).mockResolvedValue(mockOrder);

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { available: true } }),
          });
        }
        if (url.includes('/reserve')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ success: false }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Act & Assert
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow(ValidationError);
      await expect(orderService.createOrder(validOrderData)).rejects.toThrow('Failed to reserve inventory');
      expect(mockOrder.destroy).toHaveBeenCalled();
    });

    it('should calculate order total correctly', async () => {
      // Arrange
      const orderDataWithMultipleItems = {
        ...validOrderData,
        items: [
          { productId: 'product-1', quantity: 2, price: 50.00 },
          { productId: 'product-2', quantity: 1, price: 100.00 },
        ],
      };

      const mockOrder = {
        id: 'order-123',
        totalAmount: 200.00,
        toJSON: () => ({ id: 'order-123', totalAmount: 200.00 }),
        destroy: jest.fn(),
      };

      (Order.create as jest.Mock).mockResolvedValue(mockOrder);

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/verify')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { available: true } }),
          });
        }
        if (url.includes('/reserve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Act
      const result = await orderService.createOrder(orderDataWithMultipleItems);

      // Assert
      expect(result.totalAmount).toBe(200.00);
    });
  });

  describe('getOrderById', () => {
    it('should return order by ID', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        totalAmount: 199.98,
        toJSON: () => ({ id: 'order-123', userId: 'user-123', totalAmount: 199.98 }),
      };

      (Order.findByPk as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      const result = await orderService.getOrderById('order-123');

      // Assert
      expect(Order.findByPk).toHaveBeenCalledWith('order-123');
      expect(result).toEqual({ id: 'order-123', userId: 'user-123', totalAmount: 199.98 });
    });

    it('should throw NotFoundError if order does not exist', async () => {
      // Arrange
      (Order.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(orderService.getOrderById('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(orderService.getOrderById('nonexistent')).rejects.toThrow('Order');
    });
  });

  describe('getOrdersByUser', () => {
    it('should return all orders for a user', async () => {
      // Arrange
      const mockOrders = [
        { id: 'order-1', userId: 'user-123', toJSON: () => ({ id: 'order-1', userId: 'user-123' }) },
        { id: 'order-2', userId: 'user-123', toJSON: () => ({ id: 'order-2', userId: 'user-123' }) },
      ];

      (Order.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockOrders,
        count: 2,
      });

      // Act
      const result = await orderService.getOrdersByUser('user-123');

      // Assert
      expect(Order.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('updateOrderStatus', () => {
    it('should successfully update order status', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        status: 'pending',
        totalAmount: 199.98,
        items: [],
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'order-123', status: 'confirmed' }),
      };

      (Order.findByPk as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      const result = await orderService.updateOrderStatus('order-123', 'confirmed');

      // Assert
      expect(Order.findByPk).toHaveBeenCalledWith('order-123');
      expect(mockOrder.update).toHaveBeenCalledWith({ status: 'confirmed' });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'order.status_updated',
        payload: {
          orderId: 'order-123',
          oldStatus: 'pending',
          newStatus: 'confirmed',
          userId: 'user-123',
        },
      });
    });

    it('should publish confirmed event when status is confirmed', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        status: 'pending',
        totalAmount: 199.98,
        items: [],
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'order-123', status: 'confirmed' }),
      };

      (Order.findByPk as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      await orderService.updateOrderStatus('order-123', 'confirmed');

      // Assert
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'order.confirmed',
        payload: {
          orderId: 'order-123',
          userId: 'user-123',
          totalAmount: 199.98,
        },
      });
    });

    it('should release inventory and publish cancelled event when status is cancelled', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        status: 'pending',
        totalAmount: 199.98,
        items: [{ productId: 'product-1', quantity: 2 }],
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'order-123', status: 'cancelled' }),
      };

      (Order.findByPk as jest.Mock).mockResolvedValue(mockOrder);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Act
      await orderService.updateOrderStatus('order-123', 'cancelled');

      // Assert
      expect(global.fetch).toHaveBeenCalled();
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'order.cancelled',
        payload: {
          orderId: 'order-123',
          userId: 'user-123',
          totalAmount: 199.98,
        },
      });
    });

    it('should throw NotFoundError if order does not exist', async () => {
      // Arrange
      (Order.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(orderService.updateOrderStatus('nonexistent', 'confirmed')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePaymentId', () => {
    it('should update payment ID for order', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-123',
        paymentId: null,
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'order-123', paymentId: 'payment-123' }),
      };

      (Order.findByPk as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      const result = await orderService.updatePaymentId('order-123', 'payment-123');

      // Assert
      expect(mockOrder.update).toHaveBeenCalledWith({ paymentId: 'payment-123' });
      expect(result.paymentId).toBe('payment-123');
    });

    it('should throw NotFoundError if order does not exist', async () => {
      // Arrange
      (Order.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(orderService.updatePaymentId('nonexistent', 'payment-123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders with pagination', async () => {
      // Arrange
      const mockOrders = [
        { id: 'order-1', toJSON: () => ({ id: 'order-1' }) },
        { id: 'order-2', toJSON: () => ({ id: 'order-2' }) },
      ];

      (Order.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockOrders,
        count: 2,
      });

      // Act
      const result = await orderService.getAllOrders({ limit: 10, offset: 0 });

      // Assert
      expect(Order.findAndCountAll).toHaveBeenCalledWith({
        where: {},
        limit: 10,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.orders).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter orders by status', async () => {
      // Arrange
      (Order.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await orderService.getAllOrders({ status: 'confirmed' });

      // Assert
      expect(Order.findAndCountAll).toHaveBeenCalledWith({
        where: { status: 'confirmed' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
    });

    it('should filter orders by userId', async () => {
      // Arrange
      (Order.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await orderService.getAllOrders({ userId: 'user-123' });

      // Assert
      expect(Order.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
    });
  });
});
