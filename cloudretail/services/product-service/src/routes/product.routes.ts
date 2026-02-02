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
router.get('/products', standardRateLimiter, getAllProducts);
router.get('/products/:id', standardRateLimiter, getProductById);
router.get('/sku/:sku', standardRateLimiter, getProductBySku);
router.get('/vendor/:vendorId', standardRateLimiter, getProductsByVendor);
router.get('/category/:category', standardRateLimiter, getProductsByCategory);

/**
 * Protected routes - require authentication and authorization
 */
router.post(
  '/products',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  createProduct
);

router.put(
  '/products/:id',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  updateProduct
);

router.delete(
  '/products/:id',
  authenticate,
  authorize('admin', 'vendor'),
  strictRateLimiter,
  deleteProduct
);

export default router;
