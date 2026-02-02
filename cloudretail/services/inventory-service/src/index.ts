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
import inventoryRoutes from './routes/inventory.routes';
import { logger } from '@cloudretail/middleware';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;
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
    const { Inventory } = await import('./config/database');
    await Inventory.findOne();
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
app.use('/api/inventory', inventoryRoutes);

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
      logger.info(`Inventory Service started on port ${PORT}`);
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
