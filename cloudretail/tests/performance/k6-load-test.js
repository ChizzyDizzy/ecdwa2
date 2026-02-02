/**
 * K6 Load Testing Script for CloudRetail
 * Alternative to Artillery for performance testing
 *
 * Installation: https://k6.io/docs/getting-started/installation/
 * Run: k6 run tests/performance/k6-load-test.js
 *
 * Test scenarios:
 * - User registration and login
 * - Product browsing and search
 * - Order creation and checkout
 * - Concurrent user simulation
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const loginRate = new Rate('login_success_rate');
const orderRate = new Rate('order_success_rate');
const responseTime = new Trend('custom_response_time');
const errorCounter = new Counter('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '3m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% of requests under 500ms, 99% under 1s
    http_req_failed: ['rate<0.05'],                 // Error rate under 5%
    login_success_rate: ['rate>0.95'],              // Login success rate > 95%
    order_success_rate: ['rate>0.90'],              // Order success rate > 90%
    http_reqs: ['rate>100'],                        // Throughput > 100 req/s
  },
  ext: {
    loadimpact: {
      projectID: 3481978,
      name: 'CloudRetail Load Test',
    },
  },
};

// Base configuration
const BASE_URL = __ENV.API_GATEWAY_URL || 'http://localhost:3000';
const API_TIMEOUT = '30s';

// Test data generators
function generateUser() {
  const username = `testuser_${randomString(8)}`;
  return {
    username: username,
    email: `${username}@test.com`,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
  };
}

function generateProduct() {
  return {
    name: `Product_${randomString(8)}`,
    description: 'Test product for load testing',
    price: randomIntBetween(10, 1000),
    category: ['Electronics', 'Clothing', 'Books', 'Home'][randomIntBetween(0, 3)],
    stock: randomIntBetween(10, 1000),
  };
}

// Shared test state
let authToken = '';
let userId = '';
let productIds = [];

// Setup function - runs once per VU
export function setup() {
  // Create test products
  const products = [];
  for (let i = 0; i < 10; i++) {
    products.push(generateProduct());
  }

  return { products };
}

// Main test scenario
export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: API_TIMEOUT,
  };

  // Scenario 1: User Registration and Login
  group('User Registration and Login', () => {
    const user = generateUser();

    // Register new user
    const registerRes = http.post(
      `${BASE_URL}/api/users/register`,
      JSON.stringify(user),
      params
    );

    const registerSuccess = check(registerRes, {
      'registration status is 201': (r) => r.status === 201,
      'registration response has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.token !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    responseTime.add(registerRes.timings.duration);

    if (!registerSuccess) {
      errorCounter.add(1);
    }

    sleep(1);

    // Login
    const loginRes = http.post(
      `${BASE_URL}/api/users/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      params
    );

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login response has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (body.token) {
            authToken = body.token;
            userId = body.userId || body.id;
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      },
    });

    loginRate.add(loginSuccess);
    responseTime.add(loginRes.timings.duration);

    if (!loginSuccess) {
      errorCounter.add(1);
      return; // Skip remaining tests if login fails
    }
  });

  sleep(randomIntBetween(1, 3));

  // Scenario 2: Product Browsing
  group('Product Browsing', () => {
    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      timeout: API_TIMEOUT,
    };

    // List products
    const listRes = http.get(`${BASE_URL}/api/products`, authParams);

    check(listRes, {
      'product list status is 200': (r) => r.status === 200,
      'product list has items': (r) => {
        try {
          const body = JSON.parse(r.body);
          if (Array.isArray(body.products) && body.products.length > 0) {
            productIds = body.products.slice(0, 5).map(p => p.id);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      },
    });

    responseTime.add(listRes.timings.duration);

    // View random product details
    if (productIds.length > 0) {
      const randomProductId = productIds[randomIntBetween(0, productIds.length - 1)];
      const detailRes = http.get(`${BASE_URL}/api/products/${randomProductId}`, authParams);

      check(detailRes, {
        'product detail status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      });

      responseTime.add(detailRes.timings.duration);
    }

    // Search products
    const searchRes = http.get(`${BASE_URL}/api/products/search?q=test`, authParams);

    check(searchRes, {
      'product search status is 200': (r) => r.status === 200,
    });

    responseTime.add(searchRes.timings.duration);
  });

  sleep(randomIntBetween(2, 5));

  // Scenario 3: Order Creation
  group('Order Creation', () => {
    if (!authToken || productIds.length === 0) {
      return; // Skip if not authenticated or no products
    }

    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      timeout: API_TIMEOUT,
    };

    // Create order
    const orderData = {
      userId: userId,
      items: [
        {
          productId: productIds[0],
          quantity: randomIntBetween(1, 5),
          price: randomIntBetween(10, 100),
        },
      ],
      shippingAddress: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country',
      },
    };

    const orderRes = http.post(
      `${BASE_URL}/api/orders`,
      JSON.stringify(orderData),
      authParams
    );

    const orderSuccess = check(orderRes, {
      'order creation status is 201 or 200': (r) => r.status === 201 || r.status === 200,
      'order response has id': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id !== undefined || body.orderId !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    orderRate.add(orderSuccess);
    responseTime.add(orderRes.timings.duration);

    if (!orderSuccess) {
      errorCounter.add(1);
    }
  });

  sleep(randomIntBetween(1, 3));

  // Scenario 4: User Profile
  group('User Profile', () => {
    if (!authToken) {
      return;
    }

    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      timeout: API_TIMEOUT,
    };

    // Get user profile
    const profileRes = http.get(`${BASE_URL}/api/users/profile`, authParams);

    check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
    });

    responseTime.add(profileRes.timings.duration);

    // Get user orders
    const ordersRes = http.get(`${BASE_URL}/api/orders/user/${userId}`, authParams);

    check(ordersRes, {
      'user orders status is 200': (r) => r.status === 200,
    });

    responseTime.add(ordersRes.timings.duration);
  });

  sleep(randomIntBetween(1, 2));

  // Scenario 5: Inventory Check
  group('Inventory Operations', () => {
    if (productIds.length === 0) {
      return;
    }

    const authParams = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      timeout: API_TIMEOUT,
    };

    // Check inventory for random product
    const randomProductId = productIds[randomIntBetween(0, productIds.length - 1)];
    const inventoryRes = http.get(
      `${BASE_URL}/api/inventory/product/${randomProductId}`,
      authParams
    );

    check(inventoryRes, {
      'inventory check status is 200': (r) => r.status === 200 || r.status === 404,
    });

    responseTime.add(inventoryRes.timings.duration);
  });

  sleep(1);
}

// Teardown function - runs once after all VUs complete
export function teardown(data) {
  console.log('Load test completed');
}

// Stress testing scenario (separate execution)
export function stressTest() {
  const options = {
    stages: [
      { duration: '1m', target: 100 },   // Ramp up to 100 users
      { duration: '2m', target: 200 },   // Ramp up to 200 users
      { duration: '2m', target: 400 },   // Ramp up to 400 users
      { duration: '2m', target: 600 },   // Ramp up to 600 users
      { duration: '2m', target: 800 },   // Ramp up to 800 users (breaking point)
      { duration: '5m', target: 800 },   // Stay at 800 users
      { duration: '2m', target: 0 },     // Ramp down
    ],
  };

  return options;
}

// Spike testing scenario (separate execution)
export function spikeTest() {
  const options = {
    stages: [
      { duration: '30s', target: 50 },   // Normal load
      { duration: '10s', target: 500 },  // Sudden spike
      { duration: '1m', target: 500 },   // Maintain spike
      { duration: '10s', target: 50 },   // Return to normal
      { duration: '2m', target: 50 },    // Maintain normal
      { duration: '10s', target: 0 },    // Ramp down
    ],
  };

  return options;
}
