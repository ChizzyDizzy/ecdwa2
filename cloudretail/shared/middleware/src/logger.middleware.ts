import winston from 'winston';
import { Request, Response, NextFunction } from 'express';

/**
 * Winston Logger Configuration
 * Provides structured logging with multiple transports
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'cloudretail-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

/**
 * Request Logging Middleware
 * Logs all incoming requests with correlation ID
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();

  req.headers['x-correlation-id'] = correlationId as string;
  res.setHeader('x-correlation-id', correlationId as string);

  const startTime = Date.now();

  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      correlationId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};

/**
 * Generate Correlation ID for distributed tracing
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log specific events
 */
export const logEvent = (eventType: string, data: any): void => {
  logger.info(`Event: ${eventType}`, data);
};

/**
 * Log errors
 */
export const logError = (error: Error, context?: any): void => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};
