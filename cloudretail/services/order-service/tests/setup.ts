/**
 * Test setup for Order Service
 */
import { jest, beforeEach } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'order_service_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.INVENTORY_SERVICE_URL = 'http://localhost:3004';
process.env.PAYMENT_SERVICE_URL = 'http://localhost:3005';

// Mock logger
jest.mock('@cloudretail/middleware', () => ({
  ...(jest.requireActual('@cloudretail/middleware') as object),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});
