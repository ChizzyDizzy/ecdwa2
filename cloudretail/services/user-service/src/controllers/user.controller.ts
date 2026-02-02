import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler, AuthenticatedRequest } from '@cloudretail/middleware';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';

const userService = new UserService();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid('customer', 'admin', 'vendor').optional(),
  gdprConsent: Joi.boolean().valid(true).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  twoFactorCode: Joi.string().optional(),
});

const updateUserSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  email: Joi.string().email().optional(),
}).min(1);

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = registerSchema.validate(req.body);

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

  const user = await userService.register(value);

  res.status(201).json({
    success: true,
    data: user,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = loginSchema.validate(req.body);

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

  const result = await userService.login(
    value.email,
    value.password,
    value.twoFactorCode
  );

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const user = await userService.getUserById(userId);

  res.json({
    success: true,
    data: user,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Get user by ID (admin only)
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await userService.getUserById(id);

  res.json({
    success: true,
    data: user,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Update user profile
 */
export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { error, value } = updateUserSchema.validate(req.body);

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

  const user = await userService.updateUser(userId, value);

  res.json({
    success: true,
    data: user,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Enable two-factor authentication
 */
export const enableTwoFactor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await userService.enableTwoFactor(userId);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Verify two-factor authentication code
 */
export const verifyTwoFactor = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { token } = req.body;

  if (!token) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Token is required',
      },
    });
    return;
  }

  const result = await userService.verifyTwoFactor(userId, token);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Delete user account (GDPR - right to be forgotten)
 */
export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await userService.deleteUser(userId);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * Get all users (admin only)
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const filters = {
    role: req.query.role as string | undefined,
    isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
  };

  const result = await userService.getAllUsers(filters);

  res.json({
    success: true,
    data: result,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});
