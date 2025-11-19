# TinyOlly - Learn Observability by Building It

A **minimal observability backend built from scratch** to observe logs, metrics, and traces. No 3rd party Observability tools are used - just Flask, Redis, and Chart.js.  

Think of TinyOlly as a tool to livetail your telemetry with visuals like a full production observability tool... To be used while you are developing your application so that you don't have to use a full external observability stack.  

Includes a demo two Flask microservices auto instrumenated for tracing and using OpenTelemetry Python SDK to export logs and metrics to an OpenTelemetry collector. This is the most modern design for taking advantage of OpenTelemetry using easy auto-instrumentation for traces yet writing properly formatted logs and metrics using the Otel SDK.

## Quick Start

> **Note:** Built and tested on Docker Desktop for Mac.

### Option 1: Full TinyOlly Demo
Run the complete stack with the demo frontend, backend, and TinyOlly UI.

```bash
cd tinyolly-demo
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

### Option 2: Console Demo
Run the demo app with the OpenTelemetry Collector outputting to the console (no UI).

```bash
cd tinyolly-console-demo
./01-start.sh
```

Generate traffic and view logs/traces/metrics using the provided scripts in the folder.

### Option 3: Core Only (Bring Your Own App)
Start only the TinyOlly observability backend to use with your own application.

```bash
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

**Code Breakdown:**
**Code Breakdown:**
- **Demo Frontend** (`tinyolly-demo/app.py`): ~290 lines
  - Flask app with auto-instrumentation
- **Demo Backend** (`tinyolly-demo/backend-service.py`): ~180 lines
  - Microservice for distributed tracing demo
- **Tinyolly OTLP Receiver** (`tinyolly-otlp-receiver.py`): ~270 lines
  - gRPC/HTTP server that parses OTLP and stores in Redis
- **TinyOlly UI** (`tinyolly-ui.py`): ~170 lines
  - Flask backend for the dashboard
- **Storage Engine** (`tinyolly_redis_storage.py`): ~240 lines
  - Shared Redis logic for traces, metrics, and logs
- **Dashboard UI** (`templates/index.html`): ~1,270 lines
  - Single-file HTML/JS/CSS with Chart.js

No heavy frameworks - just Flask, Redis, Chart.js, and clear, commented code.