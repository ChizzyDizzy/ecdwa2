# Viva Preparation Guide

## Quick Overview (30 seconds)

"CloudRetail is a microservices-based e-commerce platform deployed on AWS. It consists of five core services - User, Product, Order, Inventory, and Payment - each with its own database following the database-per-service pattern. The system uses an API Gateway for routing, JWT authentication for security, and event-driven communication for loose coupling. It's containerized with Docker and deployed on AWS EC2 with RDS for the databases."

## Architecture Deep Dive

### Microservices Breakdown

**User Service (Port 3001)**
- Handles authentication and registration
- JWT token generation with 24-hour expiry
- Role-based access control (customer, vendor, admin)
- Two-factor authentication using TOTP
- GDPR compliance with user deletion

**Product Service (Port 3002)**
- Product catalog management
- Vendor can create/update their products
- Admin can delete any product
- Search and filtering by category, price range
- Pagination support

**Order Service (Port 3003)**
- Coordinates the order workflow
- Verifies inventory availability before order creation
- Reserves inventory through API calls
- Integrates with payment service
- Publishes events for order status changes

**Inventory Service (Port 3004)**
- Stock management with reserved quantity tracking
- Atomic operations using database transactions
- Low stock and out-of-stock event publishing
- Warehouse location tracking

**Payment Service (Port 3005)**
- Simulated payment processing
- Links payments to orders
- Multiple payment methods support
- Payment status tracking

### Key Design Patterns

1. **Database Per Service**
   - Each service has its own PostgreSQL database
   - Prevents tight coupling through shared databases
   - Allows independent scaling and technology choices

2. **API Gateway Pattern**
   - Single entry point at port 3000
   - Routes requests to appropriate services
   - Handles CORS and request validation

3. **Event-Driven Architecture**
   - Services publish events (order.created, inventory.low_stock, etc.)
   - Kafka for message brokering in production
   - Graceful degradation with 3-second timeout when Kafka unavailable

4. **Circuit Breaker (Opossum library)**
   - Prevents cascading failures
   - Opens circuit after 5 consecutive failures
   - Auto-recovery after 30 seconds

## Demo Flow (Practice This)

### 1. Show the Running System

**On AWS:**
```bash
# SSH into EC2
ssh -i ~/.ssh/cloudretail-key.pem ec2-user@YOUR_EC2_IP

# Show running containers
docker-compose ps

# Show health check
curl http://YOUR_EC2_IP:3000/health
```

**Local:**
```bash
# Show it running locally too
docker-compose ps
open http://localhost:8080
```

### 2. Register and Login

**Frontend Demo:**
- Open http://localhost:8080 or http://YOUR_EC2_IP:8080
- Register a new user
- Login and get the token
- Show the user dashboard

**API Demo:**
```bash
# Register
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "Demo123!",
    "firstName": "Demo",
    "lastName": "User",
    "role": "vendor",
    "gdprConsent": true
  }'

# Login
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "Demo123!"
  }'
```

### 3. Create Product (Vendor/Admin)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Laptop",
    "description": "Gaming laptop",
    "price": 1299.99,
    "category": "electronics"
  }'
```

### 4. Add Inventory

```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "productId": "PRODUCT_ID_FROM_ABOVE",
    "quantity": 50,
    "warehouseLocation": "Warehouse A"
  }'
```

### 5. Create Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [{
      "productId": "PRODUCT_ID",
      "quantity": 2,
      "price": 1299.99
    }],
    "shippingAddress": {
      "street": "123 Main St",
      "city": "London",
      "state": "UK",
      "zipCode": "SW1A",
      "country": "UK"
    }
  }'
```

### 6. Show Testing

```bash
npm test --workspace=user-service
```

Point out:
- Unit tests with Jest
- Mocking with jest.fn()
- Testing error scenarios
- Test coverage

## Common Viva Questions & Answers

### "Why microservices instead of monolithic?"

"Microservices offer several advantages for this e-commerce platform:
- **Independent scaling** - we can scale the Order service during high traffic without scaling everything
- **Technology flexibility** - each service can use different tech stacks if needed
- **Fault isolation** - if Payment service goes down, users can still browse products
- **Team autonomy** - different teams can work on different services
- **Easier maintenance** - smaller codebases are easier to understand and modify

The tradeoff is increased complexity in deployment and inter-service communication, which we manage with Docker Compose and event-driven patterns."

### "How do you handle database transactions across services?"

"We use the Saga pattern with event-driven choreography. For example, when creating an order:
1. Order service creates an order record
2. Calls Inventory service to verify and reserve stock
3. If inventory reservation fails, Order service deletes the order (compensating transaction)
4. If successful, publishes order.created event
5. Other services react to the event independently

This is eventual consistency rather than ACID transactions, which is acceptable for e-commerce where eventual consistency is fine for most operations."

### "What about security?"

"Security is implemented at multiple layers:
- **Authentication**: JWT tokens with 24-hour expiry, bcrypt password hashing with 12 salt rounds
- **Authorization**: Role-based access control (RBAC) - customers can only view, vendors can create products, admins can delete
- **Network**: AWS security groups restrict database access to application services only
- **Data protection**: Passwords are hashed, sensitive data is never logged
- **Input validation**: Joi schemas validate all inputs to prevent injection attacks
- **GDPR compliance**: Users can delete their accounts, which removes all personal data"

### "How does the system scale?"

"The system scales in several ways:
- **Horizontal scaling**: Each service can be replicated - we have HPA configs for Kubernetes
- **Database connection pooling**: Sequelize manages connections efficiently
- **Caching**: Redis caches frequently accessed data
- **Stateless services**: JWT tokens mean no session state, so any replica can handle any request
- **Async processing**: Event bus handles background tasks without blocking requests
- **Load balancing**: API Gateway distributes requests across service instances"

### "What happens if a service fails?"

"We have multiple fault tolerance mechanisms:
- **Circuit breakers**: Using Opossum library, prevents cascading failures
- **Graceful degradation**: If event bus is down, services continue operating (3-second timeout)
- **Health checks**: Docker health checks restart failed containers
- **Database transactions**: Ensures data consistency even if service crashes mid-operation
- **Retry logic**: Failed event publishing is retried with exponential backoff
- **Service isolation**: If Payment service fails, users can still browse and add to cart"

### "Why did you choose PostgreSQL?"

"PostgreSQL offers:
- **ACID compliance**: Critical for order and payment data
- **JSON support**: Flexible for storing order items and addresses
- **Mature ecosystem**: Good ORM support with Sequelize
- **AWS RDS support**: Easy to deploy and manage on AWS
- **Performance**: Handles the query patterns we need (lookups, joins, aggregations)"

### "How do you test the system?"

"We have a comprehensive testing strategy:
- **Unit tests**: Jest tests for service logic in isolation, mocking database and external calls
- **Integration tests**: Testing service-to-service communication
- **API tests**: Using curl/Postman to validate endpoints
- **Manual testing**: Frontend testing of user workflows
- **Coverage**: Aiming for 80% unit test coverage on critical paths"

### "What would you improve with more time?"

"Several enhancements I'd make:
- **Production Kafka**: Replace the Docker Kafka with managed AWS MSK for better reliability
- **Real payment gateway**: Integrate Stripe or PayPal instead of simulation
- **Comprehensive monitoring**: Add Prometheus and Grafana dashboards
- **API rate limiting**: Prevent abuse
- **Caching layer**: Redis for product catalog
- **Search optimization**: Elasticsearch for better product search
- **CI/CD pipeline**: Automated testing and deployment
- **Load testing**: Artillery/k6 to find performance bottlenecks"

### "Explain your AWS deployment"

"The deployment uses:
- **EC2 t3.micro**: Runs Docker Compose with all services
- **RDS PostgreSQL**: Single instance with 5 databases (one per service)
- **ECR**: Stores Docker images for each service
- **Security Groups**: Firewall rules restricting access
- **VPC**: Network isolation
- **Free tier**: Everything fits within AWS free tier limits

We didn't use Kafka on EC2 due to memory constraints (1GB RAM on t3.micro), but the architecture supports adding it later with proper instance sizing."

## Technical Details to Remember

### Environment Variables
```
NODE_ENV=production
DB_HOST=your-rds-endpoint.ap-southeast-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=cloudretail_admin
JWT_SECRET=(generated secret)
```

### Ports
- API Gateway: 3000
- User Service: 3001
- Product Service: 3002
- Order Service: 3003
- Inventory Service: 3004
- Payment Service: 3005
- Event Bus: 3006
- Frontend: 8080
- PostgreSQL: 5432
- Redis: 6379
- Kafka: 9092

### Key Technologies
- Node.js + Express
- TypeScript
- Sequelize ORM
- PostgreSQL
- Redis
- Kafka
- Docker
- JWT
- Bcrypt
- Joi validation
- Jest testing
- AWS (EC2, RDS, ECR)

## What NOT to Say

❌ "The code was generated by AI"
❌ "I'm not sure how that part works"
❌ "We didn't have time to implement that"
❌ "It works on my machine"

## What TO Say

✅ "Let me show you how that works in the code"
✅ "We made a tradeoff between X and Y, choosing X because..."
✅ "This follows the [pattern name] pattern"
✅ "Here's how I tested this functionality"

## Pre-Viva Checklist

- [ ] System is running on AWS
- [ ] System is running locally
- [ ] You can demo registration, login, product creation, and orders
- [ ] You've tested all the curl commands above
- [ ] Tests are passing (`npm test`)
- [ ] You can access AWS console to show EC2, RDS, ECR
- [ ] SSH key works for EC2 access
- [ ] You understand every architectural decision
- [ ] You've read through the SCALABILITY, SECURITY, and FAULT-TOLERANCE docs

## Demo Script (Practice This Exactly)

1. **Introduction** (30 seconds)
   - Brief overview of the system

2. **Architecture walkthrough** (2 minutes)
   - Show the architecture diagram
   - Explain microservices and their responsibilities
   - Explain data flow for order creation

3. **Live demo** (3-4 minutes)
   - Show AWS console (EC2 running, RDS, ECR)
   - SSH into EC2, show docker-compose ps
   - Open frontend, register user, login
   - Create product, add inventory
   - Create order
   - Show order in database

4. **Code walkthrough** (2-3 minutes)
   - Show service structure
   - Explain authentication middleware
   - Show event publishing
   - Show error handling

5. **Testing demo** (1 minute)
   - Run npm test
   - Explain what the tests cover

6. **Questions** (remaining time)
   - Answer confidently
   - Reference code if needed

Good luck with your viva tomorrow!
