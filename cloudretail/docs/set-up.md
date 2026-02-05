# CloudRetail Platform - Setup Guide

**COMP60010: Enterprise Cloud and Distributed Web Applications**

This guide walks you through getting CloudRetail running locally, testing every service, and deploying to AWS. Follow the sections in order from top to bottom.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone and Install](#2-clone-and-install)
3. [Project Structure](#3-project-structure)
4. [Start Everything with Docker Compose](#4-start-everything-with-docker-compose)
5. [Wait for Services to Be Healthy](#5-wait-for-services-to-be-healthy)
6. [Test the APIs](#6-test-the-apis)
7. [Open the Frontend](#7-open-the-frontend)
8. [Running the Tests](#8-running-the-tests)
9. [Running Services Without Docker (Optional)](#9-running-services-without-docker-optional)
10. [AWS Cloud Deployment](#10-aws-cloud-deployment)
11. [AWS Monitoring and CI/CD](#11-aws-monitoring-and-cicd)
12. [Troubleshooting](#12-troubleshooting)
13. [Commands Reference](#13-commands-reference)

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Install From |
|------|---------|-------------|
| **Node.js** | 18+ | https://nodejs.org |
| **npm** | 9+ | Comes with Node.js |
| **Docker Desktop** | 20+ | https://www.docker.com/products/docker-desktop |
| **Docker Compose** | 2+ | Comes with Docker Desktop |
| **Git** | 2+ | https://git-scm.com/downloads |

Verify everything is installed:

```bash
node --version          # v18.x.x or higher
npm --version           # 9.x.x or higher
docker --version        # 20.x or higher
docker compose version  # 2.x or higher
git --version           # 2.x or higher
```

**For AWS deployment only** (Section 10), you will also need:
- AWS CLI v2 — https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
- kubectl v1.28+ — https://kubernetes.io/docs/tasks/tools/
- eksctl — https://eksctl.io/installation/

---

## 2. Clone and Install

```bash
git clone https://github.com/ChizzyDizzy/ecdwa2.git
cd ecdwa2/cloudretail

# Install all dependencies (root + all microservices + shared libraries)
npm run install:all
```

This installs packages for all 5 microservices, the API gateway, event bus, and shared libraries using npm workspaces.

---

## 3. Project Structure

```
cloudretail/
├── frontend/              → Static HTML/CSS/JS served by Nginx (port 3000)
├── api-gateway/           → Routes all API requests to services (port 8080)
├── services/
│   ├── user-service/      → Registration, login, JWT auth (port 3001)
│   ├── product-service/   → Product catalog CRUD (port 3002)
│   ├── order-service/     → Order creation and tracking (port 3003)
│   ├── inventory-service/ → Stock management (port 3004)
│   └── payment-service/   → Payment processing (port 3005)
├── event-bus/             → Kafka-based event routing (port 4000)
├── shared/                → Shared middleware and data models
├── infrastructure/
│   └── kubernetes/        → K8s manifests for AWS EKS deployment
├── monitoring/            → Prometheus + Grafana configs
├── tests/                 → Unit, integration, and performance tests
├── docker-compose.yml     → Runs everything locally
└── package.json           → Root scripts (install:all, docker:build, etc.)
```

**Architecture:** Each microservice has its own PostgreSQL database. Services communicate through the event bus (Kafka + Redis). The API gateway is the single entry point for all client requests.

**Docker Compose starts 15 containers:**
- 5 microservices + API gateway + event bus + frontend (8 app containers)
- 5 PostgreSQL databases (one per service)
- Redis (event caching)
- Kafka + Zookeeper (event streaming)

---

## 4. Start Everything with Docker Compose

```bash
cd ecdwa2/cloudretail

# Step 1: Build all Docker images
npm run docker:build

# Step 2: Start all 15 containers
npm run docker:up
```

If the build fails with a cache error, run this and rebuild:

```bash
docker builder prune -f
npm run docker:build
```

---

## 5. Wait for Services to Be Healthy

**This step is important.** The databases take 10-20 seconds to start. The services won't work until their database is ready.

```bash
# Check container status — wait until all show "Up" or "healthy"
docker compose ps
```

Check the API gateway health endpoint:

```bash
curl http://localhost:8080/health
```

**Healthy response** — all services connected to their databases:
```json
{"status":"healthy","timestamp":"...","uptime":...,"details":{"services":true}}
```

**Unhealthy response** — services still starting or a database is down:
```json
{"status":"unhealthy","timestamp":"...","uptime":...,"details":{"services":false}}
```

If you get `unhealthy`, wait 30 seconds and try again. The API gateway checks each service every 30 seconds. You can check individual service logs:

```bash
# See which service is failing
docker compose logs user-service
docker compose logs product-service
docker compose logs api-gateway
```

---

## 6. Test the APIs

Once the health check returns `healthy`, test the full flow.

> **Windows Git Bash users:** The `!` character triggers bash history expansion.
> Either run `set +H` first, use PowerShell, or use passwords without `!`
> (the examples below avoid `!` for this reason).

### 6.1 Register an Admin User

Register with `"role": "admin"` so you can create products and manage inventory.
The `gdprConsent` field is required and must be `true`.

```bash
curl -s -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cloudretail.com",
    "password": "Admin123Secure",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",
    "gdprConsent": true
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "...",
      "email": "admin@cloudretail.com",
      "firstName": "Admin",
      "lastName": "User",
      "role": "admin"
    }
  }
}
```

Copy the `token` value — you need it for all the following requests.
Replace `<TOKEN>` in the commands below with your actual token.

### 6.2 Login

```bash
curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@cloudretail.com",
    "password": "Admin123Secure"
  }'
```

Returns the same format with a fresh JWT token.

### 6.3 Create a Product

Creating products requires `admin` or `vendor` role.

```bash
curl -s -X POST http://localhost:8080/api/products/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Wireless Gaming Headset",
    "description": "Premium 7.1 surround sound headset with RGB lighting",
    "price": 79.99,
    "category": "electronics",
    "sku": "WGH-001"
  }'
```

Copy the `id` from the response — you need it for inventory and orders.

### 6.4 List Products

```bash
curl -s http://localhost:8080/api/products/products
```

Products are public — no authentication required to list them.

### 6.5 Create Inventory for the Product

Creating inventory requires `admin` or `vendor` role.

```bash
curl -s -X POST http://localhost:8080/api/inventory/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "productId": "<PRODUCT_ID_FROM_STEP_6.3>",
    "quantity": 100,
    "warehouse": "main",
    "reorderPoint": 10,
    "reorderQuantity": 50
  }'
```

### 6.6 Place an Order

```bash
curl -s -X POST http://localhost:8080/api/orders/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "items": [
      {
        "productId": "<PRODUCT_ID>",
        "quantity": 2,
        "price": 79.99
      }
    ],
    "shippingAddress": {
      "street": "123 Test St",
      "city": "Manchester",
      "postcode": "M1 1AA",
      "country": "UK"
    }
  }'
```

### 6.7 View Your Orders

```bash
curl -s http://localhost:8080/api/orders/orders \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.8 Check Event Bus Stats

```bash
curl -s http://localhost:4000/events/stats
```

Shows how many events have been published across the system (user.created, product.created, order.created, etc.).

---

## 7. Open the Frontend

Open **http://localhost:3000** in your browser.

The frontend is a static HTML/CSS/JS application served by Nginx. It connects to the API gateway at `http://localhost:8080`. You can:

- Browse the product catalog
- Register and login (JWT stored in localStorage)
- Add products to cart and place orders
- View order history
- Check inventory status
- View the admin dashboard with architecture diagrams

**Frontend files:**

| File | Purpose |
|------|---------|
| `frontend/public/index.html` | Main HTML page |
| `frontend/public/styles.css` | CSS theme (Y2K retro Windows style) |
| `frontend/public/app.js` | JavaScript (API calls, auth, cart logic) |
| `frontend/Dockerfile` | Nginx Alpine container |
| `frontend/nginx.conf` | Nginx server config (port 3000) |

---

## 8. Running the Tests

### Unit Tests

```bash
npm run test:unit
```

### Run Tests for a Specific Service

```bash
cd services/user-service && npm test
cd services/product-service && npm test
cd services/order-service && npm test
cd services/inventory-service && npm test
cd services/payment-service && npm test
```

### Integration Tests

Make sure Docker Compose is running first:

```bash
npm run test:integration
```

### Performance / Load Tests

```bash
npm run test:performance
```

### All Tests

```bash
npm test
```

---

## 9. Running Services Without Docker (Optional)

If you want to run services directly for faster development (hot-reload with nodemon):

### Step 1: Start only the infrastructure containers

```bash
docker compose up -d postgres-users postgres-products postgres-orders \
  postgres-inventory postgres-payments redis zookeeper kafka
```

### Step 2: Start the event bus

```bash
npm run dev:eventbus
```

### Step 3: Start services (each in a separate terminal)

```bash
npm run dev:user        # Terminal 1 — port 3001
npm run dev:product     # Terminal 2 — port 3002
npm run dev:order       # Terminal 3 — port 3003
npm run dev:inventory   # Terminal 4 — port 3004
npm run dev:payment     # Terminal 5 — port 3005
npm run dev:gateway     # Terminal 6 — port 8080
```

Each service has a `.env.example` file you can copy to `.env` and customize:

```bash
cd services/user-service
cp .env.example .env
```

---

## 10. AWS Cloud Deployment

This section covers deploying CloudRetail to AWS. These AWS services replace the local Docker infrastructure.

| Local (Docker Compose) | AWS Service | Purpose |
|------------------------|-------------|---------|
| Docker containers | **AWS EKS** (Elastic Kubernetes Service) | Runs containers in a managed K8s cluster |
| Docker images | **AWS ECR** (Elastic Container Registry) | Stores Docker images |
| PostgreSQL containers | **AWS RDS** (Relational Database Service) | Managed PostgreSQL databases |
| Redis container | **AWS ElastiCache** | Managed Redis cache |
| Kafka + Zookeeper | **AWS MSK** (Managed Streaming for Kafka) | Managed Kafka cluster |
| localhost access | **AWS ALB** (Application Load Balancer) | Routes internet traffic to services |
| — | **AWS Route 53** | DNS management |
| — | **AWS Secrets Manager** | Stores passwords and API keys securely |

### 10.1 Set Up AWS Account and CLI

1. Create an AWS account at https://aws.amazon.com
2. Enable MFA on the root account
3. Create an IAM user with `AdministratorAccess`:
   - Go to IAM Console → Users → Add users
   - Username: `cloudretail-admin`
   - Create access keys for CLI access
4. Configure the CLI:

```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: eu-west-1
# Default output format: json
```

### 10.2 Create the EKS Cluster

```bash
eksctl create cluster \
  --name cloudretail-cluster \
  --region eu-west-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# Verify:
kubectl get nodes
# Should show 3 nodes in "Ready" state
```

### 10.3 Create ECR Repositories

```bash
for service in user-service product-service order-service inventory-service \
  payment-service event-bus api-gateway frontend; do
  aws ecr create-repository \
    --repository-name cloudretail/$service \
    --region eu-west-1
done
```

### 10.4 Create RDS Databases

Create one PostgreSQL instance per microservice:

```bash
for db in users products orders inventory payments; do
  aws rds create-db-instance \
    --db-instance-identifier cloudretail-${db}-db \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15 \
    --master-username postgres \
    --master-user-password YourSecurePassword123! \
    --allocated-storage 20 \
    --db-name cloudretail_${db} \
    --region eu-west-1
done
```

### 10.5 Create ElastiCache (Redis)

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id cloudretail-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --region eu-west-1
```

### 10.6 Create MSK (Managed Kafka)

1. Go to Amazon MSK Console → Create cluster
2. Cluster name: `cloudretail-kafka`
3. Broker type: `kafka.t3.small`
4. Number of brokers: 3 (one per availability zone)
5. Apache Kafka version: 3.5.1
6. Select the same VPC as your EKS cluster

### 10.7 Store Secrets

```bash
aws secretsmanager create-secret \
  --name cloudretail/db-password \
  --secret-string "YourSecurePassword123!" \
  --region eu-west-1

aws secretsmanager create-secret \
  --name cloudretail/jwt-secret \
  --secret-string "$(openssl rand -base64 64)" \
  --region eu-west-1
```

### 10.8 Push Docker Images to ECR

```bash
# Login to ECR
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin \
  <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com

# Build, tag, and push each service
for service in user-service product-service order-service inventory-service \
  payment-service event-bus api-gateway; do
  docker build -t cloudretail/$service -f services/$service/Dockerfile .
  docker tag cloudretail/$service:latest \
    <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/$service:latest
  docker push \
    <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/$service:latest
done

# Frontend (different Dockerfile path)
docker build -t cloudretail/frontend -f frontend/Dockerfile frontend/
docker tag cloudretail/frontend:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/frontend:latest
docker push \
  <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/frontend:latest
```

### 10.9 Update Kubernetes Manifests

Edit `infrastructure/kubernetes/configmap.yaml` to point to your AWS resources:

```yaml
data:
  # Service URLs stay the same (K8s internal DNS)
  USER_SERVICE_URL: "http://user-service:3001"
  PRODUCT_SERVICE_URL: "http://product-service:3002"
  ORDER_SERVICE_URL: "http://order-service:3003"
  INVENTORY_SERVICE_URL: "http://inventory-service:3004"
  PAYMENT_SERVICE_URL: "http://payment-service:3005"
  # Replace with your AWS RDS endpoints
  DB_HOST_USERS: "cloudretail-users-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  DB_HOST_PRODUCTS: "cloudretail-products-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  DB_HOST_ORDERS: "cloudretail-orders-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  DB_HOST_INVENTORY: "cloudretail-inventory-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  DB_HOST_PAYMENTS: "cloudretail-payments-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  # Replace with your AWS ElastiCache endpoint
  REDIS_URL: "redis://cloudretail-redis.xxxxxxxx.cache.amazonaws.com:6379"
  # Replace with your AWS MSK broker endpoint
  KAFKA_BROKERS: "b-1.cloudretail-kafka.xxxxxxxx.kafka.eu-west-1.amazonaws.com:9092"
```

Edit `infrastructure/kubernetes/secrets.yaml`:

```bash
# Base64-encode your secrets
echo -n "YourSecurePassword123!" | base64
# Use the output in secrets.yaml
```

### 10.10 Deploy to EKS

```bash
# Point kubectl at your EKS cluster
aws eks update-kubeconfig --name cloudretail-cluster --region eu-west-1

# Deploy everything
cd infrastructure/kubernetes
chmod +x deploy.sh
./deploy.sh

# Or deploy step by step:
kubectl apply -f namespace.yaml
kubectl apply -f resource-quota.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f kafka-statefulset.yaml
kubectl apply -f user-service-deployment.yaml
kubectl apply -f product-service-deployment.yaml
kubectl apply -f order-service-deployment.yaml
kubectl apply -f inventory-service-deployment.yaml
kubectl apply -f payment-service-deployment.yaml
kubectl apply -f event-bus-deployment.yaml
kubectl apply -f api-gateway-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f hpa.yaml
kubectl apply -f network-policy.yaml
kubectl apply -f ingress.yaml
```

### 10.11 Set Up the Load Balancer

```bash
# Install the AWS ALB Ingress Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=cloudretail-cluster \
  --set serviceAccount.create=true
```

### 10.12 Verify the Deployment

```bash
# All pods running
kubectl get pods -n cloudretail

# Services have endpoints
kubectl get services -n cloudretail

# Ingress has an external address
kubectl get ingress -n cloudretail

# Auto-scaling is active
kubectl get hpa -n cloudretail

# Test the external endpoint
curl https://<YOUR_ALB_DNS>/health
```

---

## 11. AWS Monitoring and CI/CD

### 11.1 CloudWatch Logs

```bash
# EKS automatically sends container logs to CloudWatch
# Create a log group:
aws logs create-log-group --log-group-name /cloudretail/services --region eu-west-1
```

### 11.2 Prometheus + Grafana

```bash
# Create an AWS Managed Prometheus workspace
aws amp create-workspace --alias cloudretail-metrics --region eu-west-1
```

The Prometheus config is in `monitoring/prometheus.yml`. It scrapes metrics from all services.

For Grafana:
1. Go to AWS Managed Grafana Console → Create workspace
2. Name: `cloudretail-dashboards`
3. Data source: Select your AMP workspace
4. Import dashboard from `monitoring/grafana-dashboard.json`

### 11.3 Alert Notifications

```bash
# Create an SNS topic for alerts
aws sns create-topic --name cloudretail-alerts --region eu-west-1

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:<ACCOUNT_ID>:cloudretail-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

Alert rules are defined in `monitoring/alerting-rules.yml` (ServiceDown, HighErrorRate, HighResponseTime, etc.).

### 11.4 CI/CD with AWS CodePipeline

1. **Source Stage:** Connect to your GitHub repository
2. **Build Stage (CodeBuild):** Run tests, build Docker images, push to ECR
3. **Deploy Stage (CodeDeploy):** Update K8s deployments on EKS with rolling updates

Example `buildspec.yml`:

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
  pre_build:
    commands:
      - npm run install:all
      - aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com
  build:
    commands:
      - npm test
      - docker build -t cloudretail/user-service -f services/user-service/Dockerfile .
      - docker tag cloudretail/user-service:latest $AWS_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest
      - docker push $AWS_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest
      # Repeat for other services
  post_build:
    commands:
      - aws eks update-kubeconfig --name cloudretail-cluster --region eu-west-1
      - kubectl set image deployment/user-service user-service=$AWS_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest -n cloudretail
```

---

## 12. Troubleshooting

### Health check returns `unhealthy`

The API gateway checks each service every 30 seconds. Services report unhealthy when they can't connect to their database. Wait 30 seconds after starting containers and try again.

```bash
# Check which container is failing
docker compose ps

# Check a specific service's logs
docker compose logs user-service
docker compose logs postgres-users
```

### Docker build fails with cache error

```bash
docker builder prune -f
npm run docker:build
```

### Registration returns no response or hangs

Make sure you include `"gdprConsent": true` in the request body. Without it, the request will return a 400 validation error.

### Port already in use

```bash
# Find what's using the port (example: port 3001)
lsof -i :3001    # macOS/Linux
netstat -ano | findstr :3001   # Windows

# Kill it or change the port in .env
```

### Database connection errors

```bash
# Check if the database container is running
docker compose ps postgres-users

# Check database logs
docker compose logs postgres-users

# Connect directly to the database
docker exec -it cloudretail-postgres-users-1 psql -U postgres -d cloudretail_users
```

### npm install fails

```bash
npm cache clean --force
rm -rf node_modules
rm -rf services/*/node_modules
npm run install:all
```

### Kubernetes pods in CrashLoopBackOff

```bash
kubectl logs <pod-name> -n cloudretail
kubectl describe pod <pod-name> -n cloudretail
# Usually caused by wrong ConfigMap/Secret values or unreachable database
```

---

## 13. Commands Reference

### Docker (Local Development)

```bash
npm run docker:build              # Build all images
npm run docker:up                 # Start all 15 containers
npm run docker:down               # Stop all containers
docker compose ps                 # List running containers
docker compose logs -f            # Tail all logs
docker compose logs -f <service>  # Tail one service's logs
docker compose down -v            # Stop and delete all data
```

### Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| API Gateway | 8080 | http://localhost:8080 |
| User Service | 3001 | http://localhost:3001 |
| Product Service | 3002 | http://localhost:3002 |
| Order Service | 3003 | http://localhost:3003 |
| Inventory Service | 3004 | http://localhost:3004 |
| Payment Service | 3005 | http://localhost:3005 |
| Event Bus | 4000 | http://localhost:4000 |
| PostgreSQL (users) | 5432 | — |
| PostgreSQL (products) | 5433 | — |
| PostgreSQL (orders) | 5434 | — |
| PostgreSQL (inventory) | 5435 | — |
| PostgreSQL (payments) | 5436 | — |
| Redis | 6379 | — |
| Kafka | 9092 | — |

### Testing

```bash
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests (requires Docker Compose running)
npm run test:performance  # Load tests with Artillery
```

### Dev Mode (Without Docker)

```bash
npm run dev:user        # User Service with hot-reload
npm run dev:product     # Product Service
npm run dev:order       # Order Service
npm run dev:inventory   # Inventory Service
npm run dev:payment     # Payment Service
npm run dev:gateway     # API Gateway
npm run dev:eventbus    # Event Bus
```

### Kubernetes (AWS EKS)

```bash
kubectl get pods -n cloudretail                          # List pods
kubectl get services -n cloudretail                      # List services
kubectl get hpa -n cloudretail                           # Check auto-scaling
kubectl logs -f deployment/<name> -n cloudretail         # View logs
kubectl describe pod <name> -n cloudretail               # Debug a pod
kubectl rollout restart deployment/<name> -n cloudretail # Restart service
```

### AWS CLI

```bash
aws eks list-clusters                                    # List EKS clusters
aws ecr list-images --repository-name cloudretail/user-service  # List images
aws rds describe-db-instances                            # List RDS databases
aws elasticache describe-cache-clusters                  # List Redis clusters
aws logs tail /cloudretail/services --follow             # Tail CloudWatch logs
```

---

## AWS Services Summary

| AWS Service | Replaces | Purpose |
|-------------|----------|---------|
| **EKS** | Docker Compose | Managed Kubernetes for running containers |
| **ECR** | Local images | Docker image registry |
| **RDS** (x5) | PostgreSQL containers | Managed databases (one per microservice) |
| **ElastiCache** | Redis container | Managed Redis for caching and events |
| **MSK** | Kafka + Zookeeper | Managed Kafka for event streaming |
| **ALB** | localhost:8080 | Internet-facing load balancer |
| **Route 53** | — | DNS management |
| **Secrets Manager** | .env files | Secure credential storage |
| **CloudWatch** | docker logs | Centralized logging and alarms |
| **Managed Prometheus** | — | Metrics collection |
| **Managed Grafana** | — | Metrics dashboards |
| **SNS** | — | Alert notifications |
| **CodePipeline + CodeBuild** | — | CI/CD automation |

---

*COMP60010 | February 2026*
