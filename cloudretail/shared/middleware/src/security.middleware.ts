import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from './logger.middleware';

/**
 * Rate Limiting Configuration
 * Prevents abuse and DDoS attacks
 */
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  max: number = 100 // limit each IP to 100 requests per windowMs
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      });
    },
  });
};

/**
 * Strict Rate Limiter for sensitive endpoints (e.g., login, payment)
 */
export const strictRateLimiter = createRateLimiter(15 * 60 * 1000, 5);

/**
 * Standard Rate Limiter for API endpoints
 */
export const standardRateLimiter = createRateLimiter(15 * 60 * 1000, 100);

/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing
 */
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://3.1.27.41:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);

/**
 * Helmet Security Headers
 * Sets various HTTP headers for security
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * IP Whitelisting Middleware
 * Restricts access to specific IP addresses
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.socket.remoteAddress;

    if (allowedIPs.includes(clientIP as string)) {
      next();
    } else {
      logger.warn('IP not whitelisted', { ip: clientIP, path: req.path });

      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access forbidden from this IP address',
        },
      });
    }
  };
};

/**
 * API Key Validation Middleware
 * Validates API keys for external integrations
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_REQUIRED',
        message: 'API key is required',
      },
    });
    return;
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    });
    return;
  }

  next();
};

/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent injection attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }

  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove potential XSS
    .replace(/['";]/g, '') // Remove potential SQL injection
    .trim();
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    Object.keys(obj).forEach((key) => {
      sanitized[key] = sanitizeObject(obj[key]);
    });
    return sanitized;
  }

  return obj;
}

/**
 * GDPR Compliance Middleware
 * Tracks consent and data processing
 */
export const gdprCompliance = (req: Request, res: Response, next: NextFunction): void => {
  const gdprConsent = req.headers['x-gdpr-consent'];

  if (req.path.includes('/user') && req.method !== 'GET') {
    if (!gdprConsent) {
      logger.warn('GDPR consent missing', {
        path: req.path,
        method: req.method,
      });
    }
  }

  // Add GDPR headers to response
  res.setHeader('X-Data-Processing-Region', process.env.REGION || 'EU');
  res.setHeader('X-Privacy-Policy', process.env.PRIVACY_POLICY_URL || 'https://cloudretail.com/privacy');

  next();
};
