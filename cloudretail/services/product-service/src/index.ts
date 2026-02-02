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
  logger,
} from '@cloudretail/middleware';
import productRoutes from './routes/product.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const healthCheck = new HealthCheck();

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(gdprCompliance);

healthCheck.registerCheck('database', async () => {
  try {
    const { sequelize } = await import('./config/database');
    await sequelize.authenticate();
    return true;
  } catch {
    return false;
  }
});

app.get('/health', async (req, res) => {
  const status = await healthCheck.getStatus();
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
});

app.use('/api/products', productRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    const { connectDatabase } = await import('./config/database');
    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(`Product Service started on port ${PORT}`);
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
