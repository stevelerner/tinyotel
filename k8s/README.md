# TinyOlly Kubernetes Deployment

This directory contains Kubernetes manifests and helper scripts for deploying TinyOlly to a Kubernetes cluster (tested with Minikube).

## Quick Start

### One-Command Deploy

The easiest way to deploy TinyOlly:

```bash
./deploy-and-test.sh
```

This automated script will:
1. Check prerequisites (kubectl, minikube)
2. Build Docker images (for Minikube)
3. Deploy all resources to Kubernetes
4. Wait for deployments to be ready
5. Run comprehensive diagnostics
6. Help you set up access to the UI

### Check Status

At any time, check the status of your deployment:

```bash
./status.sh
```

## Scripts Reference

### `deploy-and-test.sh` ⭐ Recommended
**Purpose:** Complete automated deployment with testing  
**What it does:**
- Validates prerequisites
- Builds images (Minikube only)
- Deploys all resources
- Waits for readiness
- Runs diagnostics
- Sets up UI access

**Usage:**
```bash
./deploy-and-test.sh
```

### `build-images.sh`
**Purpose:** Build Docker images in Minikube  
**What it does:**
- Configures Docker to use Minikube's daemon
- Builds `tinyolly-ui` image
- Builds `tinyolly-otlp-receiver` image

**Usage:**
```bash
./build-images.sh
```

**Note:** Only needed for Minikube. For other clusters, build and push to your registry.

### `test-deployment.sh`
**Purpose:** Comprehensive diagnostics and testing  
**What it does:**
- Checks all deployment statuses
- Verifies pod health
- Retrieves logs from failing pods
- Shows events and errors
- Provides troubleshooting suggestions

**Usage:**
```bash
./test-deployment.sh
```

**When to use:** 
- After deployment to verify everything works
- When pods are failing or crashing
- To get detailed diagnostics

### `status.sh`
**Purpose:** Quick status overview  
**What it does:**
- Shows deployment readiness
- Lists pod status
- Displays service information
- Checks if minikube tunnel is running

**Usage:**
```bash
./status.sh
```

**When to use:**
- Quick health check
- Before shutting down
- To get access URLs

### `cleanup.sh`
**Purpose:** Remove all TinyOlly resources  
**What it does:**
- Lists resources to be deleted
- Asks for confirmation
- Deletes all deployments, services, and configmaps
- Waits for cleanup to complete
- Optionally removes Docker images (Minikube)

**Usage:**
```bash
./cleanup.sh
```

**When to use:**
- Before redeploying
- When done with TinyOlly
- To start fresh

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

```bash
./test-deployment.sh
```

## Troubleshooting

If you encounter issues, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

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
├── TROUBLESHOOTING.md                 # Detailed troubleshooting guide
├── deploy-and-test.sh                 # Automated deployment + testing
├── build-images.sh                    # Build Docker images
├── test-deployment.sh                 # Run diagnostics
├── status.sh                          # Quick status check
├── cleanup.sh                         # Remove all resources
├── redis.yaml                         # Redis deployment + service
├── otel-collector.yaml               # OTel Collector deployment + service
├── otel-collector-config.yaml        # OTel Collector ConfigMap
├── tinyolly-otlp-receiver.yaml       # Receiver deployment + service
└── tinyolly-ui.yaml                  # UI deployment + service
```

## Workflow Examples

### First Time Setup

```bash
minikube start
./deploy-and-test.sh
# Follow prompts to start minikube tunnel
# Access UI at http://localhost:5002
```

### Daily Development Workflow

```bash
# Check status
./status.sh

# If changes made to code, rebuild and redeploy
./build-images.sh
kubectl rollout restart deployment/tinyolly-ui
kubectl rollout restart deployment/tinyolly-otlp-receiver

# Verify
./test-deployment.sh
```

### Troubleshooting Issues

```bash
# Get detailed diagnostics
./test-deployment.sh

# Check specific logs
kubectl logs deployment/tinyolly-ui --tail=100

# Start fresh if needed
./cleanup.sh
./deploy-and-test.sh
```

### Cleanup

```bash
./cleanup.sh
minikube stop  # If done with Minikube
```

## Additional Resources

- [Main TinyOlly README](../README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

