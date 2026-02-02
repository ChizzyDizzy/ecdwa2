import { Router } from 'express';
import {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  updatePaymentId,
  getAllOrders,
} from '../controllers/order.controller';
import {
  authenticate,
  authorize,
  strictRateLimiter,
  standardRateLimiter,
} from '@cloudretail/middleware';

const router = Router();

/**
 * Protected routes - require authentication
 */
router.post('/orders', authenticate, strictRateLimiter, createOrder);
router.get('/orders', authenticate, standardRateLimiter, getUserOrders);
router.get('/orders/:id', authenticate, standardRateLimiter, getOrderById);

/**
 * Admin routes
 */
router.get(
  '/admin/orders',
  authenticate,
  authorize('admin'),
  standardRateLimiter,
  getAllOrders
);

router.put(
  '/orders/:id/status',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  updateOrderStatus
);

router.put(
  '/orders/:id/payment',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  updatePaymentId
);

export default router;
