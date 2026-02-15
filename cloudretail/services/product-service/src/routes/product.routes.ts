import { Router } from 'express';
import {
  createProduct,
  getProductById,
  getProductBySku,
  updateProduct,
  deleteProduct,
  searchProducts,
  getAllProducts,
  getProductsByVendor,
  getProductsByCategory,
} from '../controllers/product.controller';
import {
  authenticate,
  authorize,
  strictRateLimiter,
  standardRateLimiter,
} from '@cloudretail/middleware';

const router = Router();

/**
 * Public routes
 */
router.get('/search', standardRateLimiter, searchProducts);
router.get('/', standardRateLimiter, getAllProducts);
router.get('/:id', standardRateLimiter, getProductById);
router.get('/sku/:sku', standardRateLimiter, getProductBySku);
router.get('/vendor/:vendorId', standardRateLimiter, getProductsByVendor);
router.get('/category/:category', standardRateLimiter, getProductsByCategory);

/**
 * Protected routes - require authentication and authorization
 */
router.post(
  '/',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  createProduct
);

router.put(
  '/:id',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  updateProduct
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  deleteProduct
);

export default router;
