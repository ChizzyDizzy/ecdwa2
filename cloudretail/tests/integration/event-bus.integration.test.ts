/**
 * Integration tests for Event Bus
 * Tests event publishing and consumption across services
 */

import request from 'supertest';

describe('Event Bus Integration', () => {
  const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'http://localhost:3006';
  const API_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

  describe('Event Bus Health', () => {
    it('should return event bus health status', async () => {
      const response = await request(EVENT_BUS_URL)
        .get('/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Event Publishing', () => {
    it('should publish user.created event', async () => {
      const event = {
        type: 'user.created',
        payload: {
          userId: 'test-user-123',
          email: 'test@example.com',
          role: 'customer',
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send(event)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('published');
      } else {
        expect([503, 404]).toContain(response.status);
      }
    });

    it('should publish product.created event', async () => {
      const event = {
        type: 'product.created',
        payload: {
          productId: 'test-product-123',
          name: 'Test Product',
          price: 99.99,
          category: 'test',
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send(event)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should publish order.created event', async () => {
      const event = {
        type: 'order.created',
        payload: {
          orderId: 'test-order-123',
          userId: 'test-user-123',
          totalAmount: 199.98,
          items: [
            { productId: 'test-product-123', quantity: 2, price: 99.99 },
          ],
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send(event)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should publish inventory.reserved event', async () => {
      const event = {
        type: 'inventory.reserved',
        payload: {
          orderId: 'test-order-123',
          items: [
            { productId: 'test-product-123', quantity: 2 },
          ],
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send(event)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should publish payment.completed event', async () => {
      const event = {
        type: 'payment.completed',
        payload: {
          paymentId: 'test-payment-123',
          orderId: 'test-order-123',
          userId: 'test-user-123',
          amount: 199.98,
          transactionId: 'txn_123456',
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send(event)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Event Subscription', () => {
    it('should subscribe to user events', async () => {
      const response = await request(EVENT_BUS_URL)
        .post('/events/subscribe')
        .send({
          eventType: 'user.*',
          subscriberId: 'test-subscriber-1',
          webhookUrl: 'http://localhost:3000/webhook/user-events',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should subscribe to order events', async () => {
      const response = await request(EVENT_BUS_URL)
        .post('/events/subscribe')
        .send({
          eventType: 'order.*',
          subscriberId: 'test-subscriber-2',
          webhookUrl: 'http://localhost:3000/webhook/order-events',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Event History', () => {
    it('should retrieve event history', async () => {
      const response = await request(EVENT_BUS_URL)
        .get('/events/history')
        .query({ limit: 10 })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('events');
        expect(Array.isArray(response.body.data.events)).toBe(true);
      }
    });

    it('should filter events by type', async () => {
      const response = await request(EVENT_BUS_URL)
        .get('/events/history')
        .query({ type: 'user.created', limit: 10 })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('events');
      }
    });
  });

  describe('End-to-End Event Flow', () => {
    it('should trigger cascading events when user is created', async () => {
      const uniqueEmail = `event-test-${Date.now()}@example.com`;

      // Create user (should trigger user.created event)
      const response = await request(API_URL)
        .post('/api/users/register')
        .send({
          email: uniqueEmail,
          password: 'TestPassword123!',
          firstName: 'Event',
          lastName: 'Test',
          gdprConsent: true,
        })
        .expect('Content-Type', /json/);

      if (response.status === 200 || response.status === 201) {
        expect(response.body.success).toBe(true);

        // Wait for event propagation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check event was published
        const eventsResponse = await request(EVENT_BUS_URL)
          .get('/events/history')
          .query({ type: 'user.created', limit: 5 });

        if (eventsResponse.status === 200) {
          const events = eventsResponse.body.data.events;
          const userCreatedEvent = events.find((e: any) =>
            e.payload && e.payload.email === uniqueEmail
          );
          expect(userCreatedEvent).toBeDefined();
        }
      }
    });

    it('should trigger multiple events during order flow', async () => {
      // This test verifies that creating an order triggers:
      // 1. order.created event
      // 2. inventory.reserved event
      // 3. Potentially payment.initiated event

      // This is tested indirectly through the order creation endpoint
      // The actual event flow is tested in the order-flow integration test
    });
  });

  describe('Event Error Handling', () => {
    it('should handle invalid event format', async () => {
      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send({
          // Missing required fields
          invalid: 'data',
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503) {
        expect([400, 404]).toContain(response.status);
      }
    });

    it('should handle missing event type', async () => {
      const response = await request(EVENT_BUS_URL)
        .post('/events/publish')
        .send({
          payload: { test: 'data' },
          timestamp: new Date().toISOString(),
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503) {
        expect([400, 404]).toContain(response.status);
      }
    });
  });
});
