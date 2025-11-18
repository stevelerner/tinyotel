# TinyOTel + TinyOlly

**Two tiny implementations for learning observability:**

1. **TinyOTel** - A minimal OpenTelemetry demo showing how to instrument applications with logs, metrics, and traces
2. **TinyOlly** - A tiny observability backend built from scratch to visualize and correlate telemetry data

Both are designed to be small, focused, and educational - showing how observability works without the complexity of production systems.

## TinyOTel Components

A minimal OpenTelemetry setup demonstrating the three pillars of observability: logs, metrics, and traces.

### 1. OpenTelemetry Collector

A tiny OTEL collector configured with:
- Receivers: OTLP gRPC on port 4317, OTLP HTTP on port 4318
- Exporters: 
  - Debug/Console exporter with detailed verbosity (for viewing telemetry)
  - OTLP HTTP exporter (forwards to TinyOlly OTLP Receiver)
- Pipelines: Logs, Metrics, and Traces
- Protocol: gRPC from app, HTTP to TinyOlly

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

## Getting Started

You have two options for exploring TinyOTel:

### Option A: Basic TinyOTel (Console Viewing)

View telemetry in the terminal using the OpenTelemetry Collector's debug exporter.

**Step 1:** Start the stack
```bash
./01-start.sh
```

**Step 2:** Generate traffic
```bash
./02-test-traffic.sh
```

**Step 3:** View telemetry in console
```bash
./03-show-logs.sh    # View structured logs
./04-show-traces.sh  # View distributed traces
./05-show-metrics.sh # View metrics (refreshes every 2s)
```

**Step 4:** Cleanup
```bash
./06-cleanup.sh
```

### Option B: TinyOlly (Web UI with Full Observability)

Use TinyOlly's web interface to visualize and correlate logs, metrics, and traces. **Recommended for the full experience!**

See the [Using TinyOlly](#using-tinyolly) section below for detailed instructions.

## TinyOlly - A Tiny Observability Backend

Want to understand how observability backends work? **TinyOlly** is a tiny observability platform built from scratch - no Grafana, no Jaeger, no Prometheus. Just Python, Redis, and Chart.js.

### What is TinyOlly?

TinyOlly is a minimal observability backend that demonstrates:
- How to receive and store logs, metrics, and traces
- How trace/span correlation works with logs
- How to build trace waterfall visualizations
- How to display real-time metrics charts
- How in-memory storage with TTL works

**Built from scratch** in ~1,400 lines of code to be readable and educational.

### Architecture

TinyOlly follows a proper observability pipeline architecture:

**Data Flow:**
```
App (TinyOTel) 
  → OTel Collector (OTLP/gRPC)
  → TinyOlly OTLP Receiver (OTLP/HTTP)
  → Redis (in-memory storage)
  → TinyOlly Frontend (web UI)
```

**Components:**
- **TinyOlly OTLP Receiver**: Python Flask service that receives OTLP telemetry from the collector and stores it in Redis (~200 lines)
- **TinyOlly Frontend**: Python Flask API serving the web UI (~330 lines)
- **Storage**: Redis with 10-minute TTL for all telemetry data
- **UI**: Single HTML file with Chart.js for visualization (~800 lines)

**Key Design:**
- The instrumented app only speaks standard OTLP - it has no knowledge of TinyOlly
- The OTel Collector forwards telemetry to TinyOlly's OTLP receiver
- Proper separation of concerns, realistic observability architecture

## Using TinyOlly

### Quick Start

TinyOlly runs the complete observability stack with a web UI for visualization.

**Step 1:** Start TinyOlly stack
```bash
./07-start-tinyolly.sh
```

This starts:
- TinyOTel instrumented app
- OpenTelemetry Collector
- TinyOlly OTLP Receiver (receives telemetry from collector)
- Redis (stores telemetry with 10-minute TTL)
- TinyOlly Frontend (web UI)

**Step 2:** Generate continuous traffic
```bash
./02-continuous-traffic.sh
```
Keep this running in a separate terminal to see live metric updates. Press Ctrl+C to stop.

**Step 3:** Open the TinyOlly UI
```bash
open http://localhost:5002
```
Or navigate to http://localhost:5002 in your browser.

**Step 4:** Stop everything
```bash
./08-stop-tinyolly.sh
```

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
- Auto-refresh for metrics and traces (2 seconds)
- Manual refresh for logs (click refresh button to update)
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
- ~200 lines for the OTLP receiver (protocol parsing and storage)
- ~330 lines for the frontend backend (API endpoints)
- ~800 lines of HTML/JS for the UI (visualization and interaction)
- No heavy frameworks or abstractions
- Clear, commented code showing how things work

Perfect for:
- Learning how observability systems work internally
- Understanding trace correlation and context propagation
- Building your own monitoring tools
- Teaching others about observability

**Read more**: See [TINYOLLY-README.md](TINYOLLY-README.md) for detailed documentation on how TinyOlly works internally.

