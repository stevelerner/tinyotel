# TinyOlly Kubernetes Demo Applications

This directory contains demo applications that showcase TinyOlly's observability features with distributed tracing, metrics, and logs.

## Overview

The demo consists of two microservices:
- **demo-frontend**: A Flask app that handles user requests and calls the backend
- **demo-backend**: A Flask service that processes inventory, pricing, and payment operations

Both services are instrumented with OpenTelemetry and automatically generate:
- **Distributed Traces**: See how requests flow between services
- **Metrics**: Monitor request counts, order processing, and performance
- **Logs**: Correlated logs with trace context

## Prerequisites

1. TinyOlly core services must be deployed first:
   ```bash
   cd ../k8s
   kubectl apply -f .
   ```

2. Minikube tunnel should be running (for macOS):
   ```bash
   minikube tunnel  # In a separate terminal
   ```

## Quick Start

### 1. Deploy Demo Apps

```bash
./deploy.sh
```

This script will:
- Check that TinyOlly core is running
- Build Docker images (for Minikube)
- Deploy demo-frontend and demo-backend
- Wait for pods to be ready

### 2. Generate Traffic

```bash
./generate-traffic.sh
```

This creates realistic traffic patterns:
- 50% complex orders (distributed traces with multiple service calls)
- 20% calculations
- 20% greetings
- 10% errors

Press `Ctrl+C` to stop.

### 3. View in TinyOlly UI

Open http://localhost:5002 to see:
- Distributed traces showing the complete order flow
- Metrics for requests, orders, and calculations
- Logs correlated with traces

### 4. Cleanup

```bash
./cleanup.sh
```

Removes demo apps while keeping TinyOlly core running.

## Demo Endpoints

### Frontend Service (http://localhost:5001)

- `GET /` - Home page with endpoint list
- `GET /hello` - Simple greeting endpoint
- `GET /calculate` - Performs a calculation
- `GET /process-order` - **Complex distributed trace** across services
- `GET /error` - Simulates errors for testing

### Backend Service (internal)

- `POST /check-inventory` - Check item availability
- `POST /calculate-price` - Calculate pricing with discounts
- `POST /process-payment` - Process payment
- `GET /health` - Health check

## What You'll See in TinyOlly

### Distributed Traces

The `/process-order` endpoint creates a complete distributed trace showing:

1. **Frontend receives order**
2. **Backend: Check inventory**
3. **Backend: Calculate price** (with discount logic)
4. **Backend: Process payment**
5. **Frontend sends confirmation**

Each step is automatically instrumented and shows:
- Duration
- Service name
- Parent-child relationships
- Any errors

### Metrics

Monitor application metrics like:
- `http.server.requests` - Total HTTP requests by endpoint
- `app.orders.total` - Orders by status (completed/failed)
- `app.order.value` - Distribution of order amounts
- `backend.inventory.checks` - Inventory check operations
- `backend.payments.attempts` - Payment processing attempts

### Logs

All logs include:
- Trace ID and Span ID (for correlation)
- Timestamp
- Severity level
- Message
- Service name

Click on any trace in the UI to see associated logs!

## Architecture

```
┌──────────────┐
│ Traffic Gen  │
└──────┬───────┘
       │ HTTP
       ▼
┌──────────────────┐    HTTP     ┌──────────────────┐
│  demo-frontend   │──────────▶  │  demo-backend    │
│  (Port 5001)     │             │  (Port 5000)     │
└────────┬─────────┘             └────────┬─────────┘
         │                                 │
         │ OTLP (gRPC)                    │ OTLP (gRPC)
         │                                 │
         ▼                                 ▼
    ┌────────────────────────────────────────┐
    │         OTel Collector                 │
    │           (Port 4317)                  │
    └──────────────────┬─────────────────────┘
                       │ OTLP (HTTP)
                       ▼
            ┌──────────────────────┐
            │ TinyOlly OTLP        │
            │ Receiver             │
            └──────────┬───────────┘
                       │
                       ▼
                 ┌──────────┐
                 │  Redis   │
                 └──────────┘
                       ▲
                       │
            ┌──────────┴───────────┐
            │  TinyOlly UI         │
            │  (Port 5002)         │
            └──────────────────────┘
```

## Manual Deployment

If you prefer manual control:

### Build Images
```bash
./build-images.sh
```

### Deploy Manifests
```bash
kubectl apply -f demo-backend.yaml
kubectl apply -f demo-frontend.yaml
```

### Check Status
```bash
kubectl get pods -l 'app in (demo-frontend,demo-backend)'
kubectl get services -l 'app in (demo-frontend,demo-backend)'
```

### Access Frontend
With minikube tunnel running:
```bash
curl http://localhost:5001/
curl http://localhost:5001/process-order
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods

# Check logs
kubectl logs deployment/demo-frontend
kubectl logs deployment/demo-backend

# Describe pod for events
kubectl describe pod <pod-name>
```

### Images Not Found

For Minikube, ensure images are built in Minikube's Docker:
```bash
./build-images.sh
```

### Cannot Connect to OTel Collector

Ensure TinyOlly core is deployed:
```bash
kubectl get service otel-collector
```

Should show the service on ports 4317 (gRPC) and 4318 (HTTP).

### Frontend Not Accessible

1. Check if minikube tunnel is running:
   ```bash
   pgrep -f "minikube tunnel"
   ```

2. If not, start it:
   ```bash
   minikube tunnel
   ```

3. Alternative - use port forwarding:
   ```bash
   kubectl port-forward service/demo-frontend 5001:5001
   ```

## Files Reference

```
k8s-demo/
├── README.md                  # This file
├── deploy.sh                  # Deploy demo apps
├── cleanup.sh                 # Remove demo apps
├── build-images.sh           # Build Docker images
├── generate-traffic.sh       # Generate traffic
├── demo-frontend.yaml        # Frontend deployment + service
├── demo-backend.yaml         # Backend deployment + service
├── app.py                    # Frontend application code
├── backend-service.py        # Backend application code
├── Dockerfile                # Frontend Dockerfile
├── Dockerfile.backend        # Backend Dockerfile
└── requirements.txt          # Python dependencies
```

## Key Features Demonstrated

### Automatic Instrumentation
Both apps use OpenTelemetry's auto-instrumentation:
- No manual span creation needed
- HTTP requests automatically traced
- Context propagated between services

### Distributed Tracing
The `/process-order` endpoint shows:
- Multiple service calls in one trace
- Parent-child span relationships
- Timing breakdown for each operation
- Error propagation

### Correlated Logs
Every log entry includes trace context:
- Click on a trace to see related logs
- Filter logs by trace ID
- See the complete story of a request

### Real Metrics
Counters and histograms for:
- Request rates
- Order completion rates
- Value distributions
- Error rates

## Next Steps

1. Deploy the demo: `./deploy.sh`
2. Generate traffic: `./generate-traffic.sh`
3. Open TinyOlly UI: http://localhost:5002
4. Explore traces, metrics, and logs!
5. Try causing errors and watch them appear
6. See how distributed traces connect services

For more information, see the [main TinyOlly README](../README.md).

