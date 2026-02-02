/**
 * Integration Test Setup and Teardown
 * Manages test environment initialization and cleanup
 */

import { execSync } from 'child_process';
import * as path from 'path';

// Test environment configuration
export const TEST_CONFIG = {
  apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
  inventoryServiceUrl: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
  eventBusUrl: process.env.EVENT_BUS_URL || 'http://localhost:3010',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'cloudretail_test',
    user: process.env.DB_USER || 'test',
    password: process.env.DB_PASSWORD || 'test',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '1'),
  },

  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672'),
    user: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASSWORD || 'guest',
  },
};

// Service health check
export async function waitForServices(timeoutMs: number = 60000): Promise<void> {
  const startTime = Date.now();
  const services = [
    { name: 'API Gateway', url: TEST_CONFIG.apiGatewayUrl },
    { name: 'User Service', url: TEST_CONFIG.userServiceUrl },
    { name: 'Product Service', url: TEST_CONFIG.productServiceUrl },
    { name: 'Order Service', url: TEST_CONFIG.orderServiceUrl },
    { name: 'Inventory Service', url: TEST_CONFIG.inventoryServiceUrl },
    { name: 'Payment Service', url: TEST_CONFIG.paymentServiceUrl },
  ];

  const checkService = async (service: { name: string; url: string }): Promise<boolean> => {
    try {
      const response = await fetch(`${service.url}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  while (Date.now() - startTime < timeoutMs) {
    const results = await Promise.all(services.map(checkService));
    if (results.every(r => r)) {
      console.log('All services are healthy');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Services did not become healthy within timeout period');
}

// Database setup
export async function setupDatabase(): Promise<void> {
  console.log('Setting up test database...');

  try {
    // Run database migrations
    const migrationsPath = path.join(__dirname, '../../infrastructure/migrations');

    // This assumes you have migration scripts
    // Adjust based on your actual migration setup
    execSync(`npm run migrate:test`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });

    console.log('Test database setup complete');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

// Database cleanup
export async function cleanupDatabase(): Promise<void> {
  console.log('Cleaning up test database...');

  try {
    // Clean up test data
    // This could be replaced with a more sophisticated cleanup
    execSync(`npm run migrate:rollback:test`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });

    console.log('Test database cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

// Redis cleanup
export async function cleanupRedis(): Promise<void> {
  console.log('Cleaning up Redis...');

  try {
    const { createClient } = await import('redis');
    const client = createClient({
      socket: {
        host: TEST_CONFIG.redis.host,
        port: TEST_CONFIG.redis.port,
      },
      database: TEST_CONFIG.redis.db,
    });

    await client.connect();
    await client.flushDb();
    await client.quit();

    console.log('Redis cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup Redis:', error);
  }
}

// RabbitMQ cleanup
export async function cleanupRabbitMQ(): Promise<void> {
  console.log('Cleaning up RabbitMQ...');

  try {
    const amqp = await import('amqplib');
    const connection = await amqp.connect({
      hostname: TEST_CONFIG.rabbitmq.host,
      port: TEST_CONFIG.rabbitmq.port,
      username: TEST_CONFIG.rabbitmq.user,
      password: TEST_CONFIG.rabbitmq.password,
    });

    const channel = await connection.createChannel();

    // Delete test queues
    const testQueues = [
      'test.user.events',
      'test.order.events',
      'test.product.events',
      'test.inventory.events',
      'test.payment.events',
    ];

    for (const queue of testQueues) {
      try {
        await channel.deleteQueue(queue);
      } catch (error) {
        // Queue might not exist
      }
    }

    await channel.close();
    await connection.close();

    console.log('RabbitMQ cleanup complete');
  } catch (error) {
    console.error('Failed to cleanup RabbitMQ:', error);
  }
}

// Docker services management
export function startDockerServices(): void {
  console.log('Starting Docker services...');

  try {
    execSync('docker-compose -f docker-compose.test.yml up -d', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });

    console.log('Docker services started');
  } catch (error) {
    console.error('Failed to start Docker services:', error);
    throw error;
  }
}

export function stopDockerServices(): void {
  console.log('Stopping Docker services...');

  try {
    execSync('docker-compose -f docker-compose.test.yml down', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
    });

    console.log('Docker services stopped');
  } catch (error) {
    console.error('Failed to stop Docker services:', error);
  }
}

// Global setup (runs once before all tests)
export async function globalSetup(): Promise<void> {
  console.log('Running global test setup...');

  try {
    // Start Docker services if not already running
    if (process.env.SKIP_DOCKER !== 'true') {
      startDockerServices();

      // Wait for services to be healthy
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Setup database
    if (process.env.SKIP_DB_SETUP !== 'true') {
      await setupDatabase();
    }

    // Wait for all services to be ready
    if (process.env.SKIP_SERVICE_WAIT !== 'true') {
      await waitForServices();
    }

    console.log('Global test setup complete');
  } catch (error) {
    console.error('Global test setup failed:', error);
    throw error;
  }
}

// Global teardown (runs once after all tests)
export async function globalTeardown(): Promise<void> {
  console.log('Running global test teardown...');

  try {
    // Cleanup Redis
    await cleanupRedis();

    // Cleanup RabbitMQ
    await cleanupRabbitMQ();

    // Cleanup database
    if (process.env.SKIP_DB_CLEANUP !== 'true') {
      await cleanupDatabase();
    }

    // Stop Docker services
    if (process.env.SKIP_DOCKER !== 'true' && process.env.KEEP_DOCKER_RUNNING !== 'true') {
      stopDockerServices();
    }

    console.log('Global test teardown complete');
  } catch (error) {
    console.error('Global test teardown failed:', error);
  }
}

// Suite setup (runs before each test suite)
export async function suiteSetup(): Promise<void> {
  // Cleanup between test suites
  await cleanupRedis();
}

// Suite teardown (runs after each test suite)
export async function suiteTeardown(): Promise<void> {
  // Additional cleanup if needed
}

// Test helpers
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(delayMs);
    }
  }
  throw new Error('Max retries exceeded');
};

// Export all setup/teardown functions
export default {
  globalSetup,
  globalTeardown,
  suiteSetup,
  suiteTeardown,
  waitForServices,
  setupDatabase,
  cleanupDatabase,
  cleanupRedis,
  cleanupRabbitMQ,
  TEST_CONFIG,
};
