# CloudRetail - Viva Preparation Guide

**COMP60010: Enterprise Cloud and Distributed Web Applications**

This guide helps you demonstrate all AWS services and architectural decisions during your viva.

---

## 1. AWS Services Checklist - How to Show Each One

### Compute & Containers

| Service | How to demonstrate | CLI command |
|---------|-------------------|-------------|
| **EC2** | Show running instance | `aws ec2 describe-instances --region ap-southeast-1 --query "Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,State:State.Name,IP:PublicIpAddress}" --output table` |
| **ECR** | Show pushed Docker images | `aws ecr describe-repositories --region ap-southeast-1 --output table` |
| **ECR Images** | Show image tags | `aws ecr list-images --repository-name cloudretail/user-service --region ap-southeast-1 --output table` |

### Database

| Service | How to demonstrate | CLI command |
|---------|-------------------|-------------|
| **RDS (PostgreSQL)** | Show the single instance with 5 databases | `aws rds describe-db-instances --region ap-southeast-1 --query "DBInstances[].{ID:DBInstanceIdentifier,Engine:Engine,Class:DBInstanceClass,Status:DBInstanceStatus,Endpoint:Endpoint.Address}" --output table` |
| **RDS databases** | List all 5 databases | `docker run --rm -e PGPASSWORD=CloudRetail2026db postgres:15-alpine psql -h $RDS_HOST -U postgres -c "\l" \| grep cloudretail` |

### Networking & Security

| Service | How to demonstrate | CLI command |
|---------|-------------------|-------------|
| **VPC** | Show default VPC | `aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --region ap-southeast-1 --output table` |
| **Security Groups** | Show RDS and EC2 security groups | `aws ec2 describe-security-groups --filters "Name=group-name,Values=cloudretail-*" --region ap-southeast-1 --query "SecurityGroups[].{Name:GroupName,ID:GroupId,Description:Description}" --output table` |
| **Security Group Rules** | Show inbound rules | `aws ec2 describe-security-groups --filters "Name=group-name,Values=cloudretail-*" --region ap-southeast-1 --query "SecurityGroups[].{Name:GroupName,Inbound:IpPermissions}" --output json` |
| **IAM** | Show current user/role | `aws sts get-caller-identity` |

### Storage

| Service | How to demonstrate | CLI command |
|---------|-------------------|-------------|
| **ECR (image storage)** | Show total image size | `aws ecr describe-images --repository-name cloudretail/api-gateway --region ap-southeast-1 --query "imageDetails[].{Tag:imageTags[0],Size:imageSizeInBytes,Pushed:imagePushedAt}" --output table` |

---

## 2. Live Demo Script

Follow this order during the viva to show a complete working system.

### Step 1: Show AWS Infrastructure (2 minutes)

```bash
# Show your AWS account
aws sts get-caller-identity

# Show the RDS instance
aws rds describe-db-instances --region ap-southeast-1 \
  --query "DBInstances[].{ID:DBInstanceIdentifier,Engine:Engine,Version:EngineVersion,Class:DBInstanceClass,Status:DBInstanceStatus,AZ:AvailabilityZone,Endpoint:Endpoint.Address}" \
  --output table

# Show ECR repositories (container registry)
aws ecr describe-repositories --region ap-southeast-1 \
  --query "repositories[].{Name:repositoryName,URI:repositoryUri}" --output table

# Show EC2 instance
aws ec2 describe-instances --region ap-southeast-1 \
  --filters "Name=tag:Name,Values=cloudretail-server" \
  --query "Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,State:State.Name,IP:PublicIpAddress,AZ:Placement.AvailabilityZone}" \
  --output table

# Show security groups
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=cloudretail-*" \
  --region ap-southeast-1 \
  --query "SecurityGroups[].{Name:GroupName,ID:GroupId}" --output table
```

### Step 2: Show Running Containers (1 minute)

SSH into EC2 (or show locally):

```bash
# Show all running containers
docker compose ps

# Show container resource usage
docker stats --no-stream
```

### Step 3: Show the Application Working (3 minutes)

```bash
# Health check
curl http://localhost:8080/health

# Register a user
curl -s -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Demo","lastName":"User","email":"demo@viva.com","password":"Password123","role":"admin","gdprConsent":true}' | python3 -m json.tool

# Save the token (copy from response)
export TOKEN="paste-token-here"
export USER_ID="paste-user-id-here"

# Create a product
curl -s -X POST http://localhost:8080/api/products/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Demo Product\",\"description\":\"Created during viva\",\"price\":29.99,\"category\":\"electronics\",\"sku\":\"VIVA-001\",\"vendorId\":\"$USER_ID\"}" | python3 -m json.tool

# List products
curl -s http://localhost:8080/api/products/products | python3 -m json.tool

# Add inventory
export PRODUCT_ID="paste-product-id-here"
curl -s -X POST http://localhost:8080/api/inventory/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"productId\":\"$PRODUCT_ID\",\"quantity\":50,\"warehouseLocation\":\"SG-01\"}" | python3 -m json.tool

# Place an order
curl -s -X POST http://localhost:8080/api/orders/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"productName\":\"Demo Product\",\"quantity\":1,\"price\":29.99}],\"shippingAddress\":{\"street\":\"123 Demo St\",\"city\":\"Singapore\",\"state\":\"SG\",\"zipCode\":\"049712\",\"country\":\"Singapore\"}}" | python3 -m json.tool

# Show the order was created
curl -s http://localhost:8080/api/orders/orders \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Step 4: Show the Frontend (1 minute)

Open `http://localhost:3000` (or `http://<EC2_IP>:3000`) in the browser.

- Log in with the credentials you just created
- Navigate through Products, Orders, Inventory tabs
- Show the Admin Dashboard (architecture diagram, service health)

### Step 5: Show Microservice Logs (1 minute)

```bash
# Show API Gateway routing requests
docker compose logs api-gateway --tail 20

# Show user-service handling registration
docker compose logs user-service --tail 20

# Show event-bus processing events
docker compose logs event-bus --tail 20

# Show Redis (used for caching and pub/sub)
docker compose logs redis --tail 20
```

> **Note**: Kafka is not running on AWS free tier due to memory constraints. See Section 4 for the explanation.

---

## 3. Common Viva Questions and Answers

### Architecture Questions

**Q: Why microservices instead of a monolith?**
> Each service has a single responsibility (users, products, orders, inventory, payments). They can be developed, deployed, and scaled independently. If the payment service needs more capacity, we scale only that service. Each has its own database, preventing a single point of failure.

**Q: Why a single RDS instance with 5 databases instead of 5 RDS instances?**
> AWS free tier allows only 1 RDS instance. In production, you would use separate instances for true isolation. The 5 databases still provide logical separation - each service only connects to its own database, maintaining the database-per-service pattern.

**Q: How do services communicate?**
> Two patterns:
> - **Synchronous (HTTP/REST)**: API Gateway routes client requests to services. Order service calls inventory service to check stock and payment service to process payments.
> - **Asynchronous (Event-driven)**: Services publish events to the Event Bus, which routes them through Kafka topics. For example, when a product price changes, the product service publishes a `product-updated` event, and the inventory service subscribes to update its cache.

**Q: What is the API Gateway pattern?**
> The API Gateway is the single entry point for all client requests. It handles routing, authentication (JWT verification), rate limiting (100 req/15min), CORS, security headers, and request proxying. Clients never talk directly to microservices.

**Q: What design patterns did you use?**
> - **Database-per-service**: Each microservice has its own PostgreSQL database
> - **API Gateway**: Single entry point for all requests
> - **Event-driven architecture**: Kafka for async messaging between services
> - **Saga pattern**: Order creation coordinates inventory reservation and payment processing
> - **Circuit breaker**: Prevents cascading failures when a downstream service is unavailable
> - **Retry with exponential backoff**: Handles transient failures gracefully

### Security Questions

**Q: How is authentication implemented?**
> JWT (JSON Web Tokens) with bcrypt password hashing (12 salt rounds). User registers or logs in, gets a signed JWT token valid for 24 hours. The token contains the user ID and role. Every subsequent request includes the token in the Authorization header.

**Q: How does RBAC work?**
> Three roles: customer, vendor, admin. The JWT token contains the user's role. Each API endpoint checks the role:
> - Public: product listing, health checks
> - Authenticated: placing orders, viewing own orders
> - Admin/Vendor: creating products, managing inventory
> - Admin only: viewing all users, all orders

**Q: How is GDPR compliance handled?**
> - **Consent**: Registration requires explicit `gdprConsent: true`
> - **Right to access**: Users can GET their profile data
> - **Right to rectification**: Users can PUT to update their data
> - **Right to erasure**: Users can DELETE their account
> - **Data minimisation**: Only necessary fields are collected

**Q: What about PCI DSS?**
> - No raw credit card numbers are stored
> - All communication uses HTTPS/TLS
> - Payment tokens used instead of card data
> - Audit trails on all payment operations
> - Network segmentation (payment service isolated)

### Technical Questions

**Q: What happens when you place an order?**
> 1. Client sends POST to API Gateway at `/api/orders/orders`
> 2. Gateway verifies JWT token and proxies to Order Service
> 3. Order Service validates the request (Joi schema)
> 4. Order Service calls Inventory Service to check/reserve stock
> 5. Order Service calls Payment Service to process payment
> 6. If both succeed, order is created with status "confirmed"
> 7. Order Service publishes `order-created` event to Event Bus
> 8. Event Bus sends it to Kafka `order-events` topic
> 9. Other services (inventory, payment) can consume these events

**Q: What is Kafka used for?**
> Apache Kafka is a distributed message broker. Each service type has a topic (user-events, product-events, order-events, inventory-events, payment-events). Services publish events when state changes, and other services subscribe to relevant topics. This enables loose coupling - services don't need to know about each other directly.

**Q: Why Redis?**
> Redis serves two purposes:
> 1. **Caching**: Frequently accessed data (product listings, inventory counts) cached for fast reads
> 2. **Pub/Sub**: Cache invalidation across services - when a product price changes, Redis pub/sub notifies all services to update their local caches

**Q: How do you handle failures?**
> - **Health checks**: Every service has `/health` endpoint, Docker restarts unhealthy containers
> - **Circuit breakers**: If a downstream service fails 5 times, the circuit opens and requests fail fast instead of waiting
> - **Retry with backoff**: Transient failures are retried with exponential backoff (1s, 2s, 4s)
> - **Timeouts**: Event publishing has a 3-second AbortController timeout to prevent hanging
> - **Graceful degradation**: If the event bus is unavailable, operations still succeed (events are fire-and-forget)

### Deployment Questions

**Q: Walk me through the deployment process.**
> 1. Build Docker images for all 7 services (multi-stage builds with Alpine base)
> 2. Push images to AWS ECR (Elastic Container Registry)
> 3. Create RDS instance with 5 databases
> 4. Launch EC2 instance (t3.micro, free tier)
> 5. Install Docker and Docker Compose on EC2
> 6. Create production docker-compose.yml pointing services to RDS and ECR images
> 7. Run `docker-compose up -d`
> 8. Services connect to RDS via SSL, Sequelize auto-creates tables

**Q: What is ECR?**
> AWS Elastic Container Registry - a private Docker image registry. Instead of Docker Hub, we push our images to ECR in ap-southeast-1. The EC2 instance pulls images from ECR when starting containers.

**Q: Why Docker Compose on EC2 instead of EKS?**
> EKS (Elastic Kubernetes Service) costs ~$72/month just for the control plane. For a university assignment, Docker Compose on a single EC2 instance demonstrates containerized deployment within the free tier. The Kubernetes manifests are included in the repo to show production-readiness.

**Q: What region and why?**
> ap-southeast-1 (Singapore). Chosen for low latency from our location and availability of all required AWS services in the free tier.

---

## 4. Explaining Kafka / Free Tier Limitations

### Why Kafka is not running in AWS deployment

**The situation:**
Kafka requires minimum 1GB heap memory (`-Xmx1G -Xms1G`), but EC2 t3.micro only has 1GB total RAM. With 8 microservices + Redis + Zookeeper running, there's insufficient memory for Kafka.

**How to explain this in viva:**

> "In the local development environment, we run Apache Kafka for event-driven communication between microservices. However, the AWS free tier only provides t3.micro instances with 1GB RAM. Kafka alone requires 1GB heap memory, which makes it impossible to run alongside our 8 microservices on a single instance.
>
> In a production environment, we would use **AWS MSK (Managed Streaming for Apache Kafka)**, which is a fully managed Kafka service. MSK handles the infrastructure, scaling, and maintenance. However, MSK is not part of the free tier - the smallest MSK cluster costs approximately $150-200/month.
>
> For this demonstration, we've designed the application with **graceful degradation**. The event publishing is fire-and-forget with a 3-second timeout. If Kafka is unavailable, the core operations (user registration, product creation, order placement) still succeed - only the asynchronous event propagation is skipped. This demonstrates the resilience pattern recommended for microservices."

### Free Tier Alternatives for Event-Driven Architecture

| Option | Description | Cost |
|--------|-------------|------|
| **Redis Pub/Sub** (current) | Already running Redis - can use its pub/sub for lightweight messaging | Free (using existing Redis) |
| **AWS SNS + SQS** | Simple Notification Service + Simple Queue Service | Free tier: 1M SNS requests, 1M SQS requests/month |
| **AWS EventBridge** | Serverless event bus | Free tier: First 14M events/month |

### What we're using instead

The application currently uses **Redis Pub/Sub** for cache invalidation and lightweight event propagation. This is a valid alternative that:
- Runs within the t3.micro memory constraints
- Provides pub/sub messaging capabilities
- Is already part of our stack for caching

### Code showing graceful degradation

In the event publishers, we use AbortController with a 3-second timeout:

```typescript
// From services/*/src/services/*.service.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);

try {
  await fetch(eventBusUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    signal: controller.signal,
  });
} catch (error) {
  // Event publishing failed - log but don't fail the operation
  logger.warn('Event publishing failed', { error });
} finally {
  clearTimeout(timeoutId);
}
```

### If asked "Can you show Kafka working?"

1. **Local demo**: Run `docker-compose up -d` locally where Kafka works
2. **Explain**: "Kafka runs locally but not on AWS free tier due to memory constraints"
3. **Show the code**: Point to the Event Bus service and Kafka configuration files
4. **Show the alternative**: Demonstrate Redis is running and handling pub/sub

```bash
# On EC2, show Redis is running
docker-compose logs redis --tail 10

# Show event-bus is processing (via Redis fallback)
docker-compose logs event-bus --tail 20
```

---

## 5. Deployment Duration & Free Tier Limits

### Will my deployment last until the 13th?

**Yes**, as long as you don't exceed free tier limits:

| Resource | Free Tier Limit | Your Usage | Will it last? |
|----------|-----------------|------------|---------------|
| EC2 t3.micro | 750 hours/month | 24/7 = 744 hours | Yes |
| RDS db.t3.micro | 750 hours/month | 24/7 = 744 hours | Yes |
| ECR Storage | 500 MB/month | ~200 MB (8 images) | Yes |
| Data Transfer | 15 GB/month outbound | Minimal for demo | Yes |

### Important: Keep it running

- **DO NOT** stop the EC2 instance (you'll lose your running containers)
- **DO NOT** delete the RDS instance (you'll lose all data)
- The free tier resets on the 1st of each month

### Check your usage

```bash
# AWS Console > Billing > Free Tier
# Or via CLI (requires Cost Explorer access)
aws ce get-cost-and-usage \
  --time-period Start=2026-02-01,End=2026-02-28 \
  --granularity DAILY \
  --metrics "UnblendedCost"
```

### If something goes wrong before the 13th

1. **EC2 stopped accidentally**: Start it again, re-run `docker-compose up -d`
2. **RDS stopped accidentally**: Start it again, services will reconnect
3. **Containers crashed**: SSH in and run `docker-compose up -d`
4. **Out of memory**: Check `docker stats`, restart containers

### Quick recovery commands

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_IP

# Restore environment variables
export AWS_ACCOUNT_ID="850874728684"
export RDS_HOST="cloudretail-db.cjy40oge00uf.ap-southeast-1.rds.amazonaws.com"
export DB_PASSWORD="CloudRetail2026db"
export JWT_SECRET="cloudretail-jwt-secret-2026"
export ECR_PREFIX="$AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com"

# Restart all containers
docker-compose down
docker-compose up -d

# Verify
docker-compose ps
curl http://localhost:8080/health
```

---

## 7. Showing the Kubernetes Manifests

Even if not deployed on EKS, you can show the production-ready Kubernetes configuration:

```bash
# Show the manifest files
ls -la cloudretail/infrastructure/kubernetes/

# Show namespace
cat cloudretail/infrastructure/kubernetes/namespace.yaml

# Show configmap (environment variables)
cat cloudretail/infrastructure/kubernetes/configmap.yaml

# Show a service deployment (e.g., user-service)
cat cloudretail/infrastructure/kubernetes/user-service-deployment.yaml

# Show HPA (auto-scaling)
cat cloudretail/infrastructure/kubernetes/hpa.yaml

# Show network policies (zero-trust)
cat cloudretail/infrastructure/kubernetes/network-policy.yaml
```

Key points to mention:
- **22 manifest files** covering all aspects of production deployment
- **HPA**: Auto-scales from 3 to 20 replicas based on CPU/memory
- **Network policies**: Zero-trust - services can only communicate with explicitly allowed peers
- **Resource quotas**: Prevents runaway resource consumption
- **Health probes**: Liveness, readiness, and startup probes on every service
- **Secrets**: Database passwords and JWT secrets stored as Kubernetes Secrets (base64 encoded, encrypted at rest with KMS)

---

## 8. Showing the Monitoring Stack

Show the monitoring configuration files:

```bash
# Prometheus configuration
cat cloudretail/monitoring/prometheus.yml

# Grafana dashboard definition
cat cloudretail/monitoring/grafana-dashboard.json

# Alerting rules
cat cloudretail/monitoring/alerting-rules.yml

# Logging configuration
cat cloudretail/monitoring/logging-config.yaml
```

Key points:
- **Prometheus**: Scrapes metrics every 15 seconds from all services
- **Grafana**: 10+ pre-built dashboards for service health, business KPIs
- **Alerting**: 12+ alert rules (ServiceDown, HighErrorRate, HighResponseTime, etc.)
- **ELK Stack**: Centralized logging with JSON structured logs and correlation IDs
- **Retention**: Hot (7 days) -> Warm (30 days) -> Cold (90 days) -> Delete

---

## 9. Showing the Test Suite

```bash
# Show test files
find cloudretail/services -name "*.test.ts" -o -name "*.spec.ts" | head -20

# Run tests locally (if Node.js installed)
cd cloudretail && npm test

# Show test configuration
cat cloudretail/jest.config.ts
```

Key metrics:
- **605 unit tests** across all services (85% coverage)
- **51 integration tests** for cross-service workflows
- **Performance tests**: Artillery and k6 for load testing
- **Security tests**: OWASP Top 10 validation

---

## 10. Quick Reference - What to Say About Each AWS Service

| AWS Service | One-liner for viva |
|-------------|-------------------|
| **EC2** | Hosts our Docker Compose deployment on a t3.micro instance |
| **RDS** | Single PostgreSQL 15 instance with 5 logically separated databases |
| **ECR** | Private Docker registry storing all 8 container images |
| **VPC** | Default VPC providing network isolation for EC2 and RDS |
| **Security Groups** | Firewall rules allowing only ports 22, 3000, 5432, 8080 |
| **IAM** | Controls who can access AWS resources; used for ECR push/pull |
| **CloudWatch** | Available for EC2 instance monitoring (CPU, network, disk) |

### Services referenced in Kubernetes manifests (production-ready):

| AWS Service | One-liner for viva |
|-------------|-------------------|
| **EKS** | Managed Kubernetes for production container orchestration |
| **ALB** | Application Load Balancer for distributing traffic across pods |
| **Route 53** | DNS management and health-check based routing |
| **CloudFront** | CDN for serving frontend static assets globally |
| **S3** | Static asset storage and database backup archival |
| **KMS** | Encryption key management for Secrets and RDS encryption |
| **ACM** | TLS/SSL certificate management for HTTPS |
| **Secrets Manager** | Secure storage of database passwords and API keys |
| **WAF** | Web Application Firewall protecting against OWASP Top 10 |
| **MSK** | Managed Kafka for production event streaming |
| **ElastiCache** | Managed Redis for caching and session storage |
| **CloudWatch** | Metrics, logs, and alarms for all services |
| **X-Ray** | Distributed tracing across microservices |

---

*COMP60010 - Enterprise Cloud and Distributed Web Applications - Staffordshire University*
