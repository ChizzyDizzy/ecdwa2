/**
 * Unit tests for Payment Service
 * Tests payment processing, refunds, and PCI compliance
 */

import { PaymentService } from '../../src/services/payment.service';
import { Payment } from '../../src/config/database';
import {
  NotFoundError,
  ValidationError,
} from '@cloudretail/middleware';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/events/event-publisher');
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-123' }));

// Mock fetch
global.fetch = jest.fn();

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockEventPublisher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new PaymentService();
    mockEventPublisher = (paymentService as any).eventPublisher;
    mockEventPublisher.publishEvent = jest.fn().mockResolvedValue(undefined);

    // Mock Math.random for predictable payment gateway simulation
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createPayment', () => {
    const validPaymentData = {
      orderId: 'order-123',
      userId: 'user-123',
      amount: 199.99,
      currency: 'USD',
      paymentMethod: 'credit_card' as const,
      metadata: {},
    };

    it('should successfully create and process a payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        ...validPaymentData,
        status: 'processing',
        pciCompliant: true,
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', ...validPaymentData, status: 'completed', transactionId: 'txn_mock-uuid-123' }),
      };

      (Payment.findOne as jest.Mock).mockResolvedValue(null);
      (Payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      // Act
      const result = await paymentService.createPayment(validPaymentData);

      // Assert
      expect(Payment.create).toHaveBeenCalledWith({
        ...validPaymentData,
        currency: 'USD',
        status: 'processing',
        pciCompliant: true,
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.initiated',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
          orderId: 'order-123',
          amount: 199.99,
        }),
      });
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'completed',
        transactionId: expect.stringContaining('txn_'),
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.completed',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
          orderId: 'order-123',
        }),
      });
    });

    it('should throw ValidationError if amount is zero or negative', async () => {
      // Arrange
      const invalidData = { ...validPaymentData, amount: 0 };

      // Act & Assert
      await expect(paymentService.createPayment(invalidData)).rejects.toThrow(ValidationError);
      await expect(paymentService.createPayment(invalidData)).rejects.toThrow('Payment amount must be greater than zero');
      expect(Payment.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError if payment already completed for order', async () => {
      // Arrange
      (Payment.findOne as jest.Mock).mockResolvedValue({
        id: 'existing-payment',
        status: 'completed',
        orderId: 'order-123',
      });

      // Act & Assert
      await expect(paymentService.createPayment(validPaymentData)).rejects.toThrow(ValidationError);
      await expect(paymentService.createPayment(validPaymentData)).rejects.toThrow('Payment already completed for this order');
      expect(Payment.create).not.toHaveBeenCalled();
    });

    it('should handle payment gateway failure', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        ...validPaymentData,
        status: 'processing',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', status: 'failed', failureReason: 'Payment declined' }),
      };

      (Payment.findOne as jest.Mock).mockResolvedValue(null);
      (Payment.create as jest.Mock).mockResolvedValue(mockPayment);

      // Simulate payment failure (Math.random() > 0.95)
      jest.spyOn(Math, 'random').mockReturnValue(0.96);

      // Act
      const result = await paymentService.createPayment(validPaymentData);

      // Assert
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'failed',
        failureReason: expect.any(String),
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.failed',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
          orderId: 'order-123',
        }),
      });
    });

    it('should use default currency if not specified', async () => {
      // Arrange
      const dataWithoutCurrency = { ...validPaymentData, currency: undefined };
      const mockPayment = {
        id: 'payment-123',
        status: 'processing',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', currency: 'USD' }),
      };

      (Payment.findOne as jest.Mock).mockResolvedValue(null);
      (Payment.create as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      await paymentService.createPayment(dataWithoutCurrency as any);

      // Assert
      expect(Payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' })
      );
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by ID with redacted card information', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        amount: 199.99,
        metadata: { cardNumber: '4111111111111111' },
        toJSON: () => ({
          id: 'payment-123',
          amount: 199.99,
          metadata: { cardNumber: '4111111111111111' },
        }),
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      const result = await paymentService.getPaymentById('payment-123');

      // Assert
      expect(Payment.findByPk).toHaveBeenCalledWith('payment-123');
      expect(result.metadata.cardNumber).toBe('****1111');
    });

    it('should throw NotFoundError if payment does not exist', async () => {
      // Arrange
      (Payment.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(paymentService.getPaymentById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment for an order', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        toJSON: () => ({ id: 'payment-123', orderId: 'order-123', metadata: {} }),
      };

      (Payment.findOne as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      const result = await paymentService.getPaymentByOrderId('order-123');

      // Assert
      expect(Payment.findOne).toHaveBeenCalledWith({ where: { orderId: 'order-123' } });
      expect(result.id).toBe('payment-123');
    });

    it('should throw NotFoundError if payment not found', async () => {
      // Arrange
      (Payment.findOne as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(paymentService.getPaymentByOrderId('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPaymentsByUser', () => {
    it('should return all payments for a user with redacted card info', async () => {
      // Arrange
      const mockPayments = [
        {
          id: 'payment-1',
          metadata: { cardNumber: '4111111111111111' },
          toJSON: () => ({ id: 'payment-1', metadata: { cardNumber: '4111111111111111' } }),
        },
        {
          id: 'payment-2',
          metadata: {},
          toJSON: () => ({ id: 'payment-2', metadata: {} }),
        },
      ];

      (Payment.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockPayments,
        count: 2,
      });

      // Act
      const result = await paymentService.getPaymentsByUser('user-123');

      // Assert
      expect(Payment.findAndCountAll).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.payments).toHaveLength(2);
      expect(result.payments[0].metadata.cardNumber).toBe('****1111');
    });
  });

  describe('refundPayment', () => {
    it('should successfully refund a completed payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        userId: 'user-123',
        amount: 199.99,
        status: 'completed',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', status: 'refunded' }),
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      const result = await paymentService.refundPayment('payment-123', 'Customer request');

      // Assert
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'refunded',
        failureReason: 'Customer request',
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.refunded',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
          orderId: 'order-123',
          amount: 199.99,
          reason: 'Customer request',
        }),
      });
    });

    it('should throw NotFoundError if payment does not exist', async () => {
      // Arrange
      (Payment.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(paymentService.refundPayment('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if payment is not completed', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        status: 'processing',
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act & Assert
      await expect(paymentService.refundPayment('payment-123')).rejects.toThrow(ValidationError);
      await expect(paymentService.refundPayment('payment-123')).rejects.toThrow('Only completed payments can be refunded');
    });

    it('should throw ValidationError if payment is already refunded', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        status: 'refunded',
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act & Assert
      await expect(paymentService.refundPayment('payment-123')).rejects.toThrow(ValidationError);
      await expect(paymentService.refundPayment('payment-123')).rejects.toThrow('Payment has already been refunded');
    });
  });

  describe('getAllPayments', () => {
    it('should return all payments with filters', async () => {
      // Arrange
      const mockPayments = [
        { id: 'payment-1', toJSON: () => ({ id: 'payment-1', metadata: {} }) },
        { id: 'payment-2', toJSON: () => ({ id: 'payment-2', metadata: {} }) },
      ];

      (Payment.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: mockPayments,
        count: 2,
      });

      // Act
      const result = await paymentService.getAllPayments({
        status: 'completed',
        limit: 10,
        offset: 0,
      });

      // Assert
      expect(Payment.findAndCountAll).toHaveBeenCalledWith({
        where: { status: 'completed' },
        limit: 10,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
      expect(result.payments).toHaveLength(2);
    });

    it('should filter by payment method', async () => {
      // Arrange
      (Payment.findAndCountAll as jest.Mock).mockResolvedValue({
        rows: [],
        count: 0,
      });

      // Act
      await paymentService.getAllPayments({ paymentMethod: 'credit_card' });

      // Assert
      expect(Payment.findAndCountAll).toHaveBeenCalledWith({
        where: { paymentMethod: 'credit_card' },
        limit: 100,
        offset: 0,
        order: [['createdAt', 'DESC']],
      });
    });
  });

  describe('retryPayment', () => {
    it('should successfully retry a failed payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        userId: 'user-123',
        amount: 199.99,
        currency: 'USD',
        paymentMethod: 'credit_card',
        status: 'failed',
        metadata: {},
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', status: 'completed' }),
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act
      const result = await paymentService.retryPayment('payment-123');

      // Assert
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'processing',
        failureReason: null,
      });
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'completed',
        transactionId: expect.any(String),
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.completed',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
        }),
      });
    });

    it('should throw NotFoundError if payment does not exist', async () => {
      // Arrange
      (Payment.findByPk as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(paymentService.retryPayment('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if payment is not failed', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        status: 'completed',
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Act & Assert
      await expect(paymentService.retryPayment('payment-123')).rejects.toThrow(ValidationError);
      await expect(paymentService.retryPayment('payment-123')).rejects.toThrow('Only failed payments can be retried');
    });

    it('should update payment to failed if retry fails', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-123',
        status: 'failed',
        amount: 199.99,
        currency: 'USD',
        paymentMethod: 'credit_card',
        metadata: {},
        orderId: 'order-123',
        userId: 'user-123',
        update: jest.fn().mockResolvedValue(undefined),
        toJSON: () => ({ id: 'payment-123', status: 'failed' }),
      };

      (Payment.findByPk as jest.Mock).mockResolvedValue(mockPayment);

      // Simulate failure
      jest.spyOn(Math, 'random').mockReturnValue(0.96);

      // Act
      const result = await paymentService.retryPayment('payment-123');

      // Assert
      expect(mockPayment.update).toHaveBeenCalledWith({
        status: 'failed',
        failureReason: expect.any(String),
      });
      expect(mockEventPublisher.publishEvent).toHaveBeenCalledWith({
        type: 'payment.failed',
        payload: expect.objectContaining({
          paymentId: 'payment-123',
        }),
      });
    });
  });
});
