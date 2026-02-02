import { Request, Response, NextFunction } from 'express';
import { logError } from './logger.middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom Error Classes
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(400, 'VALIDATION_ERROR', message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(401, 'UNAUTHORIZED', message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(403, 'FORBIDDEN', message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(503, 'SERVICE_UNAVAILABLE', message, false);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Global Error Handler Middleware
 * Handles all errors and sends appropriate responses
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = uuidv4();

  logError(err, {
    requestId,
    url: req.url,
    method: req.method,
    correlationId: req.headers['x-correlation-id'],
  });

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: (err as any).details,
      },
      metadata: {
        timestamp: new Date(),
        requestId,
      },
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
    metadata: {
      timestamp: new Date(),
      requestId,
    },
  });
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.url} not found`,
    },
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
};
