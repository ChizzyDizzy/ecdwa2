# CloudRetail Kubernetes Quick Reference

## Quick Deployment

```bash
# Navigate to kubernetes directory
cd /home/user/ecdwa2/cloudretail/infrastructure/kubernetes

# Run deployment script
./deploy.sh deploy

# Or use kubectl directly
kubectl apply -k .  # Using kustomize

# Or apply manually in order
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f postgres-statefulset.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f kafka-statefulset.yaml
kubectl apply -f event-bus-deployment.yaml
kubectl apply -f user-service-deployment.yaml
kubectl apply -f product-service-deployment.yaml
kubectl apply -f order-service-deployment.yaml
kubectl apply -f inventory-service-deployment.yaml
kubectl apply -f payment-service-deployment.yaml
kubectl apply -f api-gateway-deployment.yaml
kubectl apply -f ingress.yaml
kubectl apply -f network-policy.yaml
```

## Common Commands

### View Resources

```bash
# All pods
kubectl get pods -n cloudretail

# All services
kubectl get svc -n cloudretail

# All deployments
kubectl get deployments -n cloudretail

# All statefulsets
kubectl get statefulsets -n cloudretail

# HPA status
kubectl get hpa -n cloudretail

# Ingress
kubectl get ingress -n cloudretail

# PVCs
kubectl get pvc -n cloudretail

# Events
kubectl get events -n cloudretail --sort-by='.lastTimestamp'
```

### Logs

```bash
# Service logs
kubectl logs -f -n cloudretail -l app=user-service
kubectl logs -f -n cloudretail -l app=product-service
kubectl logs -f -n cloudretail -l app=order-service
kubectl logs -f -n cloudretail -l app=inventory-service
kubectl logs -f -n cloudretail -l app=payment-service
kubectl logs -f -n cloudretail -l app=event-bus
kubectl logs -f -n cloudretail -l app=api-gateway

# Specific pod logs
kubectl logs -f -n cloudretail <pod-name>

# Previous container logs (if crashed)
kubectl logs -n cloudretail <pod-name> --previous

# All containers in a pod
kubectl logs -f -n cloudretail <pod-name> --all-containers
```

### Debugging

```bash
# Describe pod
kubectl describe pod -n cloudretail <pod-name>

# Execute command in pod
kubectl exec -it -n cloudretail <pod-name> -- sh

# Port forward to service
kubectl port-forward -n cloudretail svc/api-gateway 8080:8080
kubectl port-forward -n cloudretail svc/user-service 3001:3001

# Get pod yaml
kubectl get pod -n cloudretail <pod-name> -o yaml

# Check resource usage
kubectl top pods -n cloudretail
kubectl top nodes
```

### Scaling

```bash
# Manual scale
kubectl scale deployment user-service -n cloudretail --replicas=5

# View HPA
kubectl get hpa -n cloudretail
kubectl describe hpa user-service-hpa -n cloudretail

# Edit HPA
kubectl edit hpa user-service-hpa -n cloudretail
```

### Updates and Rollbacks

```bash
# Update image
kubectl set image deployment/user-service user-service=registry/user-service:v2.0.0 -n cloudretail

# Check rollout status
kubectl rollout status deployment/user-service -n cloudretail

# Rollout history
kubectl rollout history deployment/user-service -n cloudretail

# Rollback to previous version
kubectl rollout undo deployment/user-service -n cloudretail

# Rollback to specific revision
kubectl rollout undo deployment/user-service --to-revision=2 -n cloudretail

# Restart deployment (rolling restart)
kubectl rollout restart deployment/user-service -n cloudretail
```

### Configuration Updates

```bash
# Update ConfigMap
kubectl edit configmap cloudretail-config -n cloudretail
# Or
kubectl apply -f configmap.yaml

# Update Secrets
kubectl edit secret cloudretail-secrets -n cloudretail
# Or
kubectl apply -f secrets.yaml

# Restart pods to pick up new config
kubectl rollout restart deployment/user-service -n cloudretail
```

### Database Operations

```bash
# Connect to PostgreSQL
kubectl exec -it -n cloudretail postgres-users-0 -- psql -U postgres -d cloudretail_users

# Backup database
kubectl exec -n cloudretail postgres-users-0 -- pg_dump -U postgres cloudretail_users > backup.sql

# Restore database
kubectl exec -i -n cloudretail postgres-users-0 -- psql -U postgres cloudretail_users < backup.sql

# Connect to Redis
kubectl exec -it -n cloudretail <redis-pod-name> -- redis-cli
```

### Networking

```bash
# Test connectivity between services
kubectl exec -it -n cloudretail <pod-name> -- sh
# Inside pod:
nc -zv user-service.cloudretail.svc.cluster.local 3001
curl http://user-service.cloudretail.svc.cluster.local:3001/health

# View network policies
kubectl get networkpolicies -n cloudretail

# Describe network policy
kubectl describe networkpolicy user-service-network-policy -n cloudretail

# Temporarily disable network policies (for testing)
kubectl delete networkpolicy --all -n cloudretail
# Re-apply
kubectl apply -f network-policy.yaml
```

### Ingress and SSL

```bash
# Get LoadBalancer IP
kubectl get svc -n ingress-nginx

# Check Ingress
kubectl describe ingress cloudretail-ingress -n cloudretail

# Check SSL certificate status
kubectl get certificate -n cloudretail
kubectl describe certificate cloudretail-tls-cert -n cloudretail

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager
```

### Resource Management

```bash
# View resource quotas
kubectl get resourcequota -n cloudretail
kubectl describe resourcequota cloudretail-resource-quota -n cloudretail

# View limit ranges
kubectl get limitrange -n cloudretail
kubectl describe limitrange cloudretail-limit-range -n cloudretail
```

### Cleanup

```bash
# Delete all resources (DANGER!)
kubectl delete namespace cloudretail

# Delete specific resources
kubectl delete deployment user-service -n cloudretail
kubectl delete svc user-service -n cloudretail

# Delete all deployments
kubectl delete deployments --all -n cloudretail

# Delete all pods (will be recreated by deployments)
kubectl delete pods --all -n cloudretail
```

## Health Checks

```bash
# Check all services health
for service in user-service product-service order-service inventory-service payment-service api-gateway event-bus; do
  echo "Checking $service..."
  kubectl exec -n cloudretail deploy/$service -- curl -s http://localhost:${PORT:-8080}/health || echo "Failed"
done

# Or port-forward and check locally
kubectl port-forward -n cloudretail svc/api-gateway 8080:8080 &
curl http://localhost:8080/health
kill %1
```

## Monitoring

```bash
# Watch pods
kubectl get pods -n cloudretail -w

# Watch HPA
kubectl get hpa -n cloudretail -w

# Watch events
kubectl get events -n cloudretail -w

# Resource usage
watch kubectl top pods -n cloudretail
```

## Troubleshooting Checklist

1. **Pods not starting**
   ```bash
   kubectl describe pod <pod-name> -n cloudretail
   kubectl logs <pod-name> -n cloudretail
   ```

2. **Service not accessible**
   ```bash
   kubectl get svc -n cloudretail
   kubectl get endpoints -n cloudretail
   kubectl describe svc <service-name> -n cloudretail
   ```

3. **Database connection issues**
   ```bash
   kubectl get pods -l app=postgres -n cloudretail
   kubectl exec -it <service-pod> -n cloudretail -- nc -zv <db-host> 5432
   ```

4. **Ingress not working**
   ```bash
   kubectl get ingress -n cloudretail
   kubectl describe ingress cloudretail-ingress -n cloudretail
   kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
   ```

5. **HPA not scaling**
   ```bash
   kubectl get hpa -n cloudretail
   kubectl describe hpa <hpa-name> -n cloudretail
   kubectl top pods -n cloudretail
   # Check metrics server
   kubectl get deployment metrics-server -n kube-system
   ```

6. **Out of resources**
   ```bash
   kubectl describe node <node-name>
   kubectl top nodes
   kubectl get resourcequota -n cloudretail
   ```

## Performance Testing

```bash
# Simple load test with Apache Bench
kubectl run -it --rm load-test --image=httpd:alpine --restart=Never -- ab -n 10000 -c 100 http://api-gateway.cloudretail.svc.cluster.local:8080/

# Or with curl in a loop
for i in {1..1000}; do
  curl -s http://<api-gateway-ip>/api/products > /dev/null &
done
wait

# Monitor during load test
kubectl top pods -n cloudretail
kubectl get hpa -n cloudretail -w
```

## Backup and Restore

```bash
# Backup all configs
kubectl get all,configmap,secret,pvc,ingress -n cloudretail -o yaml > cloudretail-backup.yaml

# Backup specific resource
kubectl get deployment user-service -n cloudretail -o yaml > user-service-backup.yaml

# Restore from backup
kubectl apply -f cloudretail-backup.yaml
```

## Emergency Procedures

### Complete System Restart

```bash
# Restart all services (rolling restart)
kubectl rollout restart deployment -n cloudretail

# Force delete stuck pods
kubectl delete pod <pod-name> -n cloudretail --grace-period=0 --force
```

### Scale Down (Maintenance Mode)

```bash
# Scale all services to 0
kubectl scale deployment --all --replicas=0 -n cloudretail

# Scale specific service to 0
kubectl scale deployment user-service --replicas=0 -n cloudretail

# Scale back up
kubectl scale deployment --all --replicas=3 -n cloudretail
```

### Emergency Rollback

```bash
# Rollback all deployments
for deployment in $(kubectl get deployments -n cloudretail -o name); do
  kubectl rollout undo $deployment -n cloudretail
done
```

## Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# CloudRetail aliases
alias kcr='kubectl -n cloudretail'
alias kcrp='kubectl get pods -n cloudretail'
alias kcrs='kubectl get svc -n cloudretail'
alias kcrl='kubectl logs -n cloudretail'
alias kcrd='kubectl describe -n cloudretail'
alias kcrx='kubectl exec -it -n cloudretail'

# Usage examples:
# kcrp                          # List all pods
# kcrl user-service-xxx         # View logs
# kcrd pod user-service-xxx     # Describe pod
# kcrx user-service-xxx -- sh   # Exec into pod
```

## Important URLs

After deployment, access services at:

- **API Gateway**: https://api.cloudretail.example.com or https://cloudretail.example.com
- **Service Endpoints**: https://services.cloudretail.example.com/{service-name}
- **Health Checks**: https://api.cloudretail.example.com/health

## Environment Variables

Key environment variables defined in ConfigMap:

- `NODE_ENV`: production
- `LOG_LEVEL`: info
- Service URLs: `*_SERVICE_URL`
- Database configs: `DB_HOST_*`, `DB_NAME_*`
- Kafka: `KAFKA_BROKERS`
- Redis: `REDIS_URL`

## Default Credentials

**CHANGE THESE IN PRODUCTION!**

See `secrets.yaml` for all default values that need to be updated.

## Support

For issues, check:
1. Pod logs: `kubectl logs -f -n cloudretail <pod-name>`
2. Events: `kubectl get events -n cloudretail --sort-by='.lastTimestamp'`
3. Resource usage: `kubectl top pods -n cloudretail`
4. Network policies: `kubectl get networkpolicies -n cloudretail`

---

**Last Updated**: 2026-01-21
