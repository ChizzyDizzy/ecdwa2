/**
 * Common test helpers and mock data generators
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate mock user data
 */
export const generateMockUser = (overrides?: any) => ({
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  password: 'hashedPassword123',
  firstName: 'John',
  lastName: 'Doe',
  role: 'customer',
  isActive: true,
  twoFactorEnabled: false,
  twoFactorSecret: null,
  gdprConsent: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
  toJSON() {
    const { ...data } = this;
    delete data.toJSON;
    return data;
  },
});

/**
 * Generate mock product data
 */
export const generateMockProduct = (overrides?: any) => ({
  id: uuidv4(),
  name: 'Test Product',
  description: 'A test product description',
  price: 99.99,
  category: 'electronics',
  sku: `SKU-${Date.now()}`,
  vendorId: uuidv4(),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
  toJSON() {
    const { ...data } = this;
    delete data.toJSON;
    return data;
  },
});

/**
 * Generate mock order data
 */
export const generateMockOrder = (overrides?: any) => ({
  id: uuidv4(),
  userId: uuidv4(),
  items: [
    {
      productId: uuidv4(),
      quantity: 2,
      price: 99.99,
      subtotal: 199.98,
    },
  ],
  totalAmount: 199.98,
  status: 'pending',
  shippingAddress: {
    street: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'USA',
  },
  paymentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
  toJSON() {
    const { ...data } = this;
    delete data.toJSON;
    return data;
  },
});

/**
 * Generate mock inventory data
 */
export const generateMockInventory = (overrides?: any) => ({
  id: uuidv4(),
  productId: uuidv4(),
  quantity: 100,
  reservedQuantity: 0,
  warehouseLocation: 'Warehouse A',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
  getAvailableQuantity() {
    return this.quantity - this.reservedQuantity;
  },
  toJSON() {
    const { ...data } = this;
    delete data.toJSON;
    delete data.getAvailableQuantity;
    return data;
  },
});

/**
 * Generate mock payment data
 */
export const generateMockPayment = (overrides?: any) => ({
  id: uuidv4(),
  orderId: uuidv4(),
  userId: uuidv4(),
  amount: 199.98,
  currency: 'USD',
  paymentMethod: 'credit_card',
  status: 'processing',
  transactionId: null,
  pciCompliant: true,
  failureReason: null,
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
  toJSON() {
    const { ...data } = this;
    delete data.toJSON;
    return data;
  },
});

/**
 * Mock Sequelize model methods
 */
export const createMockModel = (mockData: any) => ({
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  ...mockData,
});

/**
 * Mock database transaction
 */
export const createMockTransaction = () => ({
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
});

/**
 * Mock event publisher
 */
export const createMockEventPublisher = () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
});

/**
 * Mock fetch response
 */
export const createMockFetchResponse = (data: any, ok = true) => ({
  ok,
  json: jest.fn().mockResolvedValue(data),
  status: ok ? 200 : 400,
  statusText: ok ? 'OK' : 'Bad Request',
});

/**
 * Wait for async operations
 */
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate random email
 */
export const randomEmail = () => `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

/**
 * Generate random SKU
 */
export const randomSKU = () => `SKU-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

/**
 * Clean object for comparison (removes functions and undefined values)
 */
export const cleanObject = (obj: any) => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Assert error type
 */
export const assertError = (error: any, expectedType: string, expectedMessage?: string) => {
  expect(error).toBeDefined();
  expect(error.constructor.name).toBe(expectedType);
  if (expectedMessage) {
    expect(error.message).toContain(expectedMessage);
  }
};

/**
 * Create mock request object for Express
 */
export const createMockRequest = (overrides?: any) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides,
});

/**
 * Create mock response object for Express
 */
export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create mock next function for Express middleware
 */
export const createMockNext = () => jest.fn();
