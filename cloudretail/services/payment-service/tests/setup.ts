/**
 * Test setup for Payment Service
 */

process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'payment_service_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.ORDER_SERVICE_URL = 'http://localhost:3003';

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
