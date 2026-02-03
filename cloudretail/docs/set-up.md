# CloudRetail Platform - Beginner Setup Guide

**COMP60010: Enterprise Cloud and Distributed Web Applications**

This guide walks you through setting up the entire CloudRetail platform from scratch, including local development, AWS cloud deployment, and monitoring. No prior experience with these tools is assumed.

---

## Table of Contents

1. [Prerequisites - What You Need to Install](#1-prerequisites---what-you-need-to-install)
2. [Clone the Repository](#2-clone-the-repository)
3. [Understand the Project Structure](#3-understand-the-project-structure)
4. [Local Development Setup (Docker Compose)](#4-local-development-setup-docker-compose)
5. [Running Individual Services (Without Docker)](#5-running-individual-services-without-docker)
6. [Running the Tests](#6-running-the-tests)
7. [AWS Cloud Setup](#7-aws-cloud-setup)
8. [Deploying to AWS EKS (Kubernetes)](#8-deploying-to-aws-eks-kubernetes)
9. [Setting Up Monitoring on AWS](#9-setting-up-monitoring-on-aws)
10. [Setting Up CI/CD on AWS](#10-setting-up-cicd-on-aws)
11. [Verifying Everything Works](#11-verifying-everything-works)
12. [Common Issues and Troubleshooting](#12-common-issues-and-troubleshooting)
13. [Useful Commands Reference](#13-useful-commands-reference)

---

## 1. Prerequisites - What You Need to Install

Before starting, install the following tools on your machine.

### 1.1 Node.js and npm

Node.js is the JavaScript runtime that all our microservices run on.

```bash
# Download and install Node.js 18+ from https://nodejs.org
# Verify installation:
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

### 1.2 Docker and Docker Compose

Docker packages each service into a container. Docker Compose runs all containers together.

```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Verify installation:
docker --version           # Should show 20.x or higher
docker-compose --version   # Should show 2.x or higher
```

### 1.3 Git

Git is used for version control.

```bash
# Install from https://git-scm.com/downloads
git --version   # Should show 2.x or higher
```

### 1.4 AWS CLI (for cloud deployment)

The AWS CLI lets you interact with Amazon Web Services from your terminal.

```bash
# Install from https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html
aws --version   # Should show aws-cli/2.x.x

# Configure your AWS credentials:
aws configure
# Enter your:
#   AWS Access Key ID: (from your AWS account)
#   AWS Secret Access Key: (from your AWS account)
#   Default region name: eu-west-1 (or your preferred region)
#   Default output format: json
```

### 1.5 kubectl (for Kubernetes deployment)

kubectl is the command-line tool for controlling Kubernetes clusters.

```bash
# Install from https://kubernetes.io/docs/tasks/tools/
kubectl version --client   # Should show v1.28 or higher
```

### 1.6 eksctl (for creating AWS EKS clusters)

eksctl simplifies creating and managing Kubernetes clusters on AWS.

```bash
# Install from https://eksctl.io/installation/
eksctl version   # Should show 0.x.x
```

---

## 2. Clone the Repository

```bash
# Clone the project
git clone https://github.com/ChizzyDizzy/ecdwa2.git
cd ecdwa2/cloudretail

# Install all dependencies (this installs packages for all services at once)
npm run install:all
```

This uses npm workspaces to install dependencies for:
- 5 microservices (`services/user-service`, `services/product-service`, etc.)
- API Gateway (`api-gateway`)
- Event Bus (`event-bus`)
- Shared libraries (`shared/models`, `shared/middleware`)

---

## 3. Understand the Project Structure

```
cloudretail/
├── api-gateway/           → Single entry point for all API requests (port 8080)
├── services/
│   ├── user-service/      → User registration, login, JWT auth (port 3001)
│   ├── product-service/   → Product catalog management (port 3002)
│   ├── order-service/     → Order creation and tracking (port 3003)
│   ├── inventory-service/ → Stock level management (port 3004)
│   └── payment-service/   → Payment processing (port 3005)
├── event-bus/             → Kafka-based event routing (port 4000)
├── shared/                → Shared code (auth middleware, models, etc.)
├── infrastructure/
│   └── kubernetes/        → All Kubernetes deployment files for AWS EKS
├── monitoring/            → Prometheus, Grafana, alerting configs
├── tests/                 → Unit, integration, and performance tests
├── docs/                  → Documentation and reports
├── docker-compose.yml     → Runs everything locally with one command
└── package.json           → Root project config with all scripts
```

**Key concept:** Each microservice has its own database (PostgreSQL), its own Docker container, and communicates with other services via Kafka events or HTTP calls. In production, all of this runs on **AWS EKS** (Amazon's managed Kubernetes service).

---

## 4. Local Development Setup (Docker Compose)

This is the fastest way to get everything running. Docker Compose starts all 14 containers (7 services + 5 PostgreSQL databases + Redis + Kafka/Zookeeper).

### Step 1: Build all Docker images

```bash
npm run docker:build
# This builds Docker images for all 7 services using multi-stage builds
```

### Step 2: Start all services

```bash
npm run docker:up
# This starts all containers in the background
```

### Step 3: Check that everything is running

```bash
docker-compose ps
# You should see all services listed as "Up" or "healthy"
```

### Step 4: Test the API

```bash
# Health check on the API Gateway:
curl http://localhost:8080/health

# Register a new user:
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login:
curl -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
# Save the JWT token from the response to use in other requests

# List products (replace <TOKEN> with your JWT):
curl http://localhost:8080/api/products \
  -H "Authorization: Bearer <TOKEN>"
```

### Step 5: View logs

```bash
# View all service logs:
docker-compose logs -f

# View logs for a specific service:
docker-compose logs -f user-service
docker-compose logs -f api-gateway
```

### Step 6: Stop everything

```bash
# Stop all services (keeps data):
npm run docker:down

# Stop and delete all data (clean start):
docker-compose down -v
```

### Service URLs (Local)

| Service | URL | Purpose |
|---|---|---|
| API Gateway | http://localhost:8080 | Main entry point for all requests |
| User Service | http://localhost:3001 | Direct access (bypasses gateway) |
| Product Service | http://localhost:3002 | Direct access |
| Order Service | http://localhost:3003 | Direct access |
| Inventory Service | http://localhost:3004 | Direct access |
| Payment Service | http://localhost:3005 | Direct access |
| Event Bus | http://localhost:4000 | Event routing service |

---

## 5. Running Individual Services (Without Docker)

If you want to run services directly on your machine for faster development:

### Step 1: Start infrastructure only

```bash
# Start only the databases, Redis, and Kafka:
docker-compose up -d postgres-users postgres-products postgres-orders \
  postgres-inventory postgres-payments redis zookeeper kafka
```

### Step 2: Run services individually

Open separate terminal windows for each service:

```bash
# Terminal 1 - Event Bus
npm run dev:eventbus

# Terminal 2 - User Service
npm run dev:user

# Terminal 3 - Product Service
npm run dev:product

# Terminal 4 - Order Service
npm run dev:order

# Terminal 5 - Inventory Service
npm run dev:inventory

# Terminal 6 - Payment Service
npm run dev:payment

# Terminal 7 - API Gateway
npm run dev:gateway
```

### Step 3: Configure environment variables (optional)

Each service has a `.env.example` file. To customize settings:

```bash
cd services/user-service
cp .env.example .env
# Edit .env with your settings (database host, JWT secret, etc.)
```

Key environment variables:

```env
PORT=3001                    # Service port
DB_HOST=localhost            # Database host
DB_PORT=5432                 # Database port
DB_NAME=cloudretail_users    # Database name
DB_USER=postgres             # Database user
DB_PASSWORD=postgres         # Database password
JWT_SECRET=your-secret-key   # JWT signing key (User Service only)
EVENT_BUS_URL=http://localhost:4000/events  # Event bus endpoint
```

---

## 6. Running the Tests

### Unit Tests (605 tests, 85% coverage)

```bash
# Run all unit tests:
npm run test:unit

# Run tests for a specific service:
cd services/user-service && npm test
cd services/product-service && npm test
cd services/order-service && npm test
cd services/inventory-service && npm test
cd services/payment-service && npm test
```

### Integration Tests (51 tests)

```bash
# Make sure all services are running first:
npm run docker:up

# Then run integration tests:
npm run test:integration
```

### Performance Tests

```bash
# Load test with Artillery:
npm run test:performance

# Stress test with k6 (install k6 first from https://k6.io):
cd tests/performance
k6 run k6-load-test.js
```

### Run Everything

```bash
npm test
```

---

## 7. AWS Cloud Setup

This section covers setting up the AWS infrastructure needed to run CloudRetail in the cloud.

### 7.1 Create an AWS Account

1. Go to https://aws.amazon.com and click "Create an AWS Account"
2. Follow the registration process
3. Enable MFA (Multi-Factor Authentication) on the root account for security

### 7.2 Set Up IAM User

Do not use your root account for day-to-day work. Create an IAM user:

1. Go to **AWS IAM** Console → Users → Add users
2. Username: `cloudretail-admin`
3. Attach policies: `AdministratorAccess` (for setup; restrict later)
4. Create access keys for CLI access
5. Run `aws configure` with these keys

### 7.3 Create the AWS EKS Cluster

**AWS EKS** (Elastic Kubernetes Service) is Amazon's managed Kubernetes service. It runs and manages the Kubernetes control plane for you.

```bash
# Create a Kubernetes cluster on AWS EKS:
eksctl create cluster \
  --name cloudretail-cluster \
  --region eu-west-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# This creates:
# - An EKS control plane
# - A managed node group with 3 EC2 instances (t3.medium)
# - VPC, subnets, security groups
# - IAM roles for the cluster

# Verify the cluster is running:
kubectl get nodes
# You should see 3 nodes in "Ready" state
```

### 7.4 Create AWS ECR Repositories

**AWS ECR** (Elastic Container Registry) stores your Docker images.

```bash
# Create a repository for each service:
aws ecr create-repository --repository-name cloudretail/user-service --region eu-west-1
aws ecr create-repository --repository-name cloudretail/product-service --region eu-west-1
aws ecr create-repository --repository-name cloudretail/order-service --region eu-west-1
aws ecr create-repository --repository-name cloudretail/inventory-service --region eu-west-1
aws ecr create-repository --repository-name cloudretail/payment-service --region eu-west-1
aws ecr create-repository --repository-name cloudretail/event-bus --region eu-west-1
aws ecr create-repository --repository-name cloudretail/api-gateway --region eu-west-1
```

### 7.5 Create AWS RDS Databases

**AWS RDS** (Relational Database Service) provides managed PostgreSQL databases.

```bash
# Create a database for each service (repeat for each):
aws rds create-db-instance \
  --db-instance-identifier cloudretail-users-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username postgres \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --db-name cloudretail_users \
  --vpc-security-group-ids sg-xxxxxxxx \
  --region eu-west-1

# Repeat for:
# cloudretail-products-db  (db-name: cloudretail_products)
# cloudretail-orders-db    (db-name: cloudretail_orders)
# cloudretail-inventory-db (db-name: cloudretail_inventory)
# cloudretail-payments-db  (db-name: cloudretail_payments)
```

### 7.6 Create AWS ElastiCache (Redis)

**AWS ElastiCache** provides a managed Redis instance for caching.

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id cloudretail-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --region eu-west-1
```

### 7.7 Create AWS MSK (Managed Kafka)

**AWS MSK** (Managed Streaming for Apache Kafka) provides a managed Kafka cluster.

```bash
# Create an MSK cluster via the AWS Console:
# 1. Go to Amazon MSK → Create cluster
# 2. Cluster name: cloudretail-kafka
# 3. Broker type: kafka.t3.small
# 4. Number of brokers: 3 (one per AZ)
# 5. Apache Kafka version: 3.5.1
# 6. Select the same VPC as your EKS cluster
# 7. Click "Create cluster"
```

### 7.8 Store Secrets in AWS Secrets Manager

```bash
# Store database passwords:
aws secretsmanager create-secret \
  --name cloudretail/db-password \
  --secret-string "YourSecurePassword123!" \
  --region eu-west-1

# Store JWT secret:
aws secretsmanager create-secret \
  --name cloudretail/jwt-secret \
  --secret-string "your-production-jwt-secret-key" \
  --region eu-west-1
```

---

## 8. Deploying to AWS EKS (Kubernetes)

### Step 1: Push Docker images to AWS ECR

```bash
# Log in to ECR:
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com

# Build and tag images:
docker build -t cloudretail/user-service -f services/user-service/Dockerfile .
docker tag cloudretail/user-service:latest <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest

# Push to ECR:
docker push <AWS_ACCOUNT_ID>.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest

# Repeat for all 7 services:
# cloudretail/product-service
# cloudretail/order-service
# cloudretail/inventory-service
# cloudretail/payment-service
# cloudretail/event-bus
# cloudretail/api-gateway
```

### Step 2: Update Kubernetes manifests with AWS resource endpoints

Edit `infrastructure/kubernetes/configmap.yaml` to point to your AWS resources:

```yaml
# Replace localhost references with AWS endpoints:
data:
  USER_SERVICE_URL: "http://user-service:3001"
  PRODUCT_SERVICE_URL: "http://product-service:3002"
  ORDER_SERVICE_URL: "http://order-service:3003"
  INVENTORY_SERVICE_URL: "http://inventory-service:3004"
  PAYMENT_SERVICE_URL: "http://payment-service:3005"
  # Database hosts should point to your AWS RDS endpoints:
  DB_HOST_USERS: "cloudretail-users-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  DB_HOST_PRODUCTS: "cloudretail-products-db.xxxxxxxx.eu-west-1.rds.amazonaws.com"
  # Redis should point to AWS ElastiCache:
  REDIS_URL: "redis://cloudretail-redis.xxxxxxxx.cache.amazonaws.com:6379"
  # Kafka should point to AWS MSK:
  KAFKA_BROKERS: "b-1.cloudretail-kafka.xxxxxxxx.kafka.eu-west-1.amazonaws.com:9092"
```

Edit `infrastructure/kubernetes/secrets.yaml` with base64-encoded credentials:

```bash
# Encode your secrets:
echo -n "YourSecurePassword123!" | base64
# Use the output in secrets.yaml
```

### Step 3: Deploy to AWS EKS

```bash
# Make sure kubectl is pointing to your EKS cluster:
aws eks update-kubeconfig --name cloudretail-cluster --region eu-west-1

# Run the deployment script:
cd infrastructure/kubernetes
chmod +x deploy.sh
./deploy.sh

# Or deploy manually step by step:
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
kubectl apply -f hpa.yaml
kubectl apply -f network-policy.yaml
kubectl apply -f ingress.yaml
```

### Step 4: Verify the deployment

```bash
# Check all pods are running:
kubectl get pods -n cloudretail
# All pods should show "Running" and "1/1 READY"

# Check services:
kubectl get services -n cloudretail

# Check the ingress (external URL):
kubectl get ingress -n cloudretail

# View logs for a specific service:
kubectl logs -f deployment/user-service -n cloudretail

# Check auto-scaling status:
kubectl get hpa -n cloudretail
```

### Step 5: Set up AWS ALB Ingress Controller

The **AWS Application Load Balancer** routes external traffic to your services:

```bash
# Install the AWS Load Balancer Controller:
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=cloudretail-cluster \
  --set serviceAccount.create=true
```

### Step 6: Set up DNS with AWS Route 53

```bash
# Create a hosted zone:
aws route53 create-hosted-zone \
  --name cloudretail.example.com \
  --caller-reference $(date +%s)

# Point your domain to the ALB endpoint
# (get the ALB DNS name from `kubectl get ingress -n cloudretail`)
```

---

## 9. Setting Up Monitoring on AWS

### 9.1 AWS Managed Prometheus (Metrics)

```bash
# Create an AMP workspace:
aws amp create-workspace --alias cloudretail-metrics --region eu-west-1

# The Prometheus configuration is in:
# monitoring/prometheus.yml
# It automatically scrapes metrics from all services
```

### 9.2 AWS Managed Grafana (Dashboards)

1. Go to **AWS Managed Grafana** Console → Create workspace
2. Workspace name: `cloudretail-dashboards`
3. Data source: Select your AMP workspace
4. Import the pre-built dashboard from `monitoring/grafana-dashboard.json`

The dashboard includes panels for:
- Request rate per service
- Response time (p50, p95, p99)
- Error rates
- CPU and memory usage
- Database connections
- Kafka event throughput
- Business KPIs (orders, payments)

### 9.3 AWS CloudWatch (Logs and Alarms)

```bash
# CloudWatch automatically collects logs from EKS pods
# Create a log group:
aws logs create-log-group --log-group-name /cloudretail/services --region eu-west-1

# Set up alarms based on alerting-rules.yml:
# monitoring/alerting-rules.yml contains rules for:
# - ServiceDown (service unavailable > 5 minutes)
# - HighErrorRate (error rate > 5%)
# - HighResponseTime (p95 > 2 seconds)
# - DatabaseDown
# - DiskSpaceLow
```

### 9.4 AWS SNS (Alert Notifications)

```bash
# Create an SNS topic for alerts:
aws sns create-topic --name cloudretail-alerts --region eu-west-1

# Subscribe your email:
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:<ACCOUNT_ID>:cloudretail-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

---

## 10. Setting Up CI/CD on AWS

### Using AWS CodePipeline

1. **Source Stage:** Connect to your GitHub repository
2. **Build Stage (AWS CodeBuild):**
   - Run tests (`npm test`)
   - Build Docker images
   - Push to AWS ECR
3. **Deploy Stage (AWS CodeDeploy):**
   - Update Kubernetes deployments on AWS EKS
   - Rolling update strategy (zero downtime)

### CodeBuild buildspec.yml Example

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
      # Repeat for other services...
  post_build:
    commands:
      - aws eks update-kubeconfig --name cloudretail-cluster --region eu-west-1
      - kubectl set image deployment/user-service user-service=$AWS_ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/cloudretail/user-service:latest -n cloudretail
```

---

## 11. Verifying Everything Works

### Local Verification

```bash
# 1. All containers running:
docker-compose ps

# 2. API Gateway responds:
curl http://localhost:8080/health

# 3. Can register and login:
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# 4. All tests pass:
npm test
```

### AWS Verification

```bash
# 1. All pods running on EKS:
kubectl get pods -n cloudretail

# 2. Services have endpoints:
kubectl get endpoints -n cloudretail

# 3. Ingress has external address:
kubectl get ingress -n cloudretail

# 4. HPA is active:
kubectl get hpa -n cloudretail

# 5. Test the external endpoint:
curl https://cloudretail.example.com/health
```

---

## 12. Common Issues and Troubleshooting

### "Port already in use"

```bash
# Find and kill the process using the port:
lsof -i :3001
kill -9 <PID>

# Or change the port in the .env file
```

### Docker containers won't start

```bash
# Check container logs:
docker-compose logs user-service

# Rebuild containers:
docker-compose build --no-cache
docker-compose up -d
```

### Database connection errors

```bash
# Check if PostgreSQL is running:
docker-compose ps postgres-users

# Check database logs:
docker-compose logs postgres-users

# Verify connection:
docker exec -it cloudretail_postgres-users_1 psql -U postgres -d cloudretail_users
```

### Kubernetes pods in CrashLoopBackOff

```bash
# Check pod logs:
kubectl logs <pod-name> -n cloudretail

# Check pod events:
kubectl describe pod <pod-name> -n cloudretail

# Common cause: incorrect ConfigMap/Secret values or database not reachable
```

### AWS EKS cluster not responding

```bash
# Update kubeconfig:
aws eks update-kubeconfig --name cloudretail-cluster --region eu-west-1

# Check cluster status:
aws eks describe-cluster --name cloudretail-cluster --region eu-west-1
```

### npm install fails

```bash
# Clear npm cache:
npm cache clean --force

# Delete node_modules and reinstall:
rm -rf node_modules
rm -rf services/*/node_modules
npm run install:all
```

---

## 13. Useful Commands Reference

### Docker Commands

```bash
npm run docker:build          # Build all images
npm run docker:up             # Start all containers
npm run docker:down           # Stop all containers
docker-compose ps             # List running containers
docker-compose logs -f        # Tail all logs
docker-compose down -v        # Stop and delete all data
```

### Kubernetes Commands (AWS EKS)

```bash
kubectl get pods -n cloudretail              # List all pods
kubectl get services -n cloudretail          # List all services
kubectl get hpa -n cloudretail               # Check auto-scaling
kubectl logs -f deployment/<name> -n cloudretail  # View service logs
kubectl describe pod <name> -n cloudretail   # Debug a pod
kubectl scale deployment <name> --replicas=5 -n cloudretail  # Manual scale
kubectl rollout restart deployment/<name> -n cloudretail      # Restart service
kubectl exec -it <pod-name> -n cloudretail -- /bin/sh         # Shell into pod
```

### AWS CLI Commands

```bash
aws eks list-clusters                        # List EKS clusters
aws ecr list-images --repository-name cloudretail/user-service  # List images
aws rds describe-db-instances                # List RDS databases
aws elasticache describe-cache-clusters      # List Redis clusters
aws logs tail /cloudretail/services --follow # Tail CloudWatch logs
```

### Testing Commands

```bash
npm test                      # Run all tests
npm run test:unit             # Unit tests only (605 tests)
npm run test:integration      # Integration tests (51 tests)
npm run test:performance      # Load tests with Artillery
```

### Service-Specific Commands

```bash
npm run dev:user              # Start User Service in dev mode
npm run dev:product           # Start Product Service in dev mode
npm run dev:order             # Start Order Service in dev mode
npm run dev:inventory         # Start Inventory Service in dev mode
npm run dev:payment           # Start Payment Service in dev mode
npm run dev:eventbus          # Start Event Bus in dev mode
npm run dev:gateway           # Start API Gateway in dev mode
```

---

## Summary of AWS Services You Will Set Up

| Step | AWS Service | What It Does |
|---|---|---|
| 7.3 | **AWS EKS** | Runs the Kubernetes cluster that hosts all containers |
| 7.4 | **AWS ECR** | Stores Docker images for all 7 services |
| 7.5 | **AWS RDS** | Hosts 5 PostgreSQL databases (one per microservice) |
| 7.6 | **AWS ElastiCache** | Hosts the Redis cache for sessions and API responses |
| 7.7 | **AWS MSK** | Hosts the Kafka cluster for event-driven messaging |
| 7.8 | **AWS Secrets Manager** | Securely stores passwords and API keys |
| 8.5 | **AWS ALB** | Load balances traffic to your services |
| 8.6 | **AWS Route 53** | Manages DNS for your domain |
| 9.1 | **AWS Managed Prometheus** | Collects metrics from all services |
| 9.2 | **AWS Managed Grafana** | Visualizes metrics in dashboards |
| 9.3 | **AWS CloudWatch** | Collects logs and triggers alarms |
| 9.4 | **AWS SNS** | Sends alert notifications (email, Slack) |
| 10 | **AWS CodePipeline/CodeBuild** | Automates build, test, and deploy |

---

*Document Version: 1.0 | February 2026 | COMP60010 Assignment*
