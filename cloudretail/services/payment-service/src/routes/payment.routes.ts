import { Router } from 'express';
import {
  createPayment,
  getPaymentById,
  getPaymentByOrderId,
  getUserPayments,
  refundPayment,
  retryPayment,
  getAllPayments,
} from '../controllers/payment.controller';
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
router.post('/', authenticate, strictRateLimiter, createPayment);
router.get('/', authenticate, standardRateLimiter, getUserPayments);
router.get('/:id', authenticate, standardRateLimiter, getPaymentById);
router.get(
  '/order/:orderId',
  authenticate,
  standardRateLimiter,
  getPaymentByOrderId
);

/**
 * Admin routes
 */
router.get(
  '/admin',
  authenticate,
  authorize('admin'),
  standardRateLimiter,
  getAllPayments
);

router.post(
  '/:id/refund',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  refundPayment
);

router.post(
  '/:id/retry',
  authenticate,
  authorize('admin'),
  strictRateLimiter,
  retryPayment
);

export default router;
