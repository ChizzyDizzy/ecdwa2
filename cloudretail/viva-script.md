# CloudRetail Viva Demo Script

This document contains terminal commands to demonstrate the microservices architecture, JWT authentication, and core functionality.

## Prerequisites

Replace `API_BASE` with your actual API endpoint:
```bash
# For EC2 deployment
API_BASE="http://3.1.27.41:8080"

# For local development
# API_BASE="http://localhost:8080"
```

---

## 1. Health Check - Verify All Services Running

```bash
curl -s $API_BASE/health | jq
```

Expected output shows all services healthy:
```json
{
  "status": "healthy",
  "checks": { "services": true }
}
```

---

## 2. View Available Services

```bash
curl -s $API_BASE/api | jq
```

---

## 3. User Registration - Create New User

```bash
curl -s -X POST $API_BASE/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!@#",
    "firstName": "Demo",
    "lastName": "User"
  }' | jq
```

Expected: Returns user data with `id`, `email`, `firstName`, `lastName`, `role`.

---

## 4. User Login - Get JWT Token

```bash
curl -s -X POST $API_BASE/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@cloudretail.com",
    "password": "Demo123!@#"
  }' | jq
```

**Save the token for later use:**
```bash
# Copy the token from the response and set it:
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Or extract it automatically:
TOKEN=$(curl -s -X POST $API_BASE/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@cloudretail.com", "password": "Demo123!@#"}' \
  | jq -r '.data.token')

echo "JWT Token: $TOKEN"
```

---

## 5. Decode JWT Token (Show Token Contents)

```bash
# Decode the JWT payload (middle part) - shows user ID, role, expiry
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq
```

Expected output:
```json
{
  "userId": "uuid-here",
  "email": "demo@cloudretail.com",
  "role": "customer",
  "iat": 1708012345,
  "exp": 1708098745
}
```

---

## 6. Get User Profile (Authenticated Request)

```bash
curl -s $API_BASE/api/users/profile \
  -H "Authorization: Bearer $TOKEN" | jq
```

This demonstrates that the JWT token authenticates the user across services.

---

## 7. List Products (Public Endpoint)

```bash
curl -s $API_BASE/api/products | jq
```

---

## 8. Get Single Product

```bash
# Replace with actual product ID from step 7
PRODUCT_ID="your-product-uuid-here"

curl -s $API_BASE/api/products/$PRODUCT_ID | jq
```

---

## 9. Check Inventory for Product

```bash
curl -s $API_BASE/api/inventory/product/$PRODUCT_ID | jq
```

---

## 10. Place an Order (Authenticated)

```bash
curl -s -X POST $API_BASE/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {
        "productId": "'$PRODUCT_ID'",
        "productName": "Demo Product",
        "quantity": 1,
        "price": 99.99
      }
    ],
    "shippingAddress": {
      "street": "123 Demo Street",
      "city": "Singapore",
      "state": "SG",
      "zipCode": "123456",
      "country": "Singapore"
    }
  }' | jq
```

This triggers:
1. Order Service creates order
2. Inventory Service reserves stock
3. Payment Service processes payment
4. Event Bus publishes events to Kafka

---

## 11. Get User's Orders

```bash
curl -s $API_BASE/api/orders \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 12. Get Specific Order Details

```bash
ORDER_ID="your-order-uuid-here"

curl -s $API_BASE/api/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 13. View All Inventory (Admin/Vendor)

```bash
curl -s $API_BASE/api/inventory \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Full Demo Flow Script

Run this complete script for a full demonstration:

```bash
#!/bin/bash
set -e

API_BASE="http://3.1.27.41:8080"
RANDOM_EMAIL="demo$(date +%s)@cloudretail.com"

echo "=== CloudRetail Microservices Demo ==="
echo ""

echo "1. Checking service health..."
curl -s $API_BASE/health | jq

echo ""
echo "2. Registering new user: $RANDOM_EMAIL"
curl -s -X POST $API_BASE/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$RANDOM_EMAIL'",
    "password": "Demo123!@#",
    "firstName": "Demo",
    "lastName": "User"
  }' | jq

echo ""
echo "3. Logging in and getting JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST $API_BASE/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "'$RANDOM_EMAIL'", "password": "Demo123!@#"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
echo "Token received: ${TOKEN:0:50}..."

echo ""
echo "4. Decoding JWT token payload..."
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq

echo ""
echo "5. Getting user profile with token..."
curl -s $API_BASE/api/users/profile \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "6. Listing products..."
PRODUCTS=$(curl -s $API_BASE/api/products)
echo $PRODUCTS | jq '.data.products[:2]'

PRODUCT_ID=$(echo $PRODUCTS | jq -r '.data.products[0].id')
echo ""
echo "7. Checking inventory for product: $PRODUCT_ID"
curl -s $API_BASE/api/inventory/product/$PRODUCT_ID | jq

echo ""
echo "8. Placing order..."
curl -s -X POST $API_BASE/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [{
      "productId": "'$PRODUCT_ID'",
      "productName": "Demo Product",
      "quantity": 1,
      "price": 99.99
    }],
    "shippingAddress": {
      "street": "123 Demo Street",
      "city": "Singapore",
      "state": "SG",
      "zipCode": "123456",
      "country": "Singapore"
    }
  }' | jq

echo ""
echo "9. Getting user orders..."
curl -s $API_BASE/api/orders \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "=== Demo Complete ==="
```

---

## Troubleshooting

### 401 Unauthorized
- Token expired or invalid
- JWT_SECRET mismatch between services
- Token not included in Authorization header

### 400 Bad Request
- Check request body format
- Verify required fields are present

### 503 Service Unavailable
- Service container not running
- Check: `docker ps` on EC2
- View logs: `docker logs <container-name>`

---

## Useful Docker Commands (EC2)

```bash
# View all running containers
docker ps

# View logs for a service
docker logs ec2-user-order-service-1 --tail=50

# Restart a service
docker restart ec2-user-order-service-1

# Check JWT_SECRET consistency
docker inspect ec2-user-user-service-1 | grep JWT_SECRET
docker inspect ec2-user-order-service-1 | grep JWT_SECRET
```

---

## Running Tests

```bash
cd cloudretail

# Install dependencies first
npm install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration
```
