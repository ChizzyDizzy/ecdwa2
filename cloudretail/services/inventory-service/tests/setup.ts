/**
 * Test setup for Inventory Service
 */
import { jest, beforeEach } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'inventory_service_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

// Mock logger
jest.mock('@cloudretail/middleware', () => ({
  ...jest.requireActual('@cloudretail/middleware'),
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
