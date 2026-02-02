import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { asyncHandler, AuthenticatedRequest } from '@cloudretail/middleware';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const paymentService = new PaymentService();

// Validation schemas
const createPaymentSchema = Joi.object({
  orderId: Joi.string().uuid().required(),
  amount: Joi.number().min(0.01).required(),
  currency: Joi.string().length(3).optional(),
  paymentMethod: Joi.string()
    .valid('credit_card', 'debit_card', 'paypal', 'bank_transfer')
    .required(),
  metadata: Joi.object().optional(),
});

const refundPaymentSchema = Joi.object({
  reason: Joi.string().optional(),
});

/**
 * Create and process a payment
 */
export const createPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { error, value } = createPaymentSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const payment = await paymentService.createPayment({
      userId,
      ...value,
    });

    res.status(201).json({
      success: true,
      data: payment,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get payment by ID
 */
export const getPaymentById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const payment = await paymentService.getPaymentById(id);

    // Check if user is authorized to view this payment
    if (payment.userId !== userId && userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this payment',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: payment,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get payment by order ID
 */
export const getPaymentByOrderId = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const payment = await paymentService.getPaymentByOrderId(orderId);

    // Check if user is authorized to view this payment
    if (payment.userId !== userId && userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this payment',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: payment,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get user's payments
 */
export const getUserPayments = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await paymentService.getPaymentsByUser(userId, limit, offset);

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Refund a payment
 */
export const refundPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { error, value } = refundPaymentSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
        },
      });
      return;
    }

    const payment = await paymentService.refundPayment(id, value.reason);

    res.json({
      success: true,
      data: payment,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Retry a failed payment
 */
export const retryPayment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const payment = await paymentService.retryPayment(id);

    res.json({
      success: true,
      data: payment,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get all payments (admin only)
 */
export const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    status: req.query.status as string | undefined,
    userId: req.query.userId as string | undefined,
    paymentMethod: req.query.paymentMethod as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = await paymentService.getAllPayments(filters);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});
