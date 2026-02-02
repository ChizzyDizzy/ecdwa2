import express from 'express';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  helmetMiddleware,
  corsMiddleware,
  standardRateLimiter,
  strictRateLimiter,
  authenticate,
  authorize,
  logger,
  HealthCheck,
} from '@cloudretail/middleware';
import { ServiceRegistry } from './services/service-registry';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const serviceRegistry = new ServiceRegistry();
const healthCheck = new HealthCheck();

// Security middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
healthCheck.registerCheck('services', async () => {
  const services = serviceRegistry.getAllServices();
  return services.every((s) => s.healthy);
});

app.get('/health', async (req, res) => {
  const status = await healthCheck.getStatus();
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
});

// API Gateway Info
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'CloudRetail API Gateway',
      version: '1.0.0',
      services: serviceRegistry.getAllServices().map((s) => ({
        name: s.name,
        url: s.url,
        healthy: s.healthy,
      })),
    },
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
});

/**
 * User Service Routes
 */
app.use(
  '/api/users',
  standardRateLimiter,
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('user-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/users': '/api/users',
    },
    onError: (err, req, res) => {
      logger.error('Proxy error - User Service', { error: err.message });
      (res as any).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'User service is currently unavailable',
        },
      });
    },
  })
);

/**
 * Product Service Routes
 */
app.use(
  '/api/products',
  standardRateLimiter,
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('product-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/products': '/api/products',
    },
    onError: (err, req, res) => {
      logger.error('Proxy error - Product Service', { error: err.message });
      (res as any).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Product service is currently unavailable',
        },
      });
    },
  })
);

/**
 * Order Service Routes
 */
app.use(
  '/api/orders',
  standardRateLimiter,
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('order-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/orders': '/api/orders',
    },
    onError: (err, req, res) => {
      logger.error('Proxy error - Order Service', { error: err.message });
      (res as any).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Order service is currently unavailable',
        },
      });
    },
  })
);

/**
 * Inventory Service Routes
 */
app.use(
  '/api/inventory',
  standardRateLimiter,
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('inventory-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/inventory': '/api/inventory',
    },
    onError: (err, req, res) => {
      logger.error('Proxy error - Inventory Service', { error: err.message });
      (res as any).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Inventory service is currently unavailable',
        },
      });
    },
  })
);

/**
 * Payment Service Routes
 */
app.use(
  '/api/payments',
  standardRateLimiter,
  createProxyMiddleware({
    target: serviceRegistry.getServiceUrl('payment-service'),
    changeOrigin: true,
    pathRewrite: {
      '^/api/payments': '/api/payments',
    },
    onError: (err, req, res) => {
      logger.error('Proxy error - Payment Service', { error: err.message });
      (res as any).status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service is currently unavailable',
        },
      });
    },
  })
);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Start health checks for all services
    serviceRegistry.startHealthChecks();

    app.listen(PORT, () => {
      logger.info(`API Gateway started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Registered services:', {
        services: serviceRegistry.getAllServices().map((s) => s.name),
      });
    });
  } catch (error) {
    logger.error('Failed to start API Gateway', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  serviceRegistry.stopHealthChecks();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  serviceRegistry.stopHealthChecks();
  process.exit(0);
});

startServer();

export default app;
