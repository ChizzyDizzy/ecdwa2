# CloudRetail Startup Guide

Quick reference for recovering EC2, demonstrating the system, and running demos.

## EC2 Recovery

### If EC2 Disconnects or Becomes Unresponsive

**Step 1: Check instance status**
```bash
aws ec2 describe-instance-status --instance-ids i-0451aa652467be974 --region ap-southeast-1
```

**Step 2: Reboot if needed**
```bash
aws ec2 reboot-instances --instance-ids i-0451aa652467be974 --region ap-southeast-1
```

**Step 3: Wait 2-3 minutes, then SSH in**
```bash
ssh -i ~/.ssh/cloudretail-key.pem ec2-user@3.1.27.41
```

**Step 4: Verify services are running**
```bash
docker-compose ps
```

**Step 5: If services are down, start them**
```bash
# Login to ECR first
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 850874728684.dkr.ecr.ap-southeast-1.amazonaws.com

# Start all services
docker-compose up -d

# Check health
curl http://localhost:8080/health
```

---

## Demo Commands (Terminal)

### 1. Register an Admin User

```bash
# Register a new admin user
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cloudretail.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "gdprConsent": true
  }'
```

### 2. Login and Get JWT Token

```bash
# Login and capture the token
TOKEN=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cloudretail.com",
    "password": "Admin123!"
  }' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Verify token was captured
echo "JWT Token: $TOKEN"
```

### 3. Create Products (Using the JWT Token)

```bash
# Create Product 1 - Gaming Console
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Gaming Console X",
    "description": "Next-gen gaming console with 4K support",
    "price": 499.99,
    "category": "electronics",
    "sku": "GAME-001"
  }'

# Create Product 2 - Wireless Headphones
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Wireless Headphones Pro",
    "description": "Noise-cancelling bluetooth headphones",
    "price": 299.99,
    "category": "electronics",
    "sku": "AUDIO-001"
  }'

# Create Product 3 - Smart Watch
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Smart Watch Ultra",
    "description": "Fitness tracking smartwatch with GPS",
    "price": 399.99,
    "category": "electronics",
    "sku": "WATCH-001"
  }'
```

### 4. List All Products

```bash
# Get all products (no auth required for viewing)
curl http://localhost:8080/api/products | json_pp
```

### 5. Add Inventory for Products

```bash
# First, get product IDs from the list above, then add inventory
# Replace PRODUCT_ID with actual IDs from step 4

curl -X POST http://localhost:8080/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": "PRODUCT_ID_HERE",
    "quantity": 100,
    "warehouseLocation": "Warehouse A"
  }'
```

---

## Complete Demo Script

Run this entire script on EC2 for a full demo:

```bash
#!/bin/bash
set -e

API_URL="http://localhost:8080"

echo "=== CloudRetail Demo ==="
echo ""

# 1. Register Admin
echo "1. Registering admin user..."
curl -s -X POST $API_URL/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!",
    "firstName": "Demo",
    "lastName": "Admin",
    "role": "admin",
    "gdprConsent": true
  }' | head -c 100
echo ""
echo ""

# 2. Login
echo "2. Logging in..."
RESPONSE=$(curl -s -X POST $API_URL/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!"
  }')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token obtained: ${TOKEN:0:50}..."
echo ""

# 3. Create Products
echo "3. Creating products..."
curl -s -X POST $API_URL/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Laptop Pro","description":"High-performance laptop","price":1299.99,"category":"electronics","sku":"LAP-001"}' | head -c 100
echo ""

curl -s -X POST $API_URL/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Mechanical Keyboard","description":"RGB mechanical keyboard","price":149.99,"category":"electronics","sku":"KEY-001"}' | head -c 100
echo ""
echo ""

# 4. List Products
echo "4. Listing all products..."
curl -s $API_URL/api/products
echo ""
echo ""

echo "=== Demo Complete ==="
echo "Visit http://3.1.27.41:3000 to see products in the frontend"
```

---

## View on Frontend

1. Open browser: **http://3.1.27.41:3000**
2. Login with the credentials you created
3. Products will appear on the home page
4. Use Admin panel to add more products

---

## Quick Health Check

```bash
# Check all services
curl http://localhost:8080/health

# Check individual services (from inside docker network)
docker exec ec2-user-api-gateway-1 wget -qO- http://product-service:3002/health
docker exec ec2-user-api-gateway-1 wget -qO- http://user-service:3001/health
docker exec ec2-user-api-gateway-1 wget -qO- http://order-service:3003/health
```

---

## Troubleshooting

### Services not starting?
```bash
docker-compose logs --tail 20
```

### Database connection issues?
```bash
docker-compose restart redis
docker-compose up -d
```

### 404 errors on API?
```bash
# Check API Gateway logs
docker logs ec2-user-api-gateway-1 --tail 30

# Verify routes are registered
docker logs ec2-user-api-gateway-1 | grep "Proxy created"
```

### ECR authentication expired?
```bash
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 850874728684.dkr.ecr.ap-southeast-1.amazonaws.com
```
