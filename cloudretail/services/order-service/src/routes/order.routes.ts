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
router.post('/', authenticate, strictRateLimiter, createOrder);
router.get('/', authenticate, standardRateLimiter, getUserOrders);
router.get('/:id', authenticate, standardRateLimiter, getOrderById);

/**
 * Admin routes
 */
router.get(
  '/admin',
  authenticate,
  authorize('admin'),
  standardRateLimiter,
  getAllOrders
);

router.put(
  '/:id/status',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  updateOrderStatus
);

router.put(
  '/:id/payment',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  updatePaymentId
);

export default router;
