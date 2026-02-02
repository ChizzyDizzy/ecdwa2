import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  getUserById,
  updateUser,
  enableTwoFactor,
  verifyTwoFactor,
  deleteUser,
  getAllUsers,
} from '../controllers/user.controller';
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
router.post('/register', strictRateLimiter, register);
router.post('/login', strictRateLimiter, login);

/**
 * Protected routes - require authentication
 */
router.get('/profile', authenticate, standardRateLimiter, getProfile);
router.put('/profile', authenticate, standardRateLimiter, updateUser);
router.delete('/profile', authenticate, standardRateLimiter, deleteUser);

/**
 * Two-factor authentication routes
 */
router.post('/2fa/enable', authenticate, standardRateLimiter, enableTwoFactor);
router.post('/2fa/verify', authenticate, standardRateLimiter, verifyTwoFactor);

/**
 * Admin routes
 */
router.get(
  '/users',
  authenticate,
  authorize('admin'),
  standardRateLimiter,
  getAllUsers
);

router.get(
  '/users/:id',
  authenticate,
  authorize('admin'),
  standardRateLimiter,
  getUserById
);

export default router;
