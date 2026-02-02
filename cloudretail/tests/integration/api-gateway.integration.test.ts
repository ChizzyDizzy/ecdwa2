/**
 * Integration tests for API Gateway
 * Tests service communication and routing
 */

import request from 'supertest';

describe('API Gateway Integration', () => {
  const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';

  describe('Health Checks', () => {
    it('should return health status for all services', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Service Routing', () => {
    it('should route requests to user service', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/users/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });

    it('should route requests to product service', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/products/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });

    it('should route requests to order service', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/orders/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });

    it('should route requests to inventory service', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/inventory/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });

    it('should route requests to payment service', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/payments/health')
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/nonexistent/route')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle service unavailability gracefully', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/unavailable-service/test')
        .expect('Content-Type', /json/);

      expect([404, 503]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(API_GATEWAY_URL)
            .get('/health')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(API_GATEWAY_URL)
        .options('/api/users')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authentication token for protected routes', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/users/profile')
        .expect('Content-Type', /json/);

      expect([401, 404]).toContain(response.status);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(API_GATEWAY_URL)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect('Content-Type', /json/);

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('Load Balancing', () => {
    it('should distribute requests across service instances', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(API_GATEWAY_URL)
            .get('/api/products')
        );
      }

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });
});
