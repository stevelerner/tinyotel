# TinyOTel - Minimal OpenTelemetry Demo

A minimal OpenTelemetry demo showing metrics, traces, and logs.

**Includes TinyOlly**: A custom observability backend built from scratch! See [TINYOLLY-README.md](TINYOLLY-README.md) for details.

## Components

### 1. OpenTelemetry Collector

The collector is configured with:
- Receivers: OTLP gRPC on port 4317
- Exporters: Debug/Console exporter with detailed verbosity
- Pipelines: Traces, Metrics, and Logs
- Protocol: gRPC (efficient binary protocol)

### 2. Python Demo App

A simple Flask application that:
- Uses OpenTelemetry auto-instrumentation
- Generates traces automatically for each HTTP request
- Outputs structured JSON logs with trace/span IDs
- Exports traces to the OTEL collector

Endpoints (available at http://localhost:5001):
- `GET /` - Home page with endpoint list
- `GET /hello` - Random greeting with simulated work
- `GET /calculate` - Random calculation with logging
- `GET /error` - Simulates errors for testing

Each request generates:
- **Traces**: Automatic distributed traces via OTLP
- **Metrics**: Custom application metrics via OTLP
- **Logs**: Structured JSON logs with fields:
  - `timestamp` (ISO 8601 format with timezone)
  - `severity` (INFO, WARNING, ERROR)
  - `trace_id` (32-character hex string)
  - `span_id` (16-character hex string)
  - `message` (log message)

### Metrics Collected

Custom application metrics:
- **http.server.requests** - Counter of HTTP requests by endpoint and method
- **app.greetings.total** - Counter of greetings by name
- **app.calculations.total** - Counter of calculations by operation type
- **app.calculation.result** - Histogram of calculation results

Auto-instrumented metrics:
- **http.server.duration** - Histogram of HTTP request durations
- **http.server.active_requests** - Gauge of active HTTP requests

Example log entry:
```json
{
  "timestamp": "2025-11-18T00:43:20.464249+00:00",
  "severity": "INFO",
  "trace_id": "50e7ab1f21f1e3dc9efe17258e598ed5",
  "span_id": "c45f8211b38a2b99",
  "message": "Greeting user: Charlie"
}
```

### Step 1: Quick Start

```bash
./01-start.sh
```

The collector will start and listen for OTLP data on port 4317 (gRPC).
All received telemetry data will be printed to the console.

### Step 2: Generate Traffic

```bash
./02-test-traffic.sh
```

### Step 3: View Logs

View app logs with structured JSON and trace IDs:
```bash
./03-show-logs.sh
```

### Step 4: View Traces

View traces in the collector:
```bash
./04-show-traces.sh
```

### Step 5: View Metrics

Watch metrics as they're collected (updates every ~2 seconds):
```bash
./05-show-metrics.sh
```

Or view recent metrics manually:
```bash
docker-compose logs --tail=200 otel-collector | grep -E "(Metrics|app\.|http\.server\.requests)"
```

### Step 6: Cleanup

```bash
./06-cleanup.sh
```

## 🔍 TinyOlly - Custom Observability Backend

Want to see how observability backends work under the hood? Check out **TinyOlly** - a complete observability platform built from scratch (no Grafana, no Jaeger, just Python + Redis + HTML/JS)!

### What is TinyOlly?

TinyOlly is a lightweight observability backend that:
- ✅ Receives traces, logs, and metrics via HTTP API
- ✅ Stores data in Redis with 10-minute TTL
- ✅ Provides a web UI with trace waterfall visualization
- ✅ Correlates logs with traces using trace/span IDs
- ✅ Visualizes metrics in real-time
- ✅ Built entirely from scratch (~1,200 lines of code)

### Quick Start with TinyOlly

```bash
# Start TinyOlly with the full stack
./07-start-tinyolly.sh

# Generate traffic
./02-test-traffic.sh

# Open TinyOlly UI in browser
open http://localhost:5002

# Stop everything
./08-stop-tinyolly.sh
```

### Features

- 🎯 **Trace Waterfall View**: Visual timeline showing span execution
- 📝 **Log Correlation**: Click on a trace to see all related logs
- 📊 **Metrics Charts**: Real-time visualization of custom metrics
- 🔄 **Auto-Refresh**: Updates every 5 seconds
- 🌙 **Dark Theme**: Easy on the eyes for long debugging sessions

### Learn How It Works

Read the [TinyOlly README](TINYOLLY-README.md) to understand:
- How observability backends store and query data
- How trace correlation works with trace/span IDs
- How to build waterfall visualizations
- How to implement in-memory storage with TTL

**TinyOlly proves that observability isn't magic - it's just good software engineering!**

