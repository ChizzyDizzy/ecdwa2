import { Payment } from '../config/database';
import {
  NotFoundError,
  ValidationError,
  logger,
} from '@cloudretail/middleware';
import { EventPublisher } from '../events/event-publisher';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  private eventPublisher: EventPublisher;
  private orderServiceUrl: string;

  constructor() {
    this.eventPublisher = new EventPublisher();
    this.orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';
  }

  /**
   * Simulate payment processing with external payment gateway
   * In production, this would integrate with Stripe, PayPal, etc.
   */
  private async processPaymentWithGateway(
    amount: number,
    currency: string,
    paymentMethod: string,
    metadata?: any
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Simulate payment processing delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (success) {
        return {
          success: true,
          transactionId: `txn_${uuidv4()}`,
        };
      } else {
        return {
          success: false,
          error: 'Payment declined by payment gateway',
        };
      }
    } catch (error) {
      logger.error('Error processing payment with gateway', { error });
      return {
        success: false,
        error: 'Payment gateway communication error',
      };
    }
  }

  /**
   * Create and process a payment
   */
  async createPayment(paymentData: {
    orderId: string;
    userId: string;
    amount: number;
    currency?: string;
    paymentMethod: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
    metadata?: any;
  }) {
    try {
      // Validate amount
      if (paymentData.amount <= 0) {
        throw new ValidationError('Payment amount must be greater than zero');
      }

      // Check if payment already exists for this order
      const existingPayment = await Payment.findOne({
        where: { orderId: paymentData.orderId },
      });

      if (existingPayment && existingPayment.status === 'completed') {
        throw new ValidationError('Payment already completed for this order');
      }

      // Create payment record
      const payment = await Payment.create({
        ...paymentData,
        currency: paymentData.currency || 'USD',
        status: 'processing',
        pciCompliant: true,
      });

      // Publish payment initiated event
      await this.eventPublisher.publishEvent({
        type: 'payment.initiated',
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
        },
      });

      logger.info('Payment initiated', { paymentId: payment.id });

      // Process payment with gateway
      const gatewayResponse = await this.processPaymentWithGateway(
        payment.amount,
        payment.currency,
        payment.paymentMethod,
        payment.metadata
      );

      if (gatewayResponse.success) {
        // Update payment status to completed
        await payment.update({
          status: 'completed',
          transactionId: gatewayResponse.transactionId,
        });

        // Publish payment completed event
        await this.eventPublisher.publishEvent({
          type: 'payment.completed',
          payload: {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            amount: payment.amount,
            transactionId: payment.transactionId,
          },
        });

        // Update order payment ID
        await this.updateOrderPaymentId(payment.orderId, payment.id);

        logger.info('Payment completed successfully', { paymentId: payment.id });
      } else {
        // Update payment status to failed
        await payment.update({
          status: 'failed',
          failureReason: gatewayResponse.error,
        });

        // Publish payment failed event
        await this.eventPublisher.publishEvent({
          type: 'payment.failed',
          payload: {
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            amount: payment.amount,
            reason: gatewayResponse.error,
          },
        });

        logger.warn('Payment failed', {
          paymentId: payment.id,
          reason: gatewayResponse.error,
        });
      }

      return payment.toJSON();
    } catch (error) {
      logger.error('Error creating payment', { error });
      throw error;
    }
  }

  /**
   * Update order payment ID
   */
  private async updateOrderPaymentId(orderId: string, paymentId: string): Promise<void> {
    try {
      await fetch(`${this.orderServiceUrl}/api/orders/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentId }),
      });
    } catch (error) {
      logger.error('Error updating order payment ID', { error });
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string) {
    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    // Redact sensitive information in response
    const paymentData = payment.toJSON();
    if (paymentData.metadata?.cardNumber) {
      paymentData.metadata = {
        ...paymentData.metadata,
        cardNumber: `****${paymentData.metadata.cardNumber.slice(-4)}`,
      };
    }

    return paymentData;
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string) {
    const payment = await Payment.findOne({ where: { orderId } });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    // Redact sensitive information in response
    const paymentData = payment.toJSON();
    if (paymentData.metadata?.cardNumber) {
      paymentData.metadata = {
        ...paymentData.metadata,
        cardNumber: `****${paymentData.metadata.cardNumber.slice(-4)}`,
      };
    }

    return paymentData;
  }

  /**
   * Get payments by user
   */
  async getPaymentsByUser(userId: string, limit: number = 100, offset: number = 0) {
    const payments = await Payment.findAndCountAll({
      where: { userId },
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      payments: payments.rows.map((p) => {
        const paymentData = p.toJSON();
        if (paymentData.metadata?.cardNumber) {
          paymentData.metadata = {
            ...paymentData.metadata,
            cardNumber: `****${paymentData.metadata.cardNumber.slice(-4)}`,
          };
        }
        return paymentData;
      }),
      total: payments.count,
      limit,
      offset,
    };
  }

  /**
   * Process refund
   */
  async refundPayment(paymentId: string, reason?: string) {
    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.status !== 'completed') {
      throw new ValidationError('Only completed payments can be refunded');
    }

    if (payment.status === 'refunded') {
      throw new ValidationError('Payment has already been refunded');
    }

    // Process refund with gateway
    // In production, this would call the payment gateway's refund API
    logger.info('Processing refund', { paymentId });

    // Update payment status
    await payment.update({
      status: 'refunded',
      failureReason: reason,
    });

    // Publish payment refunded event
    await this.eventPublisher.publishEvent({
      type: 'payment.refunded',
      payload: {
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount,
        reason,
      },
    });

    logger.info('Payment refunded successfully', { paymentId });

    return payment.toJSON();
  }

  /**
   * Get all payments (admin only)
   */
  async getAllPayments(filters?: {
    status?: string;
    userId?: string;
    paymentMethod?: string;
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

    if (filters?.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    const payments = await Payment.findAndCountAll({
      where,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
      order: [['createdAt', 'DESC']],
    });

    return {
      payments: payments.rows.map((p) => {
        const paymentData = p.toJSON();
        if (paymentData.metadata?.cardNumber) {
          paymentData.metadata = {
            ...paymentData.metadata,
            cardNumber: `****${paymentData.metadata.cardNumber.slice(-4)}`,
          };
        }
        return paymentData;
      }),
      total: payments.count,
      limit: filters?.limit || 100,
      offset: filters?.offset || 0,
    };
  }

  /**
   * Retry failed payment
   */
  async retryPayment(paymentId: string) {
    const payment = await Payment.findByPk(paymentId);

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.status !== 'failed') {
      throw new ValidationError('Only failed payments can be retried');
    }

    // Update status to processing
    await payment.update({
      status: 'processing',
      failureReason: null,
    });

    // Process payment with gateway
    const gatewayResponse = await this.processPaymentWithGateway(
      payment.amount,
      payment.currency,
      payment.paymentMethod,
      payment.metadata
    );

    if (gatewayResponse.success) {
      await payment.update({
        status: 'completed',
        transactionId: gatewayResponse.transactionId,
      });

      await this.eventPublisher.publishEvent({
        type: 'payment.completed',
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          amount: payment.amount,
          transactionId: payment.transactionId,
        },
      });

      logger.info('Payment retry successful', { paymentId: payment.id });
    } else {
      await payment.update({
        status: 'failed',
        failureReason: gatewayResponse.error,
      });

      await this.eventPublisher.publishEvent({
        type: 'payment.failed',
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          userId: payment.userId,
          amount: payment.amount,
          reason: gatewayResponse.error,
        },
      });

      logger.warn('Payment retry failed', {
        paymentId: payment.id,
        reason: gatewayResponse.error,
      });
    }

    return payment.toJSON();
  }
}
