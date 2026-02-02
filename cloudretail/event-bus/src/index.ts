import express from 'express';
import dotenv from 'dotenv';
import { EventBus } from './services/event-bus.service';
import {
  requestLogger,
  errorHandler,
  notFoundHandler,
  helmetMiddleware,
  corsMiddleware,
  logger,
  asyncHandler,
  HealthCheck,
} from '@cloudretail/middleware';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const eventBus = new EventBus();
const healthCheck = new HealthCheck();

// Middleware
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json());
app.use(requestLogger);

// Health check
healthCheck.registerCheck('kafka', async () => {
  return eventBus.isConnected();
});

app.get('/health', async (req, res) => {
  const status = await healthCheck.getStatus();
  res.status(status.status === 'healthy' ? 200 : 503).json(status);
});

/**
 * Publish Event Endpoint
 * POST /events
 */
app.post('/events', asyncHandler(async (req, res) => {
  const { type, payload, metadata } = req.body;

  if (!type || !payload) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Event type and payload are required',
      },
    });
    return;
  }

  const event = {
    id: uuidv4(),
    type,
    payload,
    timestamp: new Date(),
    metadata: metadata || {
      correlationId: uuidv4(),
      service: 'unknown',
    },
  };

  await eventBus.publishEvent(event);

  logger.info('Event published', { eventId: event.id, eventType: type });

  res.status(202).json({
    success: true,
    data: {
      eventId: event.id,
      message: 'Event accepted for processing',
    },
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
}));

/**
 * Subscribe to Events (WebSocket or SSE in production)
 * GET /events/subscribe/:service
 */
app.get('/events/subscribe/:service', asyncHandler(async (req, res) => {
  const { service } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  logger.info('Service subscribed to events', { service });

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    logger.info('Service unsubscribed from events', { service });
  });
}));

/**
 * Get Event Statistics
 * GET /events/stats
 */
app.get('/events/stats', asyncHandler(async (req, res) => {
  const stats = await eventBus.getStats();

  res.json({
    success: true,
    data: stats,
    metadata: {
      timestamp: new Date(),
      requestId: uuidv4(),
    },
  });
}));

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    await eventBus.connect();

    app.listen(PORT, () => {
      logger.info(`Event Bus started on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Event Bus', { error });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await eventBus.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await eventBus.disconnect();
  process.exit(0);
});

startServer();

export default app;
