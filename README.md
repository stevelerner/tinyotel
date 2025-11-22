# TinyOlly - An Observability Platform For Your Desktop Dev Environment

A **lightweight observability system built from scratch** to visualize and correlate logs, metrics, and traces. No 3rd party Observability tools are used - just Flask, Redis, and Chart.js.  

Think of TinyOlly as a local lightweight tool to livetail your metrics/traces/logs during development with visuals and tools like a full production observability system.

Included is a demo app with two Flask microservices using Otel auto-instrumentation for tracing and SDK for logs and metrics. 

TinyOlly was built and tested on Docker Desktop and Minikube on Apple Silicon Mac.  

## Docker: Quick Start

### 1. Deploy TinyOlly Core (Required)

Start the observability backend (OTel Collector, TinyOlly Receiver, Redis, UI):

```bash
cd docker
./01-start-core.sh
```

This starts:
- **OTel Collector**: Listening on `localhost:4317` (gRPC) and `localhost:4318` (HTTP)
- **TinyOlly UI**: `http://localhost:5005`
- **TinyOlly OTLP Receiver and its Redis storage**: OTLP observability back end and storage

**Open the UI:** `http://localhost:5005` (empty until you send data)

**Stop core services:**
```bash
./02-stop-core.sh
```

**Rebuild core services (after code changes):**
```bash
./03-rebuild.sh
```

### 2. Deploy Demo Apps (Optional)

Deploy two Flask microservices with automatic traffic generation:

```bash
cd docker-demo
./01-deploy-demo.sh
```

Wait 30 seconds. **The demo apps automatically generate traffic** - traces, logs, and metrics will appear in the UI!

**Stop demo apps:**
```bash
./02-cleanup-demo.sh
```

**Rebuild demo apps (after code changes):**
```bash
./03-rebuild-demo.sh
```

This leaves TinyOlly core running. To stop everything:
```bash
cd docker
./02-stop-core.sh
```

### Using TinyOlly Core with Your Own Apps

After deploying TinyOlly core (step 1 above), instrument your application to send telemetry:

**Point your OpenTelemetry exporter to:**
- **gRPC**: `http://localhost:4317`
- **HTTP**: `http://localhost:4318`

Your app can use manual or auto-instrumentation for traces. Use the OpenTelemetry SDK for logs and metrics. The collector will forward everything to TinyOlly's receiver, which stores it in Redis and displays it in the UI.

## Architecture

```
Demo Frontend  ←→  Demo Backend (distributed tracing + auto-traffic)
        ↓                    ↓
   OTel Collector  ←─────────┘
        ↓
   TinyOlly OTLP Receiver (parses OTLP, stores in Redis)
        ↓
   Redis (30-minute TTL with cardinality protection)
        ↓
   TinyOlly UI (Flask + HTML + JavaScript)
```

**Demo: Key Points:**
- **Automatic traffic generation** - demo apps continuously generate telemetry (no manual scripts needed)
- Apps use **automatic OpenTelemetry instrumentation** - no manual span creation
- HTTP calls between services automatically create distributed traces
- Apps only speak OTLP - they don't know TinyOlly exists
- Standard observability pipeline architecture
- **Add any container that emits OpenTelemetry and TinyOlly will display its telemetry**

**Demo Endpoints:**
- `/process-order` - Complex multi-service flow (inventory, pricing, payment)
- `/hello`, `/calculate`, `/error` - Simple endpoints
- All endpoints generate logs, metrics, and traces

## Kubernetes (Minikube): Quick Start

You can also run TinyOlly on Kubernetes using Minikube.

### Prerequisites

- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)

### Setup

1.  **Start Minikube:**

    ```bash
    minikube start
    ```

2.  **Build Images:**

    Run the build script to build the Docker images inside Minikube's Docker daemon:

    ```bash
    ./k8s/build-images.sh
    ```

3.  **Apply Manifests:**

    Apply the Kubernetes manifests to deploy the services:

    ```bash
    kubectl apply -f k8s/
    ```

4.  **Access the UI:**

    To access the TinyOlly UI (Service Type: LoadBalancer) on macOS with Minikube, you need to use `minikube tunnel`.

    Open a **new terminal window** and run:

    ```bash
    minikube tunnel
    ```

    You may be asked for your password. Keep this terminal open.

    Now you can access the TinyOlly UI at: [http://localhost:5002](http://localhost:5002)

5.  **Clean Up:**

    Use the cleanup script to remove all TinyOlly resources:

    ```bash
    ./k8s/cleanup.sh
    ```

### Demo Applications (Optional)

To see TinyOlly in action with instrumented microservices:

```bash
cd k8s-demo
./deploy.sh
```

The demo includes two microservices that automatically generate traffic, showcasing distributed tracing across service boundaries. See [k8s-demo/README.md](k8s-demo/README.md) for details.

## Running Docker and Kubernetes Simultaneously

Both environments can run at the same time on the same machine:
- **Docker**: `http://localhost:5005`
- **Kubernetes**: `http://localhost:5002`

Each has its own isolated data and generates independent telemetry streams. Perfect for testing or comparing deployments.

## Features

### Automatic Traffic Generation

Both Docker and Kubernetes demos include built-in automatic traffic generation:
- Starts automatically when demo apps launch
- Generates traces, logs, and metrics every 3-8 seconds
- Calls various endpoints: `/hello`, `/calculate`, `/process-order`, `/error`
- No manual scripts needed - just start and watch!

**Optional manual traffic scripts are available in each demo directory if you want to generate additional load.**

### Modern UI with Auto-Refresh

- **Modular architecture**: Separate HTML and JavaScript files for maintainability
- **Auto-refresh**: Updates every 5 seconds (can be paused with button)
- **Tab persistence**: Remembers which tab you were viewing
- **Copy/Download**: Export trace and log JSON with one click
- **Interactive metrics**: Expandable graphs with search and filtering
- **Data limits**: Shows last 100 logs, 50 traces to prevent browser overload

### Cardinality Protection

TinyOlly includes built-in protection against metric cardinality explosion:
- **Hard Limit**: 1000 unique metric names by default (configurable)
- **Visual Warnings**: UI alerts when approaching the limit (70%, 90%)
- **Drop & Track**: Metrics exceeding the limit are dropped and tracked for debugging
- **Stats Display**: Shows `current / max (dropped)` in the UI

**Configuration:**
```bash
# Kubernetes
kubectl set env deployment/tinyolly-otlp-receiver MAX_METRIC_CARDINALITY=2000

# Docker
docker run -e MAX_METRIC_CARDINALITY=2000 ...
```

See [docs/CARDINALITY-PROTECTION.md](docs/CARDINALITY-PROTECTION.md) for detailed documentation.