import express from 'express';
import dotenv from 'dotenv';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  helmetMiddleware,
  corsMiddleware,
  gdprCompliance,
  HealthCheck,
} from '@cloudretail/middleware';
import { connectDatabase } from './config/database';
import orderRoutes from './routes/order.routes';
import { logger } from '@cloudretail/middleware';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const healthCheck = new HealthCheck();

// Security middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// GDPR compliance
app.use(gdprCompliance);

// Health check endpoint
healthCheck.registerCheck('database', async () => {
  try {
    const { Order } = await import('./config/database');
    await Order.findOne();
    return true;
  } catch {
    return false;
  }
});

app.get('/health', async (req, res) => {
  const status = await healthCheck.getStatus();
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
});

// API routes
app.use('/api/orders', orderRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    app.listen(PORT, () => {
      logger.info(`Order Service started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const { disconnectDatabase } = await import('./config/database');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  const { disconnectDatabase } = await import('./config/database');
  await disconnectDatabase();
  process.exit(0);
});

startServer();

export default app;
