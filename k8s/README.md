# TinyOlly Kubernetes Deployment

This directory contains Kubernetes manifests and helper scripts for deploying TinyOlly to a Kubernetes cluster (tested with Minikube).

## Quick Start

### 1. Start Minikube

```bash
minikube start
```

### 2. Build Images (Minikube Only)

Build Docker images in Minikube's environment:

```bash
./build-images.sh
```

**Note:** For other clusters, build and push to your registry.

### 3. Deploy TinyOlly Core

```bash
kubectl apply -f .
```

This deploys:
- **Redis**: Data storage
- **OTel Collector**: Receives telemetry (ports 4317/4318)
- **TinyOlly OTLP Receiver**: Parses OTLP and stores in Redis
- **TinyOlly UI**: Web interface (port 5002)

### 4. Access the UI

Start minikube tunnel in a **separate terminal**:

```bash
minikube tunnel
```

You may be asked for your password. Keep this terminal open.

Now access the UI at: **http://localhost:5002**

### 5. Deploy Demo Apps (Optional)

To see TinyOlly in action with automatic traffic generation:

```bash
cd ../k8s-demo
./deploy.sh
```

The demo apps will automatically generate traces, logs, and metrics!

### 6. Cleanup

Remove all TinyOlly resources:

```bash
./cleanup.sh
```

## Kubernetes Resources

### Deployments

- **redis**: Redis data store with 256MB memory limit
- **otel-collector**: OpenTelemetry Collector for receiving telemetry
- **tinyolly-otlp-receiver**: Receives OTLP data and stores in Redis
- **tinyolly-ui**: Web UI for visualizing traces, logs, and metrics

### Services

- **redis**: Internal service for Redis (port 6379)
- **otel-collector**: Internal service for OTLP collector (ports 4317, 4318)
- **tinyolly-otlp-receiver**: Internal service for receiver (port 5003)
- **tinyolly-ui**: LoadBalancer service for UI (port 5002)

### ConfigMaps

- **otel-collector-config**: Configuration for OpenTelemetry Collector

## Using with Your Own App

After deploying TinyOlly core, instrument your application to send telemetry:

**Point your OpenTelemetry exporter to:**
- **gRPC**: `otel-collector:4317`
- **HTTP**: `otel-collector:4318`

Deploy your app to the same namespace as TinyOlly. Your telemetry will appear in the TinyOlly UI at http://localhost:5002 (with minikube tunnel).

## Manual Deployment

If you prefer manual control:

### 1. Build Images (Minikube only)

```bash
eval $(minikube docker-env)
./build-images.sh
```

### 2. Deploy Resources

```bash
kubectl apply -f .
```

### 3. Wait for Deployment

```bash
kubectl wait --for=condition=available --timeout=120s deployment/redis
kubectl wait --for=condition=available --timeout=120s deployment/otel-collector
kubectl wait --for=condition=available --timeout=120s deployment/tinyolly-otlp-receiver
kubectl wait --for=condition=available --timeout=120s deployment/tinyolly-ui
```

### 4. Access the UI

**For Minikube:**

In a separate terminal:
```bash
minikube tunnel
```

Then access: http://localhost:5002

**For other clusters:**

```bash
kubectl get service tinyolly-ui
# Use the EXTERNAL-IP shown
```

### 5. Verify Deployment

Check pod and service status:

```bash
kubectl get pods
kubectl get services
```

All pods should show `Running` status.

## Troubleshooting

Common quick fixes:

### Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs deployment/tinyolly-ui
kubectl logs deployment/tinyolly-otlp-receiver

# Common cause: images not built
./build-images.sh
kubectl rollout restart deployment/tinyolly-ui
kubectl rollout restart deployment/tinyolly-otlp-receiver
```

### ImagePullBackOff

```bash
# For Minikube: rebuild images
eval $(minikube docker-env)
./build-images.sh

# Delete pods to force recreation
kubectl delete pod -l app=tinyolly-ui
kubectl delete pod -l app=tinyolly-otlp-receiver
```

### LoadBalancer Pending

```bash
# For Minikube: start tunnel
minikube tunnel
```

### Can't Access UI

```bash
# Check if minikube tunnel is running
pgrep -f "minikube tunnel"

# If not, start it
minikube tunnel

# Alternative: use port forwarding
kubectl port-forward service/tinyolly-ui 5002:5002
```

## File Reference

```
k8s/
├── README.md                          # This file
├── build-images.sh                    # Build Docker images for Minikube
├── cleanup.sh                         # Remove all TinyOlly resources
├── redis.yaml                         # Redis deployment + service
├── otel-collector.yaml                # OTel Collector deployment + service
├── otel-collector-config.yaml         # OTel Collector ConfigMap
├── tinyolly-otlp-receiver.yaml        # Receiver deployment + service
└── tinyolly-ui.yaml                   # UI deployment + service
```

## Architecture

The deployment creates these components:

1. **Redis** - Data storage with 30-minute TTL
2. **OTel Collector** - Receives OTLP telemetry on ports 4317 (gRPC) and 4318 (HTTP)
3. **TinyOlly OTLP Receiver** - Parses telemetry and stores in Redis with cardinality protection
4. **TinyOlly UI** - Web interface for viewing traces, metrics, and logs (port 5002)

## Features

- **Distributed Tracing**: View complete request flows across services
- **Metrics Dashboard**: Monitor request counts, durations, and custom metrics
- **Log Aggregation**: Correlated logs with trace context
- **Cardinality Protection**: Prevents metric explosion (configurable limit)
- **Auto-Refresh UI**: Real-time updates every 5 seconds
- **30-Minute TTL**: Automatic data cleanup in Redis

For more details, see the [main README](../README.md).
