# CloudRetail - E-Commerce Microservices Platform

An e-commerce platform built with microservices architecture for the COMP60010 Cloud Computing module.

## Prerequisites

Before you start, make sure you have these installed:
- Node.js (v18 or higher)
- Docker and Docker Compose
- Git

## Quick Start (Local Development)

### 1. Clone and install dependencies

```bash
cd cloudretail
npm install
```

### 2. Start all services with Docker

```bash
docker-compose up -d
```

This will spin up:
- PostgreSQL database
- Redis cache
- Kafka + Zookeeper (message broker)
- All 5 microservices
- API Gateway
- Frontend

### 3. Check if everything is running

```bash
docker-compose ps
```

All containers should show as "running" or "healthy".

### 4. Access the application

- Frontend: http://localhost:8080
- API Gateway: http://localhost:3000
- Health check: http://localhost:3000/health

## Project Structure

```
cloudretail/
├── api-gateway/          # Routes requests to microservices
├── services/
│   ├── user-service/     # Auth, registration, user management
│   ├── product-service/  # Product catalog
│   ├── order-service/    # Order processing
│   ├── inventory-service/# Stock management
│   └── payment-service/  # Payment processing
├── event-bus/            # Event publishing service
├── frontend/             # Web UI
├── shared/               # Shared libs (middleware, models)
└── docker-compose.yml
```

## Services Overview

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Entry point, routes to services |
| User Service | 3001 | Handles auth and user accounts |
| Product Service | 3002 | Product CRUD operations |
| Order Service | 3003 | Order management |
| Inventory Service | 3004 | Stock tracking |
| Payment Service | 3005 | Payment processing |
| Frontend | 8080 | Web interface |

## Testing the API

### Register a user
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe",
    "gdprConsent": true
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

Save the token from the response - you'll need it for other requests.

### Get products
```bash
curl http://localhost:3000/api/products
```

### Create a product (need vendor or admin role)
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Product",
    "description": "A test product",
    "price": 29.99,
    "category": "electronics"
  }'
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific service
npm test --workspace=user-service
```

## Stopping the Application

```bash
docker-compose down
```

To also remove the data volumes:
```bash
docker-compose down -v
```

## Troubleshooting

**Services not starting?**
- Check if ports 3000-3005 and 8080 are free
- Try `docker-compose down -v` then `docker-compose up -d`

**Database connection errors?**
- Wait a bit longer for postgres to be ready
- Check logs with `docker-compose logs postgres`

**Can't login?**
- Make sure you registered first
- Check the user-service logs: `docker-compose logs user-service`

## Architecture Notes

The system uses:
- **Database per service** pattern - each service has its own PostgreSQL database
- **API Gateway** pattern - single entry point for all client requests
- **Event-driven communication** - services publish events for async operations
- **JWT authentication** - stateless auth with role-based access control

For more details, check the docs folder:
- `docs/SCALABILITY.md` - how the system scales
- `docs/SECURITY.md` - security measures implemented
- `docs/FAULT-TOLERANCE.md` - how the system handles failures


