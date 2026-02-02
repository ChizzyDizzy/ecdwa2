import { Router } from 'express';
import {
  createInventory,
  getInventoryByProductId,
  getInventoryById,
  updateInventoryQuantity,
  verifyInventory,
  reserveInventory,
  releaseInventory,
  confirmInventoryUsage,
  getAllInventory,
} from '../controllers/inventory.controller';
import {
  authenticate,
  authorize,
  strictRateLimiter,
  standardRateLimiter,
} from '@cloudretail/middleware';

const router = Router();

/**
 * Public routes (for service-to-service communication)
 */
router.post('/verify', standardRateLimiter, verifyInventory);
router.post('/reserve', standardRateLimiter, reserveInventory);
router.post('/release', standardRateLimiter, releaseInventory);
router.post('/confirm', standardRateLimiter, confirmInventoryUsage);

/**
 * Public read routes
 */
router.get('/product/:productId', standardRateLimiter, getInventoryByProductId);
router.get('/inventory/:id', standardRateLimiter, getInventoryById);

/**
 * Protected routes - require authentication and authorization
 */
router.post(
  '/inventory',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  createInventory
);

router.put(
  '/product/:productId',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  updateInventoryQuantity
);

router.get(
  '/inventory',
  authenticate,
  authorize('admin', 'vendor'),
  standardRateLimiter,
  getAllInventory
);

export default router;
