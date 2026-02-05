# CloudRetail Platform - Setup Guide

**COMP60010: Enterprise Cloud and Distributed Web Applications**
**Region: ap-southeast-1 (Singapore)**

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Fresh Start - Clean Up Previous Attempts](#2-fresh-start---clean-up-previous-attempts)
3. [Local Development with Docker Compose](#3-local-development-with-docker-compose)
4. [Test the Local Setup](#4-test-the-local-setup)
5. [AWS Deployment - Single RDS Instance](#5-aws-deployment---single-rds-instance)
6. [AWS Deployment - ECR (Container Registry)](#6-aws-deployment---ecr-container-registry)
7. [AWS Deployment - EC2 Instance](#7-aws-deployment---ec2-instance)
8. [Verify AWS Deployment](#8-verify-aws-deployment)
9. [Clean Up AWS Resources](#9-clean-up-aws-resources)

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Check command |
|------|---------|---------------|
| Git | Any | `git --version` |
| Docker Desktop | 4.x+ | `docker --version` |
| Node.js | 20.x | `node --version` |
| npm | 9.x+ | `npm --version` |
| AWS CLI | 2.x | `aws --version` |

**psql is NOT required.** For the one step that needs it (creating databases on RDS), you can use Docker instead. See step 5.4.

**AWS CLI configuration** (run once):

```bash
aws configure
```

Enter:
- Access Key ID: (your key)
- Secret Access Key: (your secret)
- Default region: `ap-southeast-1`
- Output format: `json`

**Windows Git Bash users**: Passwords with `!` cause errors. All passwords in this guide avoid `!`.

---

## 2. Fresh Start - Clean Up Previous Attempts

If you have existing RDS instances from failed attempts, delete them first.

**List existing instances:**

```bash
aws rds describe-db-instances --region ap-southeast-1 --query "DBInstances[].DBInstanceIdentifier" --output text
```

**Delete any cloudretail instances** (repeat for each one found):

```bash
aws rds delete-db-instance --db-instance-identifier cloudretail-users-db --skip-final-snapshot --region ap-southeast-1

aws rds delete-db-instance --db-instance-identifier cloudretail-products-db --skip-final-snapshot --region ap-southeast-1
```

Wait for deletion to complete (check with):

```bash
aws rds describe-db-instances --region ap-southeast-1 --query "DBInstances[?starts_with(DBInstanceIdentifier,'cloudretail')].{ID:DBInstanceIdentifier,Status:DBInstanceStatus}" --output table
```

When no instances are returned, proceed.

**Delete old Docker volumes** (local cleanup):

```bash
cd cloudretail
docker compose down -v
```

---

## 3. Local Development with Docker Compose

The project uses a **single PostgreSQL instance** with 5 databases (mirrors the AWS free-tier setup).

**Build and start everything:**

```bash
cd cloudretail
docker compose up --build -d
```

This starts 10 containers:
- 1 PostgreSQL (with 5 databases created by `init-db.sql`)
- 1 Redis
- 1 Zookeeper + 1 Kafka
- 5 microservices (user, product, order, inventory, payment)
- 1 Event Bus
- 1 API Gateway (port 8080)
- 1 Frontend (port 3000)

**Check that all containers are running:**

```bash
docker compose ps
```

All services should show `Up` or `Up (healthy)`.

**Check API Gateway health:**

```bash
curl http://localhost:8080/health
```

Expected: `{"status":"healthy",...}`

**If services show "unhealthy"**: Wait 30-60 seconds for PostgreSQL to initialize all databases, then check again. Services auto-restart until the database is ready.

---

## 4. Test the Local Setup

All API routes go through the gateway on port 8080. The route structure is:

```
Gateway mount path  +  Router path  =  Full URL
/api/users          +  /register    =  /api/users/register
/api/products       +  /products    =  /api/products/products
/api/orders         +  /orders      =  /api/orders/orders
/api/inventory      +  /inventory   =  /api/inventory/inventory
/api/payments       +  /payments    =  /api/payments/payments
```

### 4.1 Register a user (admin role)

```bash
curl -s -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Admin\",\"lastName\":\"User\",\"email\":\"admin@cloudretail.com\",\"password\":\"Password123\",\"role\":\"admin\",\"gdprConsent\":true}"
```

Save the `token` from the response. Example:

```
export TOKEN="eyJhbG..."
```

**Windows Git Bash**: If `export` does not work, use:

```bash
TOKEN="eyJhbG..."
```

### 4.2 Login (if you need a fresh token)

```bash
curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@cloudretail.com\",\"password\":\"Password123\"}"
```

### 4.3 Create a product (requires admin/vendor token)

Replace `USER_ID` with the `id` field from the registration response in step 4.1:

```bash
curl -s -X POST http://localhost:8080/api/products/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Wireless Headset\",\"description\":\"7.1 surround sound headset\",\"price\":79.99,\"category\":\"electronics\",\"sku\":\"WGH-001\",\"vendorId\":\"USER_ID\"}"
```

**Tip**: To save the user ID from registration into a variable:

```bash
USER_ID="paste-your-user-id-here"
```

Then use it:

```bash
curl -s -X POST http://localhost:8080/api/products/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Wireless Headset\",\"description\":\"7.1 surround sound headset\",\"price\":79.99,\"category\":\"electronics\",\"sku\":\"WGH-001\",\"vendorId\":\"$USER_ID\"}"
```

### 4.4 List products (public)

```bash
curl -s http://localhost:8080/api/products/products
```

### 4.5 Add inventory for a product (requires admin/vendor token)

Replace `PRODUCT_ID` with the actual product ID from step 4.3:

```bash
curl -s -X POST http://localhost:8080/api/inventory/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"productId\":\"PRODUCT_ID\",\"quantity\":100,\"warehouseLocation\":\"SG-01\"}"
```

### 4.6 Place an order (requires any authenticated user token)

Replace `PRODUCT_ID` with the actual product ID from step 4.3:

```bash
curl -s -X POST http://localhost:8080/api/orders/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"productId\":\"PRODUCT_ID\",\"productName\":\"Wireless Headset\",\"quantity\":2,\"price\":79.99}],\"shippingAddress\":{\"street\":\"123 Cloud Street\",\"city\":\"Singapore\",\"state\":\"SG\",\"zipCode\":\"049712\",\"country\":\"Singapore\"}}"
```

### 4.7 List orders

```bash
curl -s http://localhost:8080/api/orders/orders \
  -H "Authorization: Bearer $TOKEN"
```

### 4.8 Open the frontend

Open `http://localhost:3000` in your browser. The frontend requires login - register or log in with the credentials from step 4.1.

---

## 5. AWS Deployment - Single RDS Instance

The free tier allows **1 RDS instance**. We create 1 instance and put all 5 databases on it.

### 5.1 Create a security group for RDS

```bash
# Get your default VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region ap-southeast-1)

echo "VPC ID: $VPC_ID"

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name cloudretail-db-sg \
  --description "CloudRetail RDS access" \
  --vpc-id $VPC_ID \
  --region ap-southeast-1 \
  --query "GroupId" --output text)

echo "Security Group ID: $SG_ID"

# Allow PostgreSQL access from anywhere (for development - restrict in production)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region ap-southeast-1
```

### 5.2 Create a single RDS instance

```bash
aws rds create-db-instance \
  --db-instance-identifier cloudretail-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username postgres \
  --master-user-password CloudRetail2026db \
  --allocated-storage 20 \
  --db-name cloudretail_users \
  --vpc-security-group-ids $SG_ID \
  --publicly-accessible \
  --no-multi-az \
  --region ap-southeast-1
```

**Wait for the instance to become available** (takes 5-10 minutes):

```bash
aws rds wait db-instance-available --db-instance-identifier cloudretail-db --region ap-southeast-1
echo "RDS instance is ready"
```

### 5.3 Get the RDS endpoint

```bash
RDS_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier cloudretail-db \
  --region ap-southeast-1 \
  --query "DBInstances[0].Endpoint.Address" --output text)

echo "RDS Host: $RDS_HOST"
```

### 5.4 Create the remaining 4 databases

Use Docker to run psql (no local install needed). Each `CREATE DATABASE` must run as a separate command (PostgreSQL does not allow `CREATE DATABASE` inside a transaction block):

```bash
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -d cloudretail_users -c "CREATE DATABASE cloudretail_products;"
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -d cloudretail_users -c "CREATE DATABASE cloudretail_orders;"
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -d cloudretail_users -c "CREATE DATABASE cloudretail_inventory;"
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -d cloudretail_users -c "CREATE DATABASE cloudretail_payments;"
```

**Verify all 5 databases exist:**

```bash
docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -d cloudretail_users -c "\l" | grep cloudretail
```

You should see 5 databases listed:
- cloudretail_users
- cloudretail_products
- cloudretail_orders
- cloudretail_inventory
- cloudretail_payments

---

## 6. AWS Deployment - ECR (Container Registry)

### 6.1 Create ECR repositories

```bash
for repo in user-service product-service order-service inventory-service payment-service api-gateway event-bus frontend; do
  aws ecr create-repository \
    --repository-name cloudretail/$repo \
    --region ap-southeast-1 \
    --image-scanning-configuration scanOnPush=true
done
```

### 6.2 Get your AWS account ID

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
echo "Account ID: $AWS_ACCOUNT_ID"
```

### 6.3 Log in to ECR

```bash
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com
```

### 6.4 Build and push all images

From the `cloudretail` directory:

```bash
cd cloudretail

# Build all service images
for service in user-service product-service order-service inventory-service payment-service; do
  docker build -t cloudretail/$service -f ./services/$service/Dockerfile .
  docker tag cloudretail/$service:latest $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/$service:latest
  docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/$service:latest
  echo "Pushed $service"
done

# Build and push API Gateway
docker build -t cloudretail/api-gateway -f ./api-gateway/Dockerfile .
docker tag cloudretail/api-gateway:latest $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/api-gateway:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/api-gateway:latest
echo "Pushed api-gateway"

# Build and push Event Bus
docker build -t cloudretail/event-bus -f ./event-bus/Dockerfile .
docker tag cloudretail/event-bus:latest $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/event-bus:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/event-bus:latest
echo "Pushed event-bus"

# Build and push Frontend
docker build -t cloudretail/frontend -f ./frontend/Dockerfile ./frontend
docker tag cloudretail/frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/cloudretail/frontend:latest
echo "Pushed frontend"
```

---

## 7. AWS Deployment - EC2 Instance

We deploy using Docker Compose on a single EC2 instance (free tier eligible).

### 7.1 Create a security group for EC2

```bash
EC2_SG_ID=$(aws ec2 create-security-group \
  --group-name cloudretail-ec2-sg \
  --description "CloudRetail EC2 access" \
  --vpc-id $VPC_ID \
  --region ap-southeast-1 \
  --query "GroupId" --output text)

# Allow SSH
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ap-southeast-1

# Allow API Gateway (8080)
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 8080 --cidr 0.0.0.0/0 --region ap-southeast-1

# Allow Frontend (3000)
aws ec2 authorize-security-group-ingress --group-id $EC2_SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region ap-southeast-1

echo "EC2 Security Group: $EC2_SG_ID"
```

### 7.2 Create a key pair (if you do not have one)

```bash
aws ec2 create-key-pair \
  --key-name cloudretail-key \
  --query "KeyMaterial" --output text \
  --region ap-southeast-1 > cloudretail-key.pem

chmod 400 cloudretail-key.pem
```

### 7.3 Launch the EC2 instance

```bash
# Get the latest Amazon Linux 2023 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" "Name=state,Values=available" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text \
  --region ap-southeast-1)

echo "AMI: $AMI_ID"

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.micro \
  --key-name cloudretail-key \
  --security-group-ids $EC2_SG_ID \
  --region ap-southeast-1 \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=cloudretail-server}]" \
  --query "Instances[0].InstanceId" --output text)

echo "Instance ID: $INSTANCE_ID"

# Wait for it to be running
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region ap-southeast-1

# Get the public IP
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region ap-southeast-1 \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text)

echo "EC2 Public IP: $EC2_IP"
```

### 7.4 Install Docker on EC2

SSH into the instance and install Docker:

```bash
ssh -i cloudretail-key.pem ec2-user@$EC2_IP
```

Once connected, run:

```bash
# Install Docker
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for docker group to take effect
exit
```

SSH in again:

```bash
ssh -i cloudretail-key.pem ec2-user@$EC2_IP
```

### 7.5 Create a production docker-compose file on EC2

Create a `docker-compose.prod.yml` that uses ECR images and connects to RDS:

```bash
# Set your variables (replace with actual values)
export AWS_ACCOUNT_ID="YOUR_ACCOUNT_ID"
export RDS_HOST="cloudretail-db.xxxxxxxx.ap-southeast-1.rds.amazonaws.com"
export DB_PASSWORD="CloudRetail2026db"

# Log in to ECR
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com

# Create the compose file
cat > docker-compose.yml << 'COMPOSE'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  event-bus:
    image: ${ECR_PREFIX}/cloudretail/event-bus:latest
    environment:
      NODE_ENV: production
      PORT: 4000
      USE_KAFKA: "true"
      KAFKA_BROKERS: kafka:29092
      REDIS_URL: redis://redis:6379
    depends_on:
      kafka:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  user-service:
    image: ${ECR_PREFIX}/cloudretail/user-service:latest
    environment:
      NODE_ENV: development
      PORT: 3001
      DB_HOST: ${RDS_HOST}
      DB_PORT: 5432
      DB_NAME: cloudretail_users
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SSL: "true"
      JWT_SECRET: ${JWT_SECRET:-cloudretail-jwt-secret-2026}
      EVENT_BUS_URL: http://event-bus:4000/events
    depends_on:
      - event-bus
    restart: unless-stopped

  product-service:
    image: ${ECR_PREFIX}/cloudretail/product-service:latest
    environment:
      NODE_ENV: development
      PORT: 3002
      DB_HOST: ${RDS_HOST}
      DB_PORT: 5432
      DB_NAME: cloudretail_products
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SSL: "true"
      JWT_SECRET: ${JWT_SECRET:-cloudretail-jwt-secret-2026}
      EVENT_BUS_URL: http://event-bus:4000/events
    depends_on:
      - event-bus
    restart: unless-stopped

  order-service:
    image: ${ECR_PREFIX}/cloudretail/order-service:latest
    environment:
      NODE_ENV: development
      PORT: 3003
      DB_HOST: ${RDS_HOST}
      DB_PORT: 5432
      DB_NAME: cloudretail_orders
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SSL: "true"
      JWT_SECRET: ${JWT_SECRET:-cloudretail-jwt-secret-2026}
      EVENT_BUS_URL: http://event-bus:4000/events
      INVENTORY_SERVICE_URL: http://inventory-service:3004
      PAYMENT_SERVICE_URL: http://payment-service:3005
    depends_on:
      - event-bus
      - inventory-service
    restart: unless-stopped

  inventory-service:
    image: ${ECR_PREFIX}/cloudretail/inventory-service:latest
    environment:
      NODE_ENV: development
      PORT: 3004
      DB_HOST: ${RDS_HOST}
      DB_PORT: 5432
      DB_NAME: cloudretail_inventory
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SSL: "true"
      JWT_SECRET: ${JWT_SECRET:-cloudretail-jwt-secret-2026}
      EVENT_BUS_URL: http://event-bus:4000/events
    depends_on:
      - event-bus
    restart: unless-stopped

  payment-service:
    image: ${ECR_PREFIX}/cloudretail/payment-service:latest
    environment:
      NODE_ENV: development
      PORT: 3005
      DB_HOST: ${RDS_HOST}
      DB_PORT: 5432
      DB_NAME: cloudretail_payments
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_SSL: "true"
      JWT_SECRET: ${JWT_SECRET:-cloudretail-jwt-secret-2026}
      EVENT_BUS_URL: http://event-bus:4000/events
      ORDER_SERVICE_URL: http://order-service:3003
    depends_on:
      - event-bus
    restart: unless-stopped

  api-gateway:
    image: ${ECR_PREFIX}/cloudretail/api-gateway:latest
    ports:
      - "8080:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      USER_SERVICE_URL: http://user-service:3001
      PRODUCT_SERVICE_URL: http://product-service:3002
      ORDER_SERVICE_URL: http://order-service:3003
      INVENTORY_SERVICE_URL: http://inventory-service:3004
      PAYMENT_SERVICE_URL: http://payment-service:3005
      ALLOWED_ORIGINS: "*"
    depends_on:
      - user-service
      - product-service
      - order-service
      - inventory-service
      - payment-service
    restart: unless-stopped

  frontend:
    image: ${ECR_PREFIX}/cloudretail/frontend:latest
    ports:
      - "3000:3000"
    depends_on:
      - api-gateway
    restart: unless-stopped

networks:
  default:
    name: cloudretail-network
COMPOSE
```

### 7.6 Create the .env file

```bash
cat > .env << ENV
ECR_PREFIX=$AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com
RDS_HOST=$RDS_HOST
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=cloudretail-jwt-secret-2026
ENV
```

### 7.7 Start the application

```bash
docker-compose up -d
```

Check that all containers are running:

```bash
docker-compose ps
```

---

## 8. Verify AWS Deployment

From your local machine, test the deployed application:

### 8.1 Health check

```bash
curl http://$EC2_IP:8080/health
```

### 8.2 Register a user

```bash
curl -s -X POST http://$EC2_IP:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"Admin\",\"lastName\":\"User\",\"email\":\"admin@cloudretail.com\",\"password\":\"Password123\",\"role\":\"admin\",\"gdprConsent\":true}"
```

### 8.3 Open the frontend

Open `http://<EC2_IP>:3000` in your browser.

---

## 9. Clean Up AWS Resources

When you are done, delete everything to avoid charges:

```bash
# Delete EC2 instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID --region ap-southeast-1

# Delete RDS instance
aws rds delete-db-instance --db-instance-identifier cloudretail-db --skip-final-snapshot --region ap-southeast-1

# Delete ECR repositories
for repo in user-service product-service order-service inventory-service payment-service api-gateway event-bus frontend; do
  aws ecr delete-repository --repository-name cloudretail/$repo --force --region ap-southeast-1
done

# Delete security groups (after EC2 and RDS are terminated)
aws ec2 delete-security-group --group-id $EC2_SG_ID --region ap-southeast-1
aws ec2 delete-security-group --group-id $SG_ID --region ap-southeast-1

# Delete key pair
aws ec2 delete-key-pair --key-name cloudretail-key --region ap-southeast-1
rm -f cloudretail-key.pem
```

---

## API Route Reference

| Service | Method | Full URL | Auth |
|---------|--------|----------|------|
| **User** | POST | `/api/users/register` | Public |
| **User** | POST | `/api/users/login` | Public |
| **User** | GET | `/api/users/profile` | Token |
| **User** | PUT | `/api/users/profile` | Token |
| **User** | DELETE | `/api/users/profile` | Token |
| **User** | GET | `/api/users/users` | Admin |
| **Product** | GET | `/api/products/products` | Public |
| **Product** | GET | `/api/products/products/:id` | Public |
| **Product** | POST | `/api/products/products` | Admin/Vendor |
| **Product** | PUT | `/api/products/products/:id` | Admin/Vendor |
| **Product** | DELETE | `/api/products/products/:id` | Admin/Vendor |
| **Product** | GET | `/api/products/search?q=term` | Public |
| **Order** | POST | `/api/orders/orders` | Token |
| **Order** | GET | `/api/orders/orders` | Token |
| **Order** | GET | `/api/orders/orders/:id` | Token |
| **Order** | GET | `/api/orders/admin/orders` | Admin |
| **Inventory** | POST | `/api/inventory/inventory` | Admin/Vendor |
| **Inventory** | GET | `/api/inventory/inventory` | Admin/Vendor |
| **Inventory** | GET | `/api/inventory/product/:productId` | Public |
| **Inventory** | PUT | `/api/inventory/product/:productId` | Admin/Vendor |
| **Payment** | POST | `/api/payments/payments` | Token |
| **Payment** | GET | `/api/payments/payments` | Token |
| **Payment** | GET | `/api/payments/order/:orderId` | Token |

All URLs are prefixed with `http://localhost:8080` (local) or `http://<EC2_IP>:8080` (AWS).

---

## Architecture Summary

```
[Browser] --> [Frontend :3000] --> [API Gateway :8080]
                                        |
                 +-----------+-----------+-----------+-----------+
                 |           |           |           |           |
            [User :3001] [Product :3002] [Order :3003] [Inventory :3004] [Payment :3005]
                 |           |           |           |           |
                 +-----+-----+-----+-----+-----+-----+-----+---+
                       |                                   |
                 [PostgreSQL]                        [Event Bus :4000]
              (single instance,                          |
               5 databases)                    [Kafka] + [Redis]
```

- **Local**: Single PostgreSQL container with `init-db.sql` creating 5 databases
- **AWS**: Single RDS db.t3.micro instance with 5 databases (free tier)
- **Region**: ap-southeast-1 (Singapore)

---

*COMP60010 - Enterprise Cloud and Distributed Web Applications - Staffordshire University*
