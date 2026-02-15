# CloudRetail - E-Commerce Microservices Platform
## Assignment Presentation

---

# Slide 1: Project Overview

## CloudRetail - Cloud-Native E-Commerce Platform

**What is it?**
- A fully functional e-commerce platform built with microservices architecture
- Deployed on AWS cloud infrastructure
- Demonstrates enterprise-grade patterns and practices

**Key Numbers:**
- 5 Independent Microservices
- 5 Separate Databases (Database per Service)
- 1 API Gateway
- 1 Event Bus for async communication
- Full TypeScript implementation

---

# Slide 2: Architecture Overview

```
                    [Frontend - Nginx]
                           |
                    [API Gateway]
                           |
    ------------------------------------------------
    |         |          |          |              |
[User]   [Product]   [Order]   [Inventory]   [Payment]
Service   Service    Service    Service       Service
    |         |          |          |              |
[User DB] [Product DB] [Order DB] [Inventory DB] [Payment DB]
                           |
                    [Event Bus / Kafka]
```

**Why Microservices instead of Monolith?**
- Independent scaling of each service
- Isolated failures (one service down doesn't crash all)
- Different teams can work on different services
- Technology flexibility per service
- Easier maintenance and updates

---

# Slide 3: Technology Stack & Choices

| Component | Technology | Why This Choice? |
|-----------|------------|------------------|
| **Backend** | Node.js + TypeScript | Type safety, async I/O, large ecosystem |
| **API Gateway** | Express + http-proxy-middleware | Lightweight, flexible routing, easy proxy setup |
| **Database** | PostgreSQL | ACID compliance, relational data, free tier on AWS RDS |
| **ORM** | Sequelize | TypeScript support, migrations, connection pooling |
| **Auth** | JWT + Bcrypt | Stateless auth (scalable), secure password hashing |
| **Events** | Kafka | Industry standard, reliable message delivery |
| **Cache** | Redis | Fast in-memory cache, session storage |
| **Container** | Docker | Consistent environments, easy deployment |
| **Cloud** | AWS (EC2, RDS, ECR) | Industry leader, free tier available |

**Why Not Alternatives?**
- MongoDB: Relational data better for e-commerce (orders, inventory)
- GraphQL: REST simpler for CRUD operations, better understood
- Kubernetes: EC2 + Docker Compose sufficient for demo scale

---

# Slide 4: Security Implementation

## Multi-Layer Security Approach

**Authentication:**
- JWT tokens (JSON Web Tokens)
- Bcrypt password hashing (12 rounds)
- Two-Factor Authentication (TOTP)

**Authorization:**
- Role-Based Access Control (RBAC)
- Three roles: Customer, Vendor, Admin
- Route-level permission checks

**API Security:**
- Helmet.js for HTTP headers
- CORS configuration
- Rate limiting (100 req/min standard, 20 req/min strict)
- Input validation with Joi schemas

**Data Security:**
- SQL injection prevention via Sequelize ORM
- GDPR compliance (consent required, delete endpoint)
- Environment variables for secrets

**Why JWT over Sessions?**
- Stateless = easier horizontal scaling
- No server-side session storage needed
- Works across microservices

---

# Slide 5: Scalability Design

## Horizontal Scaling Ready

**Stateless Services:**
- JWT authentication (no session state)
- No local file storage
- Database connection pooling

**Database Scalability:**
- Connection pooling (max 5 connections per service)
- Read replicas supported
- Pagination on all list endpoints

**Kubernetes Ready:**
- Horizontal Pod Autoscaler (HPA) configurations
- Scale based on CPU (target 70%)
- Min 2, Max 10 replicas per service

**Caching Strategy:**
- Redis for frequently accessed data
- Reduces database load
- Session caching

**Why These Choices?**
- Stateless design allows any instance to handle any request
- Connection pooling prevents database exhaustion
- HPA automatically handles traffic spikes

---

# Slide 6: Fault Tolerance & Resilience

## System Continues Operating Despite Failures

**Circuit Breaker Pattern:**
- Using Opossum library
- Opens after 5 consecutive failures
- 30-second recovery timeout
- Prevents cascading failures

**Graceful Degradation:**
- Event bus has 3-second timeout
- Services continue if Kafka is down
- Non-critical features fail silently

**Health Checks:**
- Every service has `/health` endpoint
- Docker restarts unhealthy containers
- API Gateway monitors all services

**Database Transactions:**
- Atomic operations for inventory
- Rollback on failure
- Compensating transactions for order cancellation

**Why Circuit Breakers?**
- Without them: one slow service can bring down entire system
- With them: failing service is isolated, others continue working

---

# Slide 7: Database Design

## Database Per Service Pattern

```
User Service     --> user_db (users, roles)
Product Service  --> product_db (products, categories)
Order Service    --> order_db (orders, order_items)
Inventory Service --> inventory_db (inventory, reservations)
Payment Service  --> payment_db (payments, transactions)
```

**Why Separate Databases?**
- Service independence (can deploy/scale separately)
- Data isolation (security)
- Different optimization per service
- No shared schema dependencies

**Data Consistency:**
- Saga pattern for distributed transactions
- Event-driven updates between services
- Eventual consistency model

**Example Flow - Create Order:**
1. Order Service creates order (PENDING)
2. Calls Inventory Service to reserve stock
3. Calls Payment Service to process payment
4. If payment fails: release inventory (compensating transaction)
5. If all succeed: confirm order

---

# Slide 8: Event-Driven Architecture

## Asynchronous Communication

**Events Published:**
- `user.registered` - New user signed up
- `order.created` - New order placed
- `order.cancelled` - Order cancelled
- `inventory.low_stock` - Stock below threshold
- `payment.processed` - Payment completed

**Why Event-Driven?**
- Loose coupling between services
- Services don't need to know about each other
- Can add new consumers without changing publishers
- Async processing for better performance

**Implementation:**
- Event Bus service with Kafka
- Each service has event publisher
- 3-second timeout prevents hanging

**Real-World Example:**
When order is placed:
1. Order Service publishes `order.created`
2. Inventory Service reserves stock
3. Payment Service processes payment
4. Email Service (future) sends confirmation
- All happen independently, asynchronously

---

# Slide 9: Testing Strategy

## Comprehensive Test Coverage

**Unit Tests:**
- Jest testing framework
- Tests for all service methods
- Mocking external dependencies
- 80%+ coverage target

**Test Categories:**
```
services/user-service/tests/
  - user.service.test.ts (registration, login, 2FA)
  - auth.test.ts (JWT, password hashing)

services/product-service/tests/
  - product.service.test.ts (CRUD, search)

services/order-service/tests/
  - order.service.test.ts (create, cancel)
```

**What We Test:**
- Happy paths (normal operation)
- Error scenarios (invalid input, not found)
- Edge cases (empty data, duplicates)
- Authentication/Authorization

**Why Jest?**
- Fast parallel execution
- Built-in mocking
- TypeScript support
- Good IDE integration

---

# Slide 10: AWS Deployment

## Cloud Infrastructure

**Services Used:**
| AWS Service | Purpose | Why? |
|-------------|---------|------|
| EC2 (t3.micro) | Compute | Runs Docker containers, free tier |
| RDS (PostgreSQL) | Database | Managed DB, backups, free tier |
| ECR | Container Registry | Store Docker images |
| VPC | Networking | Isolated network |

**Deployment Architecture:**
```
EC2 Instance (t3.micro)
  |
  +-- Docker Compose
       |
       +-- API Gateway (port 8080)
       +-- Frontend (port 3000)
       +-- User Service (port 3001)
       +-- Product Service (port 3002)
       +-- Order Service (port 3003)
       +-- Inventory Service (port 3004)
       +-- Payment Service (port 3005)
       +-- Event Bus (port 4000)
       +-- Redis (port 6379)
```

**Why EC2 + Docker Compose?**
- Simple, cost-effective for demo
- Full control over environment
- Easy to debug
- Kubernetes ready for production scale

---

# Slide 11: Live Demo & Summary

## What Can Be Demonstrated

**User Flow:**
1. Register new user (GDPR consent)
2. Login with JWT token
3. Browse products
4. Add to cart
5. Place order
6. View order history

**Admin Flow:**
1. Login as admin
2. Create products
3. Manage inventory
4. View all orders

**Technical Demo:**
- Health checks: `curl /health`
- API calls: Register, Login, Create Product
- Logs: `docker logs <service>`
- Database: 5 separate databases on RDS

## Summary: Requirements Addressed

| Requirement | Status |
|-------------|--------|
| Microservices Architecture | 5 services |
| API Gateway | Express proxy |
| Database per Service | 5 PostgreSQL DBs |
| Event-Driven | Kafka events |
| Security (JWT, RBAC) | Implemented |
| Fault Tolerance | Circuit breakers |
| Scalability | HPA configs |
| Testing | Unit + Integration |
| Cloud Deployment | AWS EC2/RDS |
| Documentation | Comprehensive |

**All requirements addressed with working, deployed code.**

---

# Thank You

## CloudRetail - E-Commerce Microservices Platform

**Resources:**
- Frontend: http://3.1.27.41:3000
- API Gateway: http://3.1.27.41:8080
- Health Check: http://3.1.27.41:8080/health

**Repository Structure:**
```
cloudretail/
  api-gateway/        # API Gateway service
  services/           # 5 microservices
  frontend/           # Web interface
  shared/             # Shared libraries
  docs/               # Architecture docs
  infrastructure/     # Kubernetes configs
```

**Questions?**
