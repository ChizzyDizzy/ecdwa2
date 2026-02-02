# CloudRetail Kubernetes Deployment Guide

This directory contains comprehensive Kubernetes deployment configurations for the CloudRetail microservices platform.

## Architecture Overview

CloudRetail is a cloud-native e-commerce platform built with a microservices architecture:

### Services
- **API Gateway** (Port 8080) - Entry point for all client requests
- **User Service** (Port 3001) - User authentication and management
- **Product Service** (Port 3002) - Product catalog management
- **Order Service** (Port 3003) - Order processing and management
- **Inventory Service** (Port 3004) - Inventory tracking and management
- **Payment Service** (Port 3005) - Payment processing
- **Event Bus** (Port 4000) - Event-driven communication hub

### Infrastructure
- **PostgreSQL** - 5 separate databases (one per service)
- **Redis** - Caching and event store
- **Kafka + Zookeeper** - Message broker for event streaming

## Files Overview

| File | Description |
|------|-------------|
| `namespace.yaml` | CloudRetail namespace definition |
| `configmap.yaml` | Environment variables and configuration |
| `secrets.yaml` | Sensitive data (passwords, API keys, JWT secrets) |
| `postgres-statefulset.yaml` | PostgreSQL StatefulSets for all 5 databases |
| `redis-deployment.yaml` | Redis cache deployment |
| `kafka-statefulset.yaml` | Kafka and Zookeeper StatefulSets |
| `user-service-deployment.yaml` | User service deployment with HPA |
| `product-service-deployment.yaml` | Product service deployment with HPA |
| `order-service-deployment.yaml` | Order service deployment with HPA |
| `inventory-service-deployment.yaml` | Inventory service deployment with HPA |
| `payment-service-deployment.yaml` | Payment service deployment with HPA |
| `event-bus-deployment.yaml` | Event bus deployment with HPA |
| `api-gateway-deployment.yaml` | API Gateway deployment with HPA |
| `ingress.yaml` | Ingress controller and SSL/TLS configuration |
| `hpa.yaml` | Horizontal Pod Autoscaler configurations |
| `network-policy.yaml` | Network security policies |
| `resource-quota.yaml` | Resource quotas and limits |

## Prerequisites

Before deploying, ensure you have:

1. **Kubernetes Cluster** (v1.24+)
   - AWS EKS, GKE, AKS, or self-managed
   - At least 3 worker nodes with 4 CPU and 16GB RAM each

2. **kubectl** configured and connected to your cluster

3. **Storage Class** configured (for PersistentVolumes)
   ```bash
   kubectl get storageclass
   ```

4. **Ingress Controller** (NGINX)
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
   ```

5. **Cert-Manager** (for SSL/TLS certificates)
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
   ```

6. **Metrics Server** (for HPA)
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

## Deployment Instructions

### Step 1: Update Configuration

1. **Edit `secrets.yaml`** - Replace all placeholder values with secure secrets:
   ```yaml
   DB_PASSWORD: "your-secure-database-password"
   JWT_SECRET: "your-secure-jwt-secret-min-32-chars"
   STRIPE_SECRET_KEY: "your-actual-stripe-key"
   # ... etc
   ```

2. **Edit `configmap.yaml`** - Update domain names and environment-specific values:
   ```yaml
   ALLOWED_ORIGINS: "https://your-domain.com"
   REGION: "your-aws-region"
   # ... etc
   ```

3. **Edit `ingress.yaml`** - Update domain names:
   ```yaml
   - host: api.your-domain.com
   - host: your-domain.com
   # ... etc
   ```

### Step 2: Build and Push Docker Images

Build and push all service images to your container registry:

```bash
# Build images
docker build -t your-registry/user-service:latest ./services/user-service
docker build -t your-registry/product-service:latest ./services/product-service
docker build -t your-registry/order-service:latest ./services/order-service
docker build -t your-registry/inventory-service:latest ./services/inventory-service
docker build -t your-registry/payment-service:latest ./services/payment-service
docker build -t your-registry/event-bus:latest ./event-bus
docker build -t your-registry/api-gateway:latest ./api-gateway

# Push images
docker push your-registry/user-service:latest
docker push your-registry/product-service:latest
docker push your-registry/order-service:latest
docker push your-registry/inventory-service:latest
docker push your-registry/payment-service:latest
docker push your-registry/event-bus:latest
docker push your-registry/api-gateway:latest
```

Update image references in deployment files to match your registry.

### Step 3: Deploy Infrastructure

Deploy in the following order:

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Apply resource quotas
kubectl apply -f resource-quota.yaml

# Create ConfigMap and Secrets
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml

# Deploy databases (PostgreSQL)
kubectl apply -f postgres-statefulset.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n cloudretail --timeout=300s

# Deploy Redis
kubectl apply -f redis-deployment.yaml

# Deploy Zookeeper and Kafka
kubectl apply -f kafka-statefulset.yaml

# Wait for Kafka to be ready
kubectl wait --for=condition=ready pod -l app=kafka -n cloudretail --timeout=300s
```

### Step 4: Deploy Microservices

```bash
# Deploy Event Bus first (other services depend on it)
kubectl apply -f event-bus-deployment.yaml

# Wait for Event Bus to be ready
kubectl wait --for=condition=ready pod -l app=event-bus -n cloudretail --timeout=180s

# Deploy all microservices
kubectl apply -f user-service-deployment.yaml
kubectl apply -f product-service-deployment.yaml
kubectl apply -f inventory-service-deployment.yaml
kubectl apply -f payment-service-deployment.yaml
kubectl apply -f order-service-deployment.yaml

# Deploy API Gateway
kubectl apply -f api-gateway-deployment.yaml
```

### Step 5: Configure Networking

```bash
# Apply network policies
kubectl apply -f network-policy.yaml

# Deploy Ingress and configure SSL
kubectl apply -f ingress.yaml

# Apply HPA configurations (if not already applied with deployments)
kubectl apply -f hpa.yaml
```

### Step 6: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n cloudretail

# Check services
kubectl get svc -n cloudretail

# Check ingress
kubectl get ingress -n cloudretail

# Check HPA status
kubectl get hpa -n cloudretail

# Check PersistentVolumeClaims
kubectl get pvc -n cloudretail
```

## Post-Deployment Tasks

### 1. Database Initialization

Initialize databases with schema and seed data:

```bash
# Port-forward to each service and run migrations
kubectl port-forward -n cloudretail svc/user-service 3001:3001
# Run migrations using your migration tool

# Repeat for other services
```

### 2. DNS Configuration

Point your domain to the Ingress LoadBalancer:

```bash
# Get the LoadBalancer external IP/hostname
kubectl get svc -n ingress-nginx

# Create DNS A/CNAME records:
# api.your-domain.com -> LoadBalancer IP/hostname
# your-domain.com -> LoadBalancer IP/hostname
```

### 3. SSL Certificate Verification

```bash
# Check certificate status
kubectl get certificate -n cloudretail
kubectl describe certificate cloudretail-tls-cert -n cloudretail
```

### 4. Monitoring Setup

Configure Prometheus and Grafana to scrape metrics:

```bash
# All services expose metrics on /metrics endpoint
# Prometheus annotations are already configured in deployments
```

## Scaling

### Manual Scaling

```bash
# Scale a specific service
kubectl scale deployment user-service -n cloudretail --replicas=5

# Scale multiple services
kubectl scale deployment product-service order-service -n cloudretail --replicas=5
```

### Auto-Scaling (HPA)

HPA is already configured for all services. Current settings:

| Service | Min Replicas | Max Replicas | CPU Target | Memory Target |
|---------|--------------|--------------|------------|---------------|
| User Service | 3 | 10 | 70% | 80% |
| Product Service | 3 | 10 | 70% | 80% |
| Order Service | 3 | 15 | 70% | 80% |
| Inventory Service | 3 | 10 | 70% | 80% |
| Payment Service | 3 | 15 | 70% | 80% |
| Event Bus | 3 | 10 | 70% | 80% |
| API Gateway | 3 | 20 | 70% | 80% |

Monitor HPA:
```bash
kubectl get hpa -n cloudretail -w
```

## Troubleshooting

### Check Pod Logs

```bash
# View logs for a specific pod
kubectl logs -n cloudretail <pod-name>

# Follow logs
kubectl logs -n cloudretail <pod-name> -f

# Previous container logs (if crashed)
kubectl logs -n cloudretail <pod-name> --previous
```

### Check Pod Status

```bash
# Describe pod for detailed information
kubectl describe pod -n cloudretail <pod-name>

# Get pod events
kubectl get events -n cloudretail --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it -n cloudretail <service-pod> -- sh
# Inside pod: nc -zv postgres-users-0.postgres-users 5432
```

### Network Policy Issues

If services can't communicate:

```bash
# Temporarily disable network policies for testing
kubectl delete networkpolicy --all -n cloudretail

# Re-apply after troubleshooting
kubectl apply -f network-policy.yaml
```

## Security Considerations

### Secrets Management

- **NEVER commit actual secrets to Git**
- Use Kubernetes External Secrets Operator or HashiCorp Vault in production
- Rotate secrets regularly

### Network Policies

- Zero-trust network model is enforced
- Only necessary communication paths are allowed
- Review and update policies as architecture evolves

### RBAC

Create appropriate ServiceAccounts and Roles:

```bash
# Example: Create read-only role for developers
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n cloudretail
kubectl create rolebinding dev-pod-reader --role=pod-reader --user=dev-user -n cloudretail
```

## Backup and Disaster Recovery

### Database Backups

```bash
# Create backup cronjob for PostgreSQL
# See backup-cronjob.yaml (create this file for automated backups)

# Manual backup example
kubectl exec -n cloudretail postgres-users-0 -- pg_dump -U postgres cloudretail_users > backup.sql
```

### Persistent Volume Snapshots

```bash
# Create VolumeSnapshot (if supported by your storage provider)
kubectl create volumesnapshot postgres-snapshot --source=postgres-users-pvc -n cloudretail
```

## Performance Tuning

### Resource Adjustments

Monitor actual resource usage and adjust requests/limits:

```bash
# View resource usage
kubectl top pods -n cloudretail
kubectl top nodes
```

### Database Optimization

- Configure PostgreSQL settings in StatefulSet
- Consider read replicas for high-read services
- Implement connection pooling

### Caching Strategy

- Redis is configured for event store and caching
- Implement application-level caching where appropriate
- Monitor cache hit rates

## Multi-Region Deployment

For multi-region high availability:

1. Deploy identical clusters in multiple regions
2. Use global load balancer (AWS Global Accelerator, GCP Load Balancer)
3. Implement database replication between regions
4. Use multi-region Kafka clusters or cloud-native alternatives

## Monitoring and Observability

### Prometheus Metrics

All services expose metrics at `/metrics` endpoint:

```bash
# Check metrics manually
kubectl port-forward -n cloudretail svc/user-service 3001:3001
curl http://localhost:3001/metrics
```

### Health Checks

All services implement:
- Liveness probe: `/health`
- Readiness probe: `/ready`

### Logging

Configure centralized logging:
- Use ELK Stack, Loki, or cloud-native logging
- All services log to stdout/stderr

## Cost Optimization

1. **Right-size resources**: Monitor and adjust CPU/memory requests
2. **Use spot instances**: For non-critical workloads
3. **Implement pod disruption budgets**: Allow safe node draining
4. **Use cluster autoscaler**: Scale nodes based on demand
5. **Optimize storage**: Use appropriate storage classes

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and Push Images
        run: |
          docker build -t registry/user-service:${{ github.sha }} ./services/user-service
          docker push registry/user-service:${{ github.sha }}
      - name: Update Kubernetes
        run: |
          kubectl set image deployment/user-service user-service=registry/user-service:${{ github.sha }} -n cloudretail
```

## Support and Maintenance

### Regular Maintenance Tasks

- [ ] Update Kubernetes cluster version (quarterly)
- [ ] Update container images (monthly)
- [ ] Rotate secrets (monthly)
- [ ] Review and update resource quotas (quarterly)
- [ ] Review HPA metrics and thresholds (monthly)
- [ ] Database vacuum and analyze (weekly)
- [ ] Review logs for errors (daily)
- [ ] Security scanning of images (on each build)

### Upgrade Strategy

Use rolling updates with zero downtime:

```bash
# Update image version
kubectl set image deployment/user-service user-service=registry/user-service:v2.0.0 -n cloudretail

# Monitor rollout
kubectl rollout status deployment/user-service -n cloudretail

# Rollback if needed
kubectl rollout undo deployment/user-service -n cloudretail
```

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager](https://cert-manager.io/)
- [Prometheus Operator](https://prometheus-operator.dev/)

## License

CloudRetail Platform - Internal Documentation

---

**Last Updated**: 2026-01-21
**Version**: 1.0.0
**Maintainer**: CloudRetail DevOps Team
