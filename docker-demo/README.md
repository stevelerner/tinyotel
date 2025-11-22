# TinyOlly Demo Applications

This folder contains demo applications that showcase TinyOlly's observability features:
- **Demo Frontend**: Flask app with automatic traffic generation
- **Demo Backend**: Downstream service for distributed tracing

**Note:** These demo apps require TinyOlly core to be running first.

## Quick Start

**1. Deploy TinyOlly Core (Required First):**
```bash
cd docker
./01-start-core.sh
```

**2. Deploy Demo Apps:**
```bash
cd ../docker-demo
./01-deploy-demo.sh
```

**3. View Telemetry:**
Open `http://localhost:5005`

The demo apps will automatically generate traffic. Watch traces, logs, and metrics appear in real-time!

**4. Stop Demo Apps:**
```bash
./02-cleanup-demo.sh
```

This removes demo apps but leaves TinyOlly core running.

**5. Stop Everything (Optional):**
```bash
cd docker
./02-stop-core.sh
```

## What's Generated

The demo apps automatically call these endpoints every 3-8 seconds:
- `/hello` - Simple greeting
- `/calculate` - Math operation with timing
- `/process-order` - Complex multi-service flow (inventory → pricing → payment)
- `/error` - Intentional errors for testing

Each generates:
- **Traces**: Distributed tracing across frontend ↔ backend
- **Logs**: Structured logs with trace correlation
- **Metrics**: Request counts, durations, histograms

## Manual Traffic (Optional)

The demo apps generate traffic automatically, but if you want to create additional load:

```bash
./03-generate-traffic.sh
```

Press Ctrl+C to stop.

## Architecture

```
Demo Frontend (auto-traffic) → Demo Backend
        ↓
    OTel Collector (from core)
        ↓
    TinyOlly OTLP Receiver (from core)
        ↓
    Redis (from core)
        ↓
    TinyOlly UI (from core)
```

## Accessing Services

- **TinyOlly UI**: http://localhost:5005
- **Demo Frontend**: http://localhost:5001
- **Demo Backend**: http://localhost:5004 (internal)
