# TinyOTel + TinyOlly

**Two tiny implementations for learning observability:**

1. **TinyOTel** - A minimal OpenTelemetry demo showing how to instrument applications with logs, metrics, and traces
2. **TinyOlly** - A tiny observability backend built from scratch to visualize and correlate telemetry data

Both are designed to be small, focused, and educational - showing how observability works without the complexity of production systems.

## TinyOTel Components

A minimal OpenTelemetry setup demonstrating the three pillars of observability: logs, metrics, and traces.

### 1. OpenTelemetry Collector

A tiny OTEL collector configured with:
- Receivers: OTLP gRPC on port 4317
- Exporters: Debug/Console exporter with detailed verbosity
- Pipelines: Logs, Metrics, and Traces
- Protocol: gRPC (efficient binary protocol)

### 2. Instrumented Python App

A simple Flask application demonstrating OpenTelemetry instrumentation:
- Auto-instrumentation for automatic tracing
- Structured JSON logs with trace/span correlation
- Custom metrics collection
- Exports all telemetry via OTLP

Endpoints (available at http://localhost:5001):
- `GET /` - Home page with endpoint list
- `GET /hello` - Random greeting with simulated work
- `GET /calculate` - Random calculation with logging
- `GET /error` - Simulates errors for testing

Each request generates all three signals:
- **Logs**: Structured JSON with trace/span correlation
- **Metrics**: Custom counters, histograms, and gauges
- **Traces**: Automatic distributed traces via OTLP

Log format:
  - `timestamp` (ISO 8601 format with timezone)
  - `severity` (INFO, WARNING, ERROR)
  - `trace_id` (32-character hex string)
  - `span_id` (16-character hex string)
  - `message` (log message)

### TinyOTel Metrics

The instrumented app collects:
- Request counters by endpoint
- Calculation and greeting counters
- Response time histograms
- Active connection gauges

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

## Using TinyOTel

### Step 1: Start the Stack

```bash
./01-start.sh
```

Starts the OTEL collector and instrumented app. The collector listens on port 4317 and prints all received telemetry to console.

### Step 2: Generate Traffic

Generate a single batch of traffic:
```bash
./02-test-traffic.sh
```

Or generate continuous traffic (recommended for TinyOlly metrics):
```bash
./02-continuous-traffic.sh
```

Press Ctrl+C to stop the continuous traffic generator.

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

## TinyOlly - A Tiny Observability Backend

Want to understand how observability backends work? **TinyOlly** is a tiny observability platform built from scratch - no Grafana, no Jaeger, no Prometheus. Just Python, Redis, and Chart.js.

### What is TinyOlly?

TinyOlly is a minimal observability backend that demonstrates:
- How to receive and store logs, metrics, and traces
- How trace/span correlation works with logs
- How to build trace waterfall visualizations
- How to display real-time metrics charts
- How in-memory storage with TTL works

**Built from scratch** in ~1,200 lines of code to be readable and educational.

### Architecture

- **Backend**: Python Flask API (~330 lines)
- **Storage**: Redis with 10-minute TTL
- **Frontend**: Single HTML file with Chart.js (~800 lines)
- **No frameworks** - just the essentials

## Using TinyOlly

### Quick Start

```bash
# Start TinyOlly (includes TinyOTel app + Redis + TinyOlly backend)
./07-start-tinyolly.sh

# Generate continuous traffic (keep running)
./02-continuous-traffic.sh

# Open TinyOlly UI
open http://localhost:5002

# Stop everything
./08-stop-tinyolly.sh
```

**Tip**: Keep `./02-continuous-traffic.sh` running to see live metrics charts updating in real-time.

### TinyOlly Features

**Logs, Metrics & Traces - The Three Pillars:**

- **Logs Tab**: View structured logs with trace correlation links
- **Metrics Tab**: Live charts showing app performance in real-time
- **Traces Tab**: Waterfall visualization showing span timing and duration

**Correlation & Navigation:**
- Click trace ID in log → jump to trace detail
- Click "View Logs" in trace → filter logs by trace ID
- Bidirectional navigation between logs and traces

**Interactive Details:**
- JSON inspection toggle for logs and traces
- Hover tooltips on metric charts showing exact values
- Auto-refresh every 2 seconds
- Clean, compact interface

### Tiny Metrics in Action

TinyOlly displays live charts for common application metrics:
- Response times, active connections, error rates
- CPU and memory usage (simulated)
- Request counters, calculation totals
- All updating in real-time with smooth animations

Each chart shows a rolling window of the last 30 data points.

## Why "Tiny"?

Both TinyOTel and TinyOlly are intentionally minimal:

- **TinyOTel** - Just enough to show OpenTelemetry basics without overwhelming complexity
- **TinyOlly** - Simple enough to understand in an afternoon, complex enough to demonstrate real observability concepts

**Learn by reading the code:**
- ~330 lines of Python for the backend
- ~800 lines of HTML/JS for the frontend
- No heavy frameworks or abstractions
- Clear, commented code showing how things work

Perfect for:
- Learning how observability systems work internally
- Understanding trace correlation and context propagation
- Building your own monitoring tools
- Teaching others about observability

**Read more**: See [TINYOLLY-README.md](TINYOLLY-README.md) for detailed documentation on how TinyOlly works internally.

