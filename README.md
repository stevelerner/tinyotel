# TinyOlly - An Observability Platform For Your Desktop Dev Environment

A **lightweight observability system built from scratch** to visualize and correlate logs, metrics, and traces. No 3rd party Observability tools are used - just Flask, Redis, and Chart.js.  

Think of TinyOlly as a tool to livetail your metrics/traces/logs during development with visuals and tools like a full production observability system- but is lighter and runs locally.

Included is a demo app with two Flask microservices which are auto instrumenated for tracing and also utilize the OpenTelemetry Python SDK to export logs and metrics to the OpenTelemetry collector. This is the proper way to instrument an application for observability.  

## Docker: Quick Start

> **Note:** Built and tested on Docker Desktop for Mac.

The Docker-based implementation has been moved to the `docker/` directory.

### Option 1: Full TinyOlly Demo
Run the otel collector, TinyOlly receiver, storage, and UI, and the demo app with two Flask microservices.  

```bash
cd docker/tinyolly-demo
./01-start.sh
```

Then generate traffic:
```bash
./02-traffic.sh
```

Open the UI at `http://localhost:5002`.

Stop the demo:
```bash
./03-stop.sh
```

### Option 2: TinyOlly Core w/ UI (Bring Your Own App)
Start only the TinyOlly observability backend and UI to use with your own application.
- Your application sends OpenTelemetry metrics/logs/traces to TinyOlly's OTel Collector destination: `http://otel-collector:4317` or `http://otel-collector:4318`.  
- For traces you can use manual or auto instrumentation. Logs and metrics should use the OpenTelemetry SDK.  
- The collector sends the data to TinyOlly's OTLP receiver. The receiver parses the data and stores it in Redis. 
- The TinyOlly UI then displays the telemetry.  

```bash
cd docker
./01-start-core.sh
```

This starts:
- **OTel Collector**: Listening on `localhost:4317` (gRPC) and `localhost:4318` (HTTP)
- **TinyOlly UI**: `http://localhost:5002`
- **Redis & Receiver**: Backend storage

**Instrument Your App:**
Point your OpenTelemetry exporter to `localhost:4317` (gRPC) or `localhost:4318` (HTTP).

**Stop Core Services:**
```bash
./02-stop-core.sh
```

## Architecture

```
Demo Frontend  ←→  Demo Backend (distributed tracing)
        ↓                    ↓
   OTel Collector  ←─────────┘
        ↓
   TinyOlly OTLP Receiver (parses OTLP, stores in Redis)
        ↓
   Redis (10-minute TTL)
        ↓
   TinyOlly UI (Flask + single HTML file)
```

**Demo: Key Points:**
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

    Now you can access the UI at: [http://localhost:5002](http://localhost:5002)

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

Generate traffic to create traces, metrics, and logs:

```bash
./generate-traffic.sh
```

The demo includes two microservices that showcase distributed tracing across service boundaries. See [k8s-demo/README.md](k8s-demo/README.md) for details.