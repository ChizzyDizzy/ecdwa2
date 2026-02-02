# CloudRetail Testing Guide

Comprehensive testing documentation for the CloudRetail microservices platform, covering unit tests, integration tests, and performance tests.

## Table of Contents

- [Overview](#overview)
- [Testing Strategy](#testing-strategy)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [Performance Tests](#performance-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The CloudRetail testing infrastructure provides comprehensive coverage across multiple layers:

- **Unit Tests**: Testing individual components in isolation
- **Integration Tests**: Testing service interactions and workflows
- **Performance Tests**: Load testing and stress testing
- **End-to-End Tests**: Complete user journey validation
- **Contract Tests**: API contract validation between services

### Testing Philosophy

We follow the **Testing Pyramid** approach:

```
           /\
          /  \    E2E Tests (Few, Slow, Expensive)
         /____\
        /      \  Integration Tests (Some, Medium Speed)
       /________\
      /          \ Unit Tests (Many, Fast, Cheap)
     /____________\
```

### Test Coverage Goals

| Layer | Coverage Target | Current Coverage |
|-------|----------------|------------------|
| Unit Tests | 80% | View with `npm run test:coverage` |
| Integration Tests | 70% | View with `npm run test:integration:coverage` |
| API Contracts | 100% | All public APIs |
| Critical Paths | 100% | Payment, Order, Auth |

## Testing Strategy

### Test Levels

1. **Unit Tests** (`tests/unit/`, `services/*/tests/`)
   - Test individual functions and classes
   - Mock all external dependencies
   - Fast execution (< 5 seconds total)
   - Run on every commit

2. **Integration Tests** (`tests/integration/`)
   - Test service-to-service communication
   - Test database interactions
   - Test event bus messaging
   - Run on every PR

3. **Performance Tests** (`tests/performance/`)
   - Load testing with Artillery and k6
   - Stress testing to find breaking points
   - Spike testing for traffic spikes
   - Run nightly and before releases

4. **End-to-End Tests** (Future)
   - Complete user workflows
   - Browser automation with Playwright
   - Run before releases

## Test Structure

```
tests/
├── integration/           # Integration tests
│   ├── setup.ts          # Test setup and teardown
│   ├── api-gateway.integration.test.ts
│   ├── user-flow.integration.test.ts
│   ├── order-flow.integration.test.ts
│   └── event-bus.integration.test.ts
├── performance/          # Performance tests
│   ├── artillery.yml     # Artillery configuration
│   ├── load-test.js      # Load testing with Artillery
│   ├── stress-test.js    # Stress testing
│   └── k6-load-test.js   # Load testing with k6
├── unit/                 # Shared unit tests
├── utils/                # Test utilities
│   ├── test-helpers.ts   # Helper functions
│   ├── db-setup.ts       # Database test utilities
│   └── mock-server.ts    # Mock server setup
├── setup.ts              # Global test setup
├── jest.setup.ts         # Jest configuration
└── README.md            # This file

services/
└── [service-name]/
    └── tests/            # Service-specific unit tests
        ├── unit/
        └── integration/
```

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Start test infrastructure (databases, Redis, RabbitMQ)
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
npm run test:wait-for-services
```

### All Tests

```bash
# Run all tests (unit + integration)
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch
```

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run unit tests for specific service
npm run test:unit --workspace=services/user-service

# Run specific test file
npm test -- user.service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create user"
```

### Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- --testNamePattern="user flow"

# Run with verbose output
npm run test:integration -- --verbose

# Skip Docker setup (if already running)
SKIP_DOCKER=true npm run test:integration

# Keep Docker running after tests
KEEP_DOCKER_RUNNING=true npm run test:integration
```

### Performance Tests

#### Artillery

```bash
# Run load test
npm run test:performance

# Or run directly
artillery run tests/performance/artillery.yml

# Run with custom duration
artillery run -e production tests/performance/artillery.yml

# Generate HTML report
artillery run --output report.json tests/performance/artillery.yml
artillery report report.json --output report.html
```

#### k6

```bash
# Install k6 (if not already installed)
# macOS: brew install k6
# Linux: https://k6.io/docs/getting-started/installation/

# Run k6 load test
k6 run tests/performance/k6-load-test.js

# Run with custom VUs and duration
k6 run --vus 100 --duration 30s tests/performance/k6-load-test.js

# Run with environment variables
API_GATEWAY_URL=http://staging.example.com k6 run tests/performance/k6-load-test.js

# Output to InfluxDB for visualization
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/k6-load-test.js
```

#### Stress Test

```bash
# Run stress test to find breaking points
node tests/performance/stress-test.js

# Or with Artillery
artillery run tests/performance/artillery.yml -e stress
```

### Service-Specific Tests

```bash
# User Service
npm run test --workspace=services/user-service

# Product Service
npm run test --workspace=services/product-service

# Order Service
npm run test --workspace=services/order-service

# Inventory Service
npm run test --workspace=services/inventory-service

# Payment Service
npm run test --workspace=services/payment-service
```

## Test Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report in browser
open coverage/lcov-report/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  },
}
```

### Improving Coverage

1. Identify uncovered code:
```bash
npm run test:coverage -- --collectCoverageFrom="services/user-service/src/**/*.ts"
```

2. Focus on critical paths first:
   - Authentication and authorization
   - Payment processing
   - Order creation
   - Inventory management

3. Use coverage reports to guide testing efforts

## Unit Tests

### Writing Unit Tests

```typescript
// services/user-service/tests/unit/user.service.test.ts
import { UserService } from '../../src/services/user.service';
import { UserRepository } from '../../src/repositories/user.repository';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Create mocks
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Inject mocks
    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const expectedUser = {
        id: '123',
        ...userData,
        createdAt: new Date(),
      };

      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
      expect(mockUserRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
      };

      mockUserRepository.create.mockRejectedValue(
        new Error('Email already exists')
      );

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow(
        'Email already exists'
      );
    });
  });
});
```

### Unit Test Best Practices

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **One assertion per test** (when possible)
3. **Mock external dependencies** (databases, APIs, file system)
4. **Use descriptive test names**: "should [expected behavior] when [condition]"
5. **Test edge cases**: null, undefined, empty arrays, boundary values
6. **Keep tests independent**: No shared state between tests

## Integration Tests

### Test Setup

Integration tests use real infrastructure (databases, message queues) running in Docker.

```typescript
// tests/integration/user-flow.integration.test.ts
import request from 'supertest';
import { TEST_CONFIG } from './setup';

describe('User Flow Integration', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Wait for services to be ready
    await waitForServices();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupDatabase();
  });

  describe('User Registration and Login', () => {
    it('should register a new user', async () => {
      const response = await request(TEST_CONFIG.apiGatewayUrl)
        .post('/api/users/register')
        .send({
          email: 'integration-test@example.com',
          password: 'Test123!@#',
          firstName: 'Integration',
          lastName: 'Test',
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('userId');

      authToken = response.body.token;
      userId = response.body.userId;
    });

    it('should login with credentials', async () => {
      const response = await request(TEST_CONFIG.apiGatewayUrl)
        .post('/api/users/login')
        .send({
          email: 'integration-test@example.com',
          password: 'Test123!@#',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
    });

    it('should get user profile', async () => {
      const response = await request(TEST_CONFIG.apiGatewayUrl)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.email).toBe('integration-test@example.com');
    });
  });
});
```

### Integration Test Categories

1. **API Gateway Tests** (`api-gateway.integration.test.ts`)
   - Routing and load balancing
   - Authentication and authorization
   - Rate limiting
   - CORS

2. **User Flow Tests** (`user-flow.integration.test.ts`)
   - Registration
   - Login/logout
   - Profile management
   - Password reset

3. **Order Flow Tests** (`order-flow.integration.test.ts`)
   - Order creation
   - Payment processing
   - Inventory reservation
   - Event propagation

4. **Event Bus Tests** (`event-bus.integration.test.ts`)
   - Event publishing
   - Event consumption
   - Event ordering
   - Dead letter handling

### Running Integration Tests in CI

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on: [pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Performance Tests

### Load Testing

**Goal**: Verify system handles expected production load

**Metrics**:
- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Resource utilization

**Example Scenarios** (Artillery):

```yaml
# tests/performance/artillery.yml
scenarios:
  - name: "Normal Load"
    flow:
      - post:
          url: "/api/users/login"
          json:
            email: "{{ $randomEmail() }}"
            password: "password123"
      - get:
          url: "/api/products"
      - post:
          url: "/api/orders"
          json:
            items: [{ productId: "{{ productId }}", quantity: 2 }]
```

### Stress Testing

**Goal**: Find system breaking points

**Approach**:
1. Gradually increase load
2. Monitor for failures
3. Identify bottlenecks
4. Document breaking point

**Running Stress Tests**:

```bash
node tests/performance/stress-test.js
```

### Performance Benchmarks

| Endpoint | p95 Response Time | Throughput | Error Rate |
|----------|------------------|------------|------------|
| POST /api/users/login | < 200ms | > 100 req/s | < 0.1% |
| GET /api/products | < 150ms | > 200 req/s | < 0.1% |
| POST /api/orders | < 500ms | > 50 req/s | < 1% |
| POST /api/payments | < 1000ms | > 30 req/s | < 0.5% |

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: npm run test:integration
      - run: docker-compose -f docker-compose.test.yml down

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/performance/k6-load-test.js
```

### Pre-commit Hooks

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test:unit"
```

### Pre-push Hooks

```bash
# Add pre-push hook for integration tests
npx husky add .husky/pre-push "npm run test:integration"
```

## Best Practices

### General

1. **Write tests first** (TDD when possible)
2. **Keep tests isolated** and independent
3. **Use meaningful test names** that describe behavior
4. **Test behavior, not implementation**
5. **Avoid test interdependencies**
6. **Clean up after tests** (database, files, etc.)

### Unit Tests

1. **Mock external dependencies**
2. **Test one thing at a time**
3. **Use test data builders** for complex objects
4. **Avoid testing private methods** directly
5. **Test edge cases and error conditions**

### Integration Tests

1. **Use test databases** (not production data)
2. **Reset state between tests**
3. **Test realistic scenarios**
4. **Keep tests fast** (< 30 seconds total)
5. **Use transactions for cleanup** when possible

### Performance Tests

1. **Set realistic load levels**
2. **Monitor system resources**
3. **Test with production-like data**
4. **Run tests in production-like environment**
5. **Document performance baselines**

## Troubleshooting

### Common Issues

#### Tests Fail with "Cannot connect to database"

```bash
# Ensure test database is running
docker-compose -f docker-compose.test.yml up -d postgres

# Check connectivity
psql -h localhost -U test -d cloudretail_test

# Reset database
npm run db:reset:test
```

#### Tests Timeout

```bash
# Increase timeout in jest.config.js
{
  testTimeout: 60000  // 60 seconds
}

# Or for specific test
it('slow test', async () => {
  // test code
}, 60000);
```

#### Integration Tests Fail Randomly

- Ensure proper cleanup in `afterEach`/`afterAll`
- Check for race conditions
- Use proper async/await
- Add retries for flaky external services

#### Performance Tests Show Degradation

1. Check recent code changes
2. Review database query performance
3. Check for memory leaks
4. Monitor infrastructure resources
5. Compare with baseline metrics

### Debugging Tests

```bash
# Run with debug output
DEBUG=* npm test

# Run single test file
npm test -- tests/integration/user-flow.integration.test.ts

# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Use VS Code debugger
# Add configuration to .vscode/launch.json
```

### Getting Help

- Check test logs: `npm test -- --verbose`
- Review CI/CD logs in GitHub Actions
- Ask in #cloudretail-testing Slack channel
- Create issue with `testing` label

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Artillery Documentation](https://www.artillery.io/docs)
- [k6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new tests:

1. Follow existing patterns and conventions
2. Update this README if adding new test types
3. Ensure all tests pass before committing
4. Add test coverage for new features
5. Document any special test setup requirements
