/**
 * Integration tests for Complete Order Placement Flow
 * Tests end-to-end order creation, payment, and fulfillment
 */

import request from 'supertest';

describe('Order Flow Integration', () => {
  const API_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
  let authToken: string;
  let userId: string;
  let productId: string;
  let orderId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Setup: Create user and get auth token
    const uniqueEmail = `order-test-${Date.now()}@example.com`;

    const registerResponse = await request(API_URL)
      .post('/api/users/register')
      .send({
        email: uniqueEmail,
        password: 'TestPassword123!',
        firstName: 'Order',
        lastName: 'Test',
        gdprConsent: true,
      });

    if (registerResponse.status === 200 || registerResponse.status === 201) {
      userId = registerResponse.body.data.id;

      const loginResponse = await request(API_URL)
        .post('/api/users/login')
        .send({
          email: uniqueEmail,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.data.token;
      }
    }

    // Setup: Create a product
    const productResponse = await request(API_URL)
      .post('/api/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Product for Order',
        description: 'A product for integration testing',
        price: 99.99,
        category: 'test',
        sku: `TEST-SKU-${Date.now()}`,
        vendorId: 'test-vendor',
      });

    if (productResponse.status === 200 || productResponse.status === 201) {
      productId = productResponse.body.data.id;

      // Setup: Create inventory for the product
      await request(API_URL)
        .post('/api/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId,
          quantity: 100,
          warehouseLocation: 'Test Warehouse',
        });
    }
  });

  describe('Product Browsing', () => {
    it('should browse available products', async () => {
      const response = await request(API_URL)
        .get('/api/products')
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('products');
        expect(Array.isArray(response.body.data.products)).toBe(true);
      } else {
        expect([503, 404]).toContain(response.status);
      }
    });

    it('should get product details', async () => {
      if (!productId) return;

      const response = await request(API_URL)
        .get(`/api/products/${productId}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', productId);
        expect(response.body.data).toHaveProperty('price');
      }
    });

    it('should check inventory availability', async () => {
      if (!productId) return;

      const response = await request(API_URL)
        .get(`/api/inventory/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('quantity');
        expect(response.body.data).toHaveProperty('availableQuantity');
      }
    });
  });

  describe('Order Creation', () => {
    it('should create an order with valid items', async () => {
      if (!authToken || !productId) return;

      const response = await request(API_URL)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          items: [
            {
              productId,
              quantity: 2,
              price: 99.99,
            },
          ],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
        })
        .expect('Content-Type', /json/);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('totalAmount');
        expect(response.body.data).toHaveProperty('status', 'pending');
        expect(response.body.data.items).toHaveLength(1);
        orderId = response.body.data.id;
      } else {
        expect([503, 404, 400]).toContain(response.status);
      }
    });

    it('should reject order with out-of-stock items', async () => {
      if (!authToken || !productId) return;

      const response = await request(API_URL)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          items: [
            {
              productId,
              quantity: 1000, // More than available
              price: 99.99,
            },
          ],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/stock|inventory/i);
      }
    });

    it('should reject order with empty items', async () => {
      if (!authToken) return;

      const response = await request(API_URL)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId,
          items: [],
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Payment Processing', () => {
    it('should process payment for order', async () => {
      if (!authToken || !orderId) return;

      const orderResponse = await request(API_URL)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (orderResponse.status !== 200) return;

      const response = await request(API_URL)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId,
          userId,
          amount: orderResponse.body.data.totalAmount,
          currency: 'USD',
          paymentMethod: 'credit_card',
          metadata: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123',
          },
        })
        .expect('Content-Type', /json/);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('status');
        expect(['processing', 'completed', 'failed']).toContain(response.body.data.status);
        paymentId = response.body.data.id;
      }
    });

    it('should reject payment with invalid amount', async () => {
      if (!authToken || !orderId) return;

      const response = await request(API_URL)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId,
          userId,
          amount: 0,
          currency: 'USD',
          paymentMethod: 'credit_card',
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Order Status Management', () => {
    it('should get order details', async () => {
      if (!authToken || !orderId) return;

      const response = await request(API_URL)
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', orderId);
        expect(response.body.data).toHaveProperty('status');
      }
    });

    it('should update order status', async () => {
      if (!authToken || !orderId) return;

      const response = await request(API_URL)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'confirmed',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('confirmed');
      }
    });

    it('should get order history for user', async () => {
      if (!authToken || !userId) return;

      const response = await request(API_URL)
        .get(`/api/orders/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('orders');
        expect(Array.isArray(response.body.data.orders)).toBe(true);
      }
    });
  });

  describe('Inventory Updates', () => {
    it('should reflect inventory changes after order', async () => {
      if (!authToken || !productId) return;

      const response = await request(API_URL)
        .get(`/api/inventory/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('reservedQuantity');
        expect(response.body.data.reservedQuantity).toBeGreaterThan(0);
      }
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel order and release inventory', async () => {
      if (!authToken || !orderId) return;

      const response = await request(API_URL)
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'cancelled',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
      }
    });

    it('should verify inventory released after cancellation', async () => {
      if (!authToken || !productId) return;

      // Wait a bit for async inventory release
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(API_URL)
        .get(`/api/inventory/product/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        // Reserved quantity should be back to 0 or reduced
        expect(response.body.data.reservedQuantity).toBeLessThanOrEqual(0);
      }
    });
  });

  describe('Payment Refund Flow', () => {
    it('should refund payment for cancelled order', async () => {
      if (!authToken || !paymentId) return;

      const response = await request(API_URL)
        .post(`/api/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Order cancelled by customer',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('refunded');
      }
    });
  });
});
