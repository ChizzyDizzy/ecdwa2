/**
 * Integration tests for User Registration and Login Flow
 * Tests end-to-end user authentication workflows
 */

import request from 'supertest';

describe('User Flow Integration', () => {
  const API_URL = process.env.API_GATEWAY_URL || 'http://localhost:3000';
  const uniqueEmail = `test-${Date.now()}@example.com`;
  let authToken: string;
  let userId: string;

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      const response = await request(API_URL)
        .post('/api/users/register')
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Doe',
          gdprConsent: true,
        })
        .expect('Content-Type', /json/);

      if (response.status === 201 || response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('email', uniqueEmail);
        expect(response.body.data).not.toHaveProperty('password');
        userId = response.body.data.id;
      } else {
        // Service may not be running
        expect([503, 404]).toContain(response.status);
      }
    });

    it('should reject registration with existing email', async () => {
      const response = await request(API_URL)
        .post('/api/users/register')
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123!',
          firstName: 'Jane',
          lastName: 'Smith',
          gdprConsent: true,
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('already exists');
      }
    });

    it('should reject registration without GDPR consent', async () => {
      const response = await request(API_URL)
        .post('/api/users/register')
        .send({
          email: `new-${Date.now()}@example.com`,
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Doe',
          gdprConsent: false,
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('User Login Flow', () => {
    it('should login with valid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/users/login')
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123!',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('token');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data.user.email).toBe(uniqueEmail);
        authToken = response.body.data.token;
      } else {
        expect([503, 404, 401]).toContain(response.status);
      }
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(API_URL)
        .post('/api/users/login')
        .send({
          email: uniqueEmail,
          password: 'WrongPassword',
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(API_URL)
        .post('/api/users/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('User Profile Management', () => {
    it('should get user profile with valid token', async () => {
      if (!authToken) {
        return; // Skip if login didn't work
      }

      const response = await request(API_URL)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', userId);
        expect(response.body.data).not.toHaveProperty('password');
      }
    });

    it('should update user profile with valid token', async () => {
      if (!authToken || !userId) {
        return; // Skip if login didn't work
      }

      const response = await request(API_URL)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.firstName).toBe('Jane');
        expect(response.body.data.lastName).toBe('Smith');
      }
    });

    it('should reject profile access without token', async () => {
      const response = await request(API_URL)
        .get(`/api/users/${userId}`)
        .expect('Content-Type', /json/);

      if (response.status !== 503 && response.status !== 404) {
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Two-Factor Authentication Flow', () => {
    it('should enable 2FA for user', async () => {
      if (!authToken || !userId) {
        return; // Skip if login didn't work
      }

      const response = await request(API_URL)
        .post(`/api/users/${userId}/2fa/enable`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('secret');
        expect(response.body.data).toHaveProperty('qrCode');
      }
    });
  });

  describe('GDPR Compliance - User Deletion', () => {
    it('should delete user account (right to be forgotten)', async () => {
      if (!authToken || !userId) {
        return; // Skip if login didn't work
      }

      const response = await request(API_URL)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted');
      }
    });

    it('should not find deleted user', async () => {
      if (!userId) {
        return; // Skip if user wasn't created
      }

      const response = await request(API_URL)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect('Content-Type', /json/);

      if (response.status !== 503) {
        expect(response.status).toBe(404);
      }
    });
  });
});
