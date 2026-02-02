# CloudRetail Monitoring Setup Guide

Comprehensive monitoring infrastructure for the CloudRetail microservices platform using Prometheus, Grafana, and ELK/EFK stack.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Components](#components)
- [Setup Instructions](#setup-instructions)
- [Accessing Dashboards](#accessing-dashboards)
- [Alerting](#alerting)
- [Logging](#logging)
- [Metrics Reference](#metrics-reference)
- [Troubleshooting](#troubleshooting)

## Overview

The CloudRetail monitoring stack provides:

- **Metrics Collection**: Prometheus for time-series metrics
- **Visualization**: Grafana dashboards for real-time insights
- **Alerting**: Prometheus Alertmanager for proactive notifications
- **Logging**: ELK/EFK stack for centralized log management
- **Tracing**: Distributed tracing (optional with Jaeger/Zipkin)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudRetail Services                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   API    │  │   User   │  │  Order   │  │ Payment  │   │
│  │ Gateway  │  │ Service  │  │ Service  │  │ Service  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │           │
│       └─────────────┴─────────────┴─────────────┘           │
│                         │                                    │
└─────────────────────────┼────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
      ┌───────▼────────┐      ┌──────▼──────┐
      │   Prometheus   │      │   Fluentd   │
      │                │      │  /Logstash  │
      └───────┬────────┘      └──────┬──────┘
              │                      │
      ┌───────▼────────┐      ┌──────▼──────────┐
      │    Grafana     │      │ Elasticsearch   │
      │   Dashboards   │      └──────┬──────────┘
      └────────────────┘             │
                              ┌──────▼──────┐
                              │   Kibana    │
                              └─────────────┘
```

## Components

### 1. Prometheus

**Purpose**: Time-series metrics collection and storage

**Configuration**: `prometheus.yml`

**Default Port**: 9090

**Features**:
- Service discovery (Kubernetes & static)
- Multi-target scraping
- Recording and alerting rules
- Long-term storage integration

### 2. Grafana

**Purpose**: Metrics visualization and dashboards

**Configuration**: `grafana-dashboard.json`

**Default Port**: 3000

**Dashboards**:
- CloudRetail Overview
- Service-specific metrics
- Infrastructure metrics
- Business metrics

### 3. Alertmanager

**Purpose**: Alert routing and notification

**Configuration**: `alerting-rules.yml`

**Default Port**: 9093

**Supported Channels**:
- Email
- Slack
- PagerDuty
- Webhook
- OpsGenie

### 4. ELK/EFK Stack

**Purpose**: Centralized logging

**Configuration**: `logging-config.yaml`

**Components**:
- **Elasticsearch**: Log storage and search (Port: 9200)
- **Logstash/Fluentd**: Log aggregation and processing
- **Kibana**: Log visualization (Port: 5601)
- **Filebeat**: Log shipping agent

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Kubernetes cluster (for K8s deployment)
- kubectl (for K8s deployment)
- Sufficient disk space for logs and metrics (recommended: 100GB+)

### Docker Compose Setup

1. **Start the monitoring stack**:

```bash
cd /home/user/ecdwa2/cloudretail

# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d
```

2. **Verify services are running**:

```bash
docker-compose -f docker-compose.monitoring.yml ps
```

3. **Check service health**:

```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3000/api/health

# Elasticsearch
curl http://localhost:9200/_cluster/health
```

### Kubernetes Deployment

1. **Create monitoring namespace**:

```bash
kubectl create namespace cloudretail-monitoring
```

2. **Deploy Prometheus**:

```bash
kubectl apply -f infrastructure/kubernetes/monitoring/prometheus.yaml
```

3. **Deploy Grafana**:

```bash
kubectl apply -f infrastructure/kubernetes/monitoring/grafana.yaml
```

4. **Deploy ELK stack**:

```bash
kubectl apply -f infrastructure/kubernetes/monitoring/elasticsearch.yaml
kubectl apply -f infrastructure/kubernetes/monitoring/logstash.yaml
kubectl apply -f infrastructure/kubernetes/monitoring/kibana.yaml
```

5. **Verify deployments**:

```bash
kubectl get pods -n cloudretail-monitoring
kubectl get services -n cloudretail-monitoring
```

### Configuration

#### Prometheus

1. **Edit Prometheus configuration**:

```bash
vim monitoring/prometheus.yml
```

2. **Reload configuration** (without restart):

```bash
curl -X POST http://localhost:9090/-/reload
```

#### Grafana

1. **Import dashboards**:

- Access Grafana: http://localhost:3000
- Go to Dashboards → Import
- Upload `grafana-dashboard.json`

2. **Configure data sources**:

```bash
# Add Prometheus data source
curl -X POST http://admin:admin@localhost:3000/api/datasources \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Prometheus",
    "type":"prometheus",
    "url":"http://prometheus:9090",
    "access":"proxy",
    "isDefault":true
  }'
```

#### Alertmanager

1. **Configure alert routing**:

Create `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#cloudretail-alerts'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical-alerts'
    slack_configs:
      - channel: '#cloudretail-critical'
        text: '🚨 *CRITICAL*: {{ .GroupLabels.alertname }}\n{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'warning-alerts'
    slack_configs:
      - channel: '#cloudretail-alerts'
        text: '⚠️  WARNING: {{ .GroupLabels.alertname }}\n{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

2. **Apply configuration**:

```bash
kubectl create configmap alertmanager-config \
  --from-file=alertmanager.yml \
  -n cloudretail-monitoring
```

## Accessing Dashboards

### Local Development

| Service        | URL                          | Credentials        |
|----------------|------------------------------|--------------------|
| Prometheus     | http://localhost:9090        | -                  |
| Grafana        | http://localhost:3000        | admin / admin      |
| Alertmanager   | http://localhost:9093        | -                  |
| Kibana         | http://localhost:5601        | elastic / changeme |
| Elasticsearch  | http://localhost:9200        | elastic / changeme |

### Production (Kubernetes)

```bash
# Port forward to access services
kubectl port-forward -n cloudretail-monitoring svc/grafana 3000:3000
kubectl port-forward -n cloudretail-monitoring svc/prometheus 9090:9090
kubectl port-forward -n cloudretail-monitoring svc/kibana 5601:5601
```

## Alerting

### Alert Categories

1. **Service Health** (`severity: critical`)
   - ServiceDown
   - ServiceFlapping
   - HighRestartRate

2. **Performance** (`severity: warning/critical`)
   - HighResponseTime
   - CriticalResponseTime
   - HighThroughputDrop

3. **Error Rates** (`severity: warning/critical`)
   - HighErrorRate
   - CriticalErrorRate
   - HighClientErrorRate

4. **Resources** (`severity: warning/critical`)
   - HighMemoryUsage
   - CriticalMemoryUsage
   - HighCPUUsage

5. **Business Metrics** (`severity: warning/critical`)
   - HighOrderFailureRate
   - PaymentProcessingFailures
   - LowOrderVolume

### Testing Alerts

```bash
# Trigger a test alert
curl -X POST http://localhost:9090/api/v1/alerts

# View active alerts
curl http://localhost:9090/api/v1/alerts | jq
```

### Silencing Alerts

```bash
# Silence an alert for 2 hours
curl -X POST http://localhost:9093/api/v2/silences \
  -H 'Content-Type: application/json' \
  -d '{
    "matchers": [{"name":"alertname","value":"HighMemoryUsage","isRegex":false}],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "endsAt": "'$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%S.000Z)'",
    "comment": "Planned maintenance",
    "createdBy": "admin"
  }'
```

## Logging

### Log Levels

- **DEBUG**: Detailed debugging information
- **INFO**: General informational messages
- **WARN**: Warning messages
- **ERROR**: Error messages
- **FATAL**: Critical errors requiring immediate attention

### Searching Logs

#### Kibana

1. Access Kibana: http://localhost:5601
2. Go to Discover
3. Use Kibana Query Language (KQL):

```
# Find all errors
level:ERROR

# Find errors in specific service
level:ERROR AND service:order-service

# Find slow requests
duration:>1000

# Find by request ID
request_id:"abc123"

# Time range queries
@timestamp:[now-1h TO now]
```

#### ElasticSearch API

```bash
# Search for errors
curl -X GET "localhost:9200/cloudretail-*/_search?pretty" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": {
      "bool": {
        "must": [
          {"match": {"level": "ERROR"}},
          {"range": {"@timestamp": {"gte": "now-1h"}}}
        ]
      }
    }
  }'
```

### Log Retention

Default retention policy:
- **Hot tier**: Last 7 days (immediate access)
- **Warm tier**: 8-30 days (slower access)
- **Cold tier**: 31-90 days (archived)
- **Delete**: After 90 days

Modify in `logging-config.yaml` → `ilm_policy`.

## Metrics Reference

### Application Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `http_requests_total` | Counter | Total HTTP requests |
| `http_request_duration_milliseconds` | Histogram | Request duration |
| `http_requests_in_flight` | Gauge | Current in-flight requests |
| `orders_total` | Counter | Total orders created |
| `orders_failed_total` | Counter | Failed orders |
| `payments_processed_total` | Counter | Successful payments |
| `payments_failed_total` | Counter | Failed payments |
| `inventory_stock_level` | Gauge | Current stock levels |

### Infrastructure Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `process_cpu_seconds_total` | Counter | CPU time consumed |
| `process_resident_memory_bytes` | Gauge | Memory usage |
| `process_open_fds` | Gauge | Open file descriptors |
| `nodejs_heap_size_used_bytes` | Gauge | Node.js heap usage |
| `pg_stat_database_numbackends` | Gauge | Database connections |
| `redis_connected_clients` | Gauge | Redis clients |
| `rabbitmq_queue_messages_ready` | Gauge | Messages in queue |

### Custom Business Metrics

Instrument your code to expose custom metrics:

```typescript
// Example: Track order processing time
import { Histogram } from 'prom-client';

const orderProcessingDuration = new Histogram({
  name: 'order_processing_duration_seconds',
  help: 'Time to process an order',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Usage
const timer = orderProcessingDuration.startTimer();
try {
  await processOrder(order);
  timer({ status: 'success' });
} catch (error) {
  timer({ status: 'failure' });
}
```

## Troubleshooting

### Prometheus

**Issue**: Targets are down

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq

# Check service connectivity
curl http://user-service:3001/metrics
```

**Issue**: High memory usage

```bash
# Reduce retention period in prometheus.yml
--storage.tsdb.retention.time=15d

# Enable compression
--storage.tsdb.compression=true
```

### Grafana

**Issue**: Dashboard not loading

```bash
# Check Grafana logs
docker logs grafana

# Verify Prometheus data source
curl http://localhost:3000/api/datasources
```

**Issue**: No data in panels

- Verify Prometheus is collecting metrics
- Check time range in dashboard
- Verify metric names in queries

### Elasticsearch

**Issue**: Cluster health is yellow/red

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health?pretty

# Check shard allocation
curl http://localhost:9200/_cat/shards?v

# Resolve yellow status (increase replicas)
curl -X PUT http://localhost:9200/_settings \
  -H 'Content-Type: application/json' \
  -d '{"index": {"number_of_replicas": 0}}'
```

**Issue**: Out of disk space

```bash
# Clean old indices
curl -X DELETE http://localhost:9200/cloudretail-2024.01.*

# Enable ILM policy to auto-delete
# See logging-config.yaml → ilm_policy
```

### Kibana

**Issue**: Cannot connect to Elasticsearch

```bash
# Check Kibana configuration
cat /etc/kibana/kibana.yml | grep elasticsearch

# Verify network connectivity
docker exec -it kibana ping elasticsearch
```

## Best Practices

1. **Metrics**:
   - Use consistent naming conventions
   - Include relevant labels (service, environment, region)
   - Set appropriate cardinality (avoid high-cardinality labels)
   - Use histograms for latencies, counters for events

2. **Alerts**:
   - Set meaningful thresholds based on SLOs
   - Avoid alert fatigue (tune sensitivity)
   - Include runbook links in annotations
   - Use alert grouping to reduce noise

3. **Logging**:
   - Use structured logging (JSON format)
   - Include correlation IDs for tracing
   - Log at appropriate levels
   - Sanitize sensitive data

4. **Dashboards**:
   - Follow the "USE Method" (Utilization, Saturation, Errors)
   - Create service-specific dashboards
   - Include SLI/SLO visualizations
   - Use variables for flexibility

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Elasticsearch Guide](https://www.elastic.co/guide/)
- [CloudRetail Runbooks](../docs/runbooks/)
- [SRE Best Practices](../docs/sre/)

## Support

For issues or questions:
- Create an issue in the repository
- Contact the CloudRetail SRE team
- Check the internal wiki for additional documentation
