#!/bin/bash

# CloudRetail Kubernetes Deployment Script
# This script automates the deployment of the CloudRetail platform to Kubernetes

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="cloudretail"
TIMEOUT=300

# Functions
print_header() {
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    print_success "kubectl is installed"

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster. Please configure kubectl."
        exit 1
    fi
    print_success "Connected to Kubernetes cluster"

    # Check for required resources
    if ! kubectl get storageclass &> /dev/null; then
        print_warning "No storage class found. Make sure you have a default storage class configured."
    else
        print_success "Storage class available"
    fi

    # Check for metrics server (needed for HPA)
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        print_warning "Metrics server not found. HPA will not work without it."
        print_info "Install with: kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml"
    else
        print_success "Metrics server is running"
    fi
}

deploy_namespace() {
    print_header "Creating Namespace"

    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE already exists"
    else
        kubectl apply -f namespace.yaml
        print_success "Namespace $NAMESPACE created"
    fi
}

deploy_configuration() {
    print_header "Deploying Configuration"

    # Resource quotas
    kubectl apply -f resource-quota.yaml
    print_success "Resource quotas applied"

    # ConfigMap
    kubectl apply -f configmap.yaml
    print_success "ConfigMap applied"

    # Secrets
    print_warning "Deploying secrets - make sure you've updated secrets.yaml with actual values!"
    read -p "Have you updated secrets.yaml with real secrets? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_error "Please update secrets.yaml before deploying"
        exit 1
    fi

    kubectl apply -f secrets.yaml
    print_success "Secrets applied"
}

deploy_databases() {
    print_header "Deploying Databases"

    # PostgreSQL
    print_info "Deploying PostgreSQL StatefulSets..."
    kubectl apply -f postgres-statefulset.yaml
    print_success "PostgreSQL StatefulSets created"

    print_info "Waiting for PostgreSQL pods to be ready (this may take a few minutes)..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_error "PostgreSQL pods failed to become ready"
        exit 1
    }
    print_success "PostgreSQL pods are ready"

    # Redis
    print_info "Deploying Redis..."
    kubectl apply -f redis-deployment.yaml
    print_success "Redis deployed"

    print_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_error "Redis pod failed to become ready"
        exit 1
    }
    print_success "Redis is ready"
}

deploy_messaging() {
    print_header "Deploying Messaging Infrastructure"

    print_info "Deploying Kafka and Zookeeper..."
    kubectl apply -f kafka-statefulset.yaml
    print_success "Kafka and Zookeeper StatefulSets created"

    print_info "Waiting for Zookeeper pods to be ready..."
    sleep 10  # Give Zookeeper time to start initializing
    kubectl wait --for=condition=ready pod -l app=zookeeper -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_warning "Zookeeper pods may need more time to initialize"
    }
    print_success "Zookeeper pods are ready"

    print_info "Waiting for Kafka pods to be ready..."
    sleep 20  # Kafka needs Zookeeper to be fully ready
    kubectl wait --for=condition=ready pod -l app=kafka -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_warning "Kafka pods may need more time to initialize"
    }
    print_success "Kafka pods are ready"
}

deploy_services() {
    print_header "Deploying Microservices"

    # Event Bus first (other services depend on it)
    print_info "Deploying Event Bus..."
    kubectl apply -f event-bus-deployment.yaml
    print_success "Event Bus deployment created"

    print_info "Waiting for Event Bus to be ready..."
    kubectl wait --for=condition=ready pod -l app=event-bus -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_error "Event Bus pods failed to become ready"
        exit 1
    }
    print_success "Event Bus is ready"

    # Deploy all microservices
    print_info "Deploying User Service..."
    kubectl apply -f user-service-deployment.yaml
    print_success "User Service deployment created"

    print_info "Deploying Product Service..."
    kubectl apply -f product-service-deployment.yaml
    print_success "Product Service deployment created"

    print_info "Deploying Inventory Service..."
    kubectl apply -f inventory-service-deployment.yaml
    print_success "Inventory Service deployment created"

    print_info "Deploying Payment Service..."
    kubectl apply -f payment-service-deployment.yaml
    print_success "Payment Service deployment created"

    print_info "Deploying Order Service..."
    kubectl apply -f order-service-deployment.yaml
    print_success "Order Service deployment created"

    print_info "Deploying API Gateway..."
    kubectl apply -f api-gateway-deployment.yaml
    print_success "API Gateway deployment created"

    print_info "Waiting for all services to be ready..."
    sleep 30  # Give services time to initialize

    kubectl wait --for=condition=ready pod -l component=microservice -n $NAMESPACE --timeout=${TIMEOUT}s || {
        print_warning "Some services may need more time to become ready"
    }
    print_success "Microservices are deploying"
}

deploy_networking() {
    print_header "Deploying Networking"

    # Network Policies
    print_info "Applying Network Policies..."
    kubectl apply -f network-policy.yaml
    print_success "Network Policies applied"

    # Ingress
    print_info "Deploying Ingress..."
    print_warning "Make sure you've updated domain names in ingress.yaml!"
    kubectl apply -f ingress.yaml
    print_success "Ingress deployed"

    # HPA (if not already applied with deployments)
    print_info "Applying HPA configurations..."
    kubectl apply -f hpa.yaml
    print_success "HPA configurations applied"
}

show_status() {
    print_header "Deployment Status"

    print_info "Pods:"
    kubectl get pods -n $NAMESPACE

    echo ""
    print_info "Services:"
    kubectl get svc -n $NAMESPACE

    echo ""
    print_info "Ingress:"
    kubectl get ingress -n $NAMESPACE

    echo ""
    print_info "HPA:"
    kubectl get hpa -n $NAMESPACE

    echo ""
    print_info "PVCs:"
    kubectl get pvc -n $NAMESPACE
}

show_next_steps() {
    print_header "Next Steps"

    echo "1. Get the LoadBalancer IP/hostname:"
    echo "   kubectl get svc -n ingress-nginx"
    echo ""
    echo "2. Configure DNS records to point to the LoadBalancer"
    echo ""
    echo "3. Wait for SSL certificates to be issued:"
    echo "   kubectl get certificate -n $NAMESPACE"
    echo ""
    echo "4. Initialize databases with schema and seed data"
    echo ""
    echo "5. Test the API Gateway:"
    GATEWAY_IP=$(kubectl get svc api-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
    if [ "$GATEWAY_IP" != "pending" ]; then
        echo "   curl http://$GATEWAY_IP/health"
    else
        echo "   kubectl port-forward -n $NAMESPACE svc/api-gateway 8080:8080"
        echo "   curl http://localhost:8080/health"
    fi
    echo ""
    echo "6. Monitor pods and logs:"
    echo "   kubectl logs -f -n $NAMESPACE -l app=api-gateway"
    echo ""
    print_success "CloudRetail deployment completed!"
}

rollback_deployment() {
    print_header "Rolling Back Deployment"
    print_warning "This will delete all CloudRetail resources!"
    read -p "Are you sure you want to rollback? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_info "Rollback cancelled"
        exit 0
    fi

    print_info "Deleting all resources..."
    kubectl delete namespace $NAMESPACE
    print_success "Rollback complete"
}

# Main deployment flow
main() {
    case "${1:-deploy}" in
        deploy)
            print_header "CloudRetail Kubernetes Deployment"
            check_prerequisites
            deploy_namespace
            deploy_configuration
            deploy_databases
            deploy_messaging
            deploy_services
            deploy_networking
            show_status
            show_next_steps
            ;;

        status)
            show_status
            ;;

        rollback)
            rollback_deployment
            ;;

        update)
            print_header "Updating CloudRetail Services"
            kubectl apply -f configmap.yaml
            kubectl apply -f user-service-deployment.yaml
            kubectl apply -f product-service-deployment.yaml
            kubectl apply -f order-service-deployment.yaml
            kubectl apply -f inventory-service-deployment.yaml
            kubectl apply -f payment-service-deployment.yaml
            kubectl apply -f event-bus-deployment.yaml
            kubectl apply -f api-gateway-deployment.yaml
            print_success "Services updated"
            show_status
            ;;

        *)
            echo "Usage: $0 {deploy|status|rollback|update}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment of CloudRetail platform"
            echo "  status   - Show current deployment status"
            echo "  rollback - Remove all CloudRetail resources"
            echo "  update   - Update service deployments"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
