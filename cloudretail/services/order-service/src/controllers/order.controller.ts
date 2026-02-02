import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { asyncHandler, AuthenticatedRequest } from '@cloudretail/middleware';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const orderService = new OrderService();

// Validation schemas
const orderItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  productName: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  price: Joi.number().min(0).required(),
});

const shippingAddressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().required(),
});

const createOrderSchema = Joi.object({
  items: Joi.array().items(orderItemSchema).min(1).required(),
  shippingAddress: shippingAddressSchema.required(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
    .required(),
});

const updatePaymentSchema = Joi.object({
  paymentId: Joi.string().uuid().required(),
});

/**
 * Create a new order
 */
export const createOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { error, value } = createOrderSchema.validate(req.body);

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

    const order = await orderService.createOrder({
      userId,
      ...value,
    });

    res.status(201).json({
      success: true,
      data: order,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get order by ID
 */
export const getOrderById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const order = await orderService.getOrderById(id);

    // Check if user is authorized to view this order
    if (order.userId !== userId && userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view this order',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: order,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get user's orders
 */
export const getUserOrders = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await orderService.getOrdersByUser(userId, limit, offset);

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
 * Update order status
 */
export const updateOrderStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { error, value } = updateStatusSchema.validate(req.body);

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

    const order = await orderService.updateOrderStatus(id, value.status);

    res.json({
      success: true,
      data: order,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Update payment ID for order
 */
export const updatePaymentId = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { error, value } = updatePaymentSchema.validate(req.body);

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

    const order = await orderService.updatePaymentId(id, value.paymentId);

    res.json({
      success: true,
      data: order,
      metadata: {
        timestamp: new Date(),
        requestId: uuidv4(),
      },
    });
  }
);

/**
 * Get all orders (admin only)
 */
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    status: req.query.status as string | undefined,
    userId: req.query.userId as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = await orderService.getAllOrders(filters);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});
