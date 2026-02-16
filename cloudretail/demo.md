# CloudRetail Live Demo Guide

Complete step-by-step guide for demonstrating the CloudRetail e-commerce platform during your viva/presentation.

---

## Pre-Demo Checklist (5 minutes before)

### 1. Verify EC2 is Running
```bash
# From your Mac terminal
ssh -i ~/.ssh/cloudretail-key.pem ec2-user@3.1.27.41

# Once connected, check services
docker-compose ps

# All services should show "healthy" or "running"
```

### 2. Verify Health
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy",...}
```

### 3. Open Required Tabs in Browser
- Tab 1: Frontend - http://3.1.27.41:3000
- Tab 2: AWS Console - https://console.aws.amazon.com/
- Tab 3: Terminal for API calls

### 4. Prepare Demo Data
```bash
# Have these values ready (or create fresh ones during demo)
EMAIL="demo@cloudretail.com"
PASSWORD="Demo123!"
```

---

## Demo Flow (30-40 minutes)

### Part 1: Architecture Overview (5 minutes)

**Talk Through:**
"CloudRetail is a cloud-native e-commerce platform built with microservices architecture. Let me show you the architecture first."

**Show in Terminal:**
```bash
# Show the directory structure
cd ~/cloudretail
tree -L 2 -d

# Output will show:
# - api-gateway/
# - services/ (5 microservices)
# - frontend/
# - shared/ (common libraries)
```

**Explain:**
- "We have 5 independent microservices: User, Product, Order, Inventory, Payment"
- "Each service has its own database - following the database per service pattern"
- "All requests go through the API Gateway on port 8080"
- "Frontend is served on port 3000"

---

### Part 2: AWS Infrastructure (10 minutes)

**Navigate to AWS Console in Browser**

#### 2.1 Show EC2 Instance
```
Services → EC2 → Instances
```
**Point Out:**
- Instance ID: `i-0451aa652467be974`
- Instance Type: `t3.micro` (free tier)
- Region: `ap-southeast-1` (Singapore)
- Public IP: `3.1.27.41`
- State: Running

**Explain:**
"This EC2 instance runs all our Docker containers. We chose t3.micro for cost-effectiveness while having enough resources for our microservices."

#### 2.2 Show RDS (Databases)
```
Services → RDS → Databases
```
**Point Out:**
- 5 PostgreSQL databases (one per service)
- Database names: `user_db`, `product_db`, `order_db`, `inventory_db`, `payment_db`
- Free tier eligible

**Explain:**
"Each microservice has its own database for data isolation. This allows independent scaling and prevents tight coupling between services."

**Show in Terminal:**
```bash
# Show database connections in docker-compose
cat docker-compose.yml | grep -A 3 "DB_NAME"
```

#### 2.3 Show ECR (Container Registry)
```
Services → ECR → Repositories
```
**Point Out:**
- Repositories for each service
- Latest images with timestamps
- Image URIs

**Explain:**
"We build Docker images locally or in CI/CD, push them to ECR, then pull them on EC2 for deployment."

**Show in Terminal:**
```bash
# Show images being used
docker images | grep cloudretail
```

#### 2.4 Show VPC & Security Groups
```
Services → VPC → Security Groups
```
**Point Out:**
- Security group allowing ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Frontend), 8080 (API)
- RDS security group restricting database access to EC2 only

**Explain:**
"Network security through security groups. Databases are not publicly accessible - only EC2 can connect."

---

### Part 3: Live API Demonstration (10 minutes)

**Switch to Terminal**

#### 3.1 User Registration
```bash
# Register a new user
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!",
    "firstName": "Demo",
    "lastName": "User",
    "role": "admin",
    "gdprConsent": true
  }' | jq
```

**Explain While Running:**
- "Request goes to API Gateway on port 8080"
- "Gateway proxies to User Service on port 3001"
- "Password is hashed with bcrypt (12 rounds)"
- "GDPR consent is required and stored"
- "JWT token is returned for authentication"

**Point Out in Response:**
- `"success": true`
- `"token": "eyJ..."` (JWT token)
- User object with hashed password

#### 3.2 User Login
```bash
# Login to get JWT token
RESPONSE=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!"
  }')

# Extract token
TOKEN=$(echo $RESPONSE | jq -r '.data.token')

# Show the token
echo "JWT Token: $TOKEN"
```

**Explain:**
- "Stateless authentication using JWT"
- "Token contains user ID and role"
- "No session storage needed - makes horizontal scaling easier"

#### 3.3 Create Products (Authenticated)
```bash
# Product 1
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Gaming Laptop Pro",
    "description": "High-performance gaming laptop with RTX 4080",
    "price": 1999.99,
    "category": "electronics",
    "sku": "LAPTOP-001"
  }' | jq

# Product 2
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Wireless Mouse",
    "description": "Ergonomic wireless mouse with RGB",
    "price": 49.99,
    "category": "electronics",
    "sku": "MOUSE-001"
  }' | jq
```

**Explain:**
- "Authorization header with Bearer token"
- "JWT is verified by middleware"
- "Role-based access control - only admin/vendor can create products"
- "Request goes to Product Service on port 3002"

#### 3.4 List Products (Public)
```bash
curl http://localhost:8080/api/products | jq
```

**Explain:**
- "Public endpoint - no authentication needed"
- "Returns all products from product_db"
- "Notice the pagination support in the API"

#### 3.5 Add Inventory
```bash
# Get the first product ID from the list above
PRODUCT_ID=$(curl -s http://localhost:8080/api/products | jq -r '.data[0].id')

# Add inventory
curl -X POST http://localhost:8080/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 100,
    \"warehouseLocation\": \"Warehouse A - Singapore\"
  }" | jq
```

**Explain:**
- "Inventory Service manages stock levels"
- "Separate from Product Service - different database"
- "Supports reserved quantity for pending orders"

#### 3.6 View Logs (Show Microservices in Action)
```bash
# Show API Gateway logs
docker logs ec2-user-api-gateway-1 --tail 20

# Show Product Service logs
docker logs ec2-user-product-service-1 --tail 20
```

**Explain:**
- "Notice the request flow: Gateway → Service"
- "Each service has its own logs"
- "Correlation IDs track requests across services"

---

### Part 4: Frontend Demonstration (5 minutes)

**Switch to Browser - Frontend Tab**

#### 4.1 Login
1. Open http://3.1.27.41:3000
2. Click "Login"
3. Enter credentials: `demo@cloudretail.com` / `Demo123!`
4. Login successful

**Explain:**
- "Single Page Application (SPA)"
- "Frontend calls API Gateway"
- "JWT stored in localStorage"

#### 4.2 Browse Products
1. Products appear on home page
2. Show the products we just created via API

**Explain:**
- "Data fetched from Product Service via API Gateway"
- "Real-time - shows what we just created"

#### 4.3 Admin Panel
1. Navigate to "Admin" section
2. Show product creation form

**Explain:**
- "Role-based UI - admin sees this panel"
- "Can create products directly from UI"

---

### Part 5: Scalability & Fault Tolerance (5 minutes)

#### 5.1 Show Circuit Breaker
```bash
# Show circuit breaker configuration
cat api-gateway/src/services/service-registry.ts | grep -A 5 "circuit"
```

**Explain:**
- "Using Opossum library for circuit breakers"
- "Opens after 5 failures, prevents cascading failures"
- "30-second timeout for recovery"

#### 5.2 Show Health Checks
```bash
# API Gateway health
curl http://localhost:8080/health | jq

# Show Docker health checks
docker-compose ps
```

**Explain:**
- "Every service has health endpoint"
- "Docker automatically restarts unhealthy containers"
- "Monitoring system health in real-time"

#### 5.3 Demonstrate Graceful Degradation
```bash
# Stop the event bus
docker-compose stop event-bus

# Create a product - should still work
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Product",
    "description": "Testing fault tolerance",
    "price": 99.99,
    "category": "electronics",
    "sku": "TEST-001"
  }' | jq

# Restart event bus
docker-compose start event-bus
```

**Explain:**
- "Event bus down, but core functionality continues"
- "3-second timeout on event publishing"
- "System degrades gracefully, doesn't crash"

#### 5.4 Show Database Per Service
```bash
# Show database connections
docker-compose exec user-service env | grep DB_NAME
docker-compose exec product-service env | grep DB_NAME
docker-compose exec order-service env | grep DB_NAME
```

**Explain:**
- "Each service connects to different database"
- "Data isolation and independence"
- "Can scale databases independently"

---

### Part 6: Security Features (3 minutes)

#### 6.1 Show Password Hashing
```bash
# Show user in database (connect to user-service container)
docker-compose exec user-service node -e "
const bcrypt = require('bcrypt');
console.log('Original password: Demo123!');
console.log('Hashed in DB: (bcrypt hash - cannot be reversed)');
console.log('Verify works:', bcrypt.compareSync('Demo123!', 'hashed_password_from_db'));
"
```

**Explain:**
- "Passwords hashed with bcrypt (12 rounds)"
- "One-way hash - cannot be decrypted"
- "Even database admin can't see passwords"

#### 6.2 Show JWT Token
```bash
# Decode JWT (without verifying)
echo $TOKEN | cut -d. -f2 | base64 -d | jq
```

**Explain:**
- "JWT contains user ID, role, expiration"
- "Signed with secret key"
- "Tamper-proof - any modification invalidates signature"

#### 6.3 Show Rate Limiting
```bash
# Try to hit endpoint rapidly
for i in {1..10}; do
  curl -s http://localhost:8080/api/products | jq -r '.data | length'
  sleep 0.1
done
```

**Explain:**
- "Rate limiting prevents abuse"
- "100 requests/minute for standard endpoints"
- "20 requests/minute for sensitive operations"

---

### Part 7: Testing & Code Quality (2 minutes)

**Show in Terminal:**
```bash
# Show test files
find services/product-service/tests -name "*.test.ts"

# Show TypeScript configuration
cat services/product-service/tsconfig.json | grep strict
```

**Explain:**
- "Full TypeScript implementation with strict mode"
- "Jest for unit and integration testing"
- "Test coverage tracking"
- "Type safety prevents runtime errors"

---

## Key Points to Emphasize

### Architecture
- **Microservices**: 5 independent services, each scalable
- **API Gateway**: Single entry point for all clients
- **Event-Driven**: Async communication via Kafka
- **Database per Service**: Data isolation and independence

### AWS Implementation
- **EC2**: Hosts Docker containers
- **RDS**: Managed PostgreSQL databases (5 separate DBs)
- **ECR**: Container image registry
- **VPC & Security Groups**: Network isolation and security

### Scalability
- **Stateless Design**: JWT auth, no session storage
- **Horizontal Scaling**: Can add more instances
- **Connection Pooling**: Efficient database usage
- **Kubernetes Ready**: HPA configs for auto-scaling

### Security
- **Authentication**: JWT tokens
- **Authorization**: Role-based access control
- **Password Security**: Bcrypt hashing
- **Network Security**: Security groups, VPC
- **Input Validation**: Joi schemas
- **GDPR Compliance**: Consent required, delete capability

### Fault Tolerance
- **Circuit Breakers**: Prevent cascading failures
- **Health Checks**: Monitor service health
- **Graceful Degradation**: Non-critical features fail silently
- **Transactions**: Database consistency

---

## Troubleshooting During Demo

### If EC2 is Unreachable
```bash
# Reboot instance
aws ec2 reboot-instances --instance-ids i-0451aa652467be974 --region ap-southeast-1

# Wait 2 minutes, then reconnect
ssh -i ~/.ssh/cloudretail-key.pem ec2-user@3.1.27.41
```

### If Services are Down
```bash
# Check status
docker-compose ps

# Restart all
docker-compose up -d

# Check logs
docker-compose logs --tail 50
```

### If Frontend Won't Load
```bash
# Restart frontend
docker-compose restart frontend

# Check if port is accessible
curl http://localhost:3000
```

### If API Returns 404
```bash
# Check API Gateway logs
docker logs ec2-user-api-gateway-1 --tail 30

# Verify route registration
docker logs ec2-user-api-gateway-1 | grep "Proxy created"
```

### If Database Connection Fails
```bash
# Restart service
docker-compose restart <service-name>

# Check environment variables
docker-compose exec <service-name> env | grep DB_
```

---

## Backup Demo Data

If you need to quickly create demo data:

```bash
#!/bin/bash
# Quick demo setup script

# Login as admin
TOKEN=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cloudretail.com","password":"Demo123!"}' \
  | jq -r '.data.token')

# Create 3 products
curl -s -X POST http://localhost:8080/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop","description":"High-end laptop","price":1299.99,"category":"electronics","sku":"LAP-001"}'

curl -s -X POST http://localhost:8080/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mouse","description":"Wireless mouse","price":29.99,"category":"electronics","sku":"MOU-001"}'

curl -s -X POST http://localhost:8080/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","description":"Mechanical keyboard","price":99.99,"category":"electronics","sku":"KEY-001"}'

echo "Demo data created!"
```

---

## Questions to Prepare For

### Architecture Questions
**Q: Why microservices instead of monolith?**
A: Independent scaling, fault isolation, technology flexibility, easier maintenance

**Q: How do services communicate?**
A: REST APIs for synchronous, Kafka events for asynchronous

**Q: What happens if one service fails?**
A: Circuit breakers isolate failures, other services continue operating

### AWS Questions
**Q: Why AWS over other clouds?**
A: Industry leader, extensive free tier, familiar services, good documentation

**Q: How do you handle database scaling?**
A: Connection pooling, read replicas, separate database per service

**Q: What's your disaster recovery plan?**
A: RDS automated backups, infrastructure as code for quick rebuild, health monitoring

### Security Questions
**Q: How do you prevent SQL injection?**
A: Sequelize ORM with parameterized queries, no raw SQL

**Q: How is authentication handled?**
A: JWT tokens with bcrypt password hashing, role-based access control

**Q: What about GDPR compliance?**
A: User consent required, data deletion endpoint, password hashing

### Scalability Questions
**Q: How would you scale this for 1 million users?**
A: Kubernetes with HPA, database read replicas, Redis caching, CDN for frontend

**Q: Is the system stateless?**
A: Yes - JWT tokens, no session storage, allows horizontal scaling

---

## Demo Checklist

- [ ] EC2 instance running
- [ ] All services healthy
- [ ] Frontend accessible
- [ ] AWS Console open
- [ ] Terminal ready with commands
- [ ] Demo user registered
- [ ] Browser tabs prepared
- [ ] Backup script ready

---

## Time Allocation

- Architecture Overview: 5 min
- AWS Infrastructure: 10 min
- Live API Demo: 10 min
- Frontend Demo: 5 min
- Scalability/Fault Tolerance: 5 min
- Security Features: 3 min
- Testing/Code Quality: 2 min
- **Total: ~40 minutes** (leaves 20 min for questions in 1-hour viva)

---

Good luck with your demo! 🚀
