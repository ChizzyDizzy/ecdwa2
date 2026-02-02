/**
 * Global test setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'cloudretail_test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set global test timeout
jest.setTimeout(30000);

// Mock timers if needed
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
