/**
 * Artillery Custom Functions
 * Helper functions for load testing scenarios
 */

module.exports = {
  /**
   * Generate random string
   */
  randomString: function(context, events, done) {
    const length = 10;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    context.vars.randomString = result;
    return done();
  },

  /**
   * Generate random number
   */
  randomNumber: function(context, events, done) {
    const min = 1;
    const max = 1000;
    context.vars.randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return done();
  },

  /**
   * Generate random email
   */
  randomEmail: function(context, events, done) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    context.vars.randomEmail = `load-test-${timestamp}-${random}@example.com`;
    return done();
  },

  /**
   * Log response for debugging
   */
  logResponse: function(requestParams, response, context, ee, next) {
    if (process.env.DEBUG) {
      console.log('Response status:', response.statusCode);
      console.log('Response body:', response.body);
    }
    return next();
  },

  /**
   * Track response times
   */
  trackResponseTime: function(requestParams, response, context, ee, next) {
    const responseTime = response.timings.phases.total;

    if (responseTime > 1000) {
      console.warn(`Slow response detected: ${responseTime}ms for ${requestParams.url}`);
    }

    return next();
  },

  /**
   * Setup test user
   */
  setupTestUser: function(context, events, done) {
    context.vars.testUser = {
      email: 'loadtest@example.com',
      password: 'LoadTest123!',
      firstName: 'Load',
      lastName: 'Test',
    };
    return done();
  },

  /**
   * Generate realistic product data
   */
  generateProductData: function(context, events, done) {
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
    const adjectives = ['Premium', 'Deluxe', 'Standard', 'Professional', 'Classic'];
    const nouns = ['Laptop', 'Phone', 'Tablet', 'Watch', 'Camera'];

    const category = categories[Math.floor(Math.random() * categories.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    context.vars.product = {
      name: `${adjective} ${noun}`,
      description: `A high-quality ${noun.toLowerCase()} for ${category}`,
      price: Math.floor(Math.random() * 1000) + 10,
      category: category,
      sku: `SKU-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    return done();
  },

  /**
   * Generate realistic order data
   */
  generateOrderData: function(context, events, done) {
    const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Maple Dr', 'Cedar Ln'];
    const cities = ['Springfield', 'Riverside', 'Greenville', 'Fairview', 'Madison'];
    const states = ['CA', 'NY', 'TX', 'FL', 'IL'];

    context.vars.shippingAddress = {
      street: `${Math.floor(Math.random() * 9999) + 1} ${streets[Math.floor(Math.random() * streets.length)]}`,
      city: cities[Math.floor(Math.random() * cities.length)],
      state: states[Math.floor(Math.random() * states.length)],
      zipCode: String(Math.floor(Math.random() * 90000) + 10000),
      country: 'USA',
    };

    return done();
  },

  /**
   * Validate response structure
   */
  validateResponse: function(requestParams, response, context, ee, next) {
    try {
      const body = JSON.parse(response.body);

      if (!body.hasOwnProperty('success')) {
        ee.emit('error', new Error('Response missing success field'));
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (!body.success) {
          ee.emit('error', new Error('Success response has success: false'));
        }
      }

      if (response.statusCode >= 400) {
        if (!body.error) {
          ee.emit('error', new Error('Error response missing error field'));
        }
      }
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('Response validation error:', error.message);
      }
    }

    return next();
  },

  /**
   * Think time - simulate user behavior
   */
  randomThinkTime: function(context, events, done) {
    const minSeconds = 1;
    const maxSeconds = 5;
    const thinkTime = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;

    setTimeout(() => {
      return done();
    }, thinkTime * 1000);
  },
};
