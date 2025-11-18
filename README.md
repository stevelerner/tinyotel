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

### 2. Instrumented Python App (Frontend Service)

A simple Flask application demonstrating OpenTelemetry instrumentation:
- Auto-instrumentation for automatic distributed tracing
- Structured JSON logs with trace/span correlation
- Custom metrics collection
- Exports all telemetry via OTLP

Endpoints (available at http://localhost:5001):
- `GET /` - Home page with endpoint list
- `GET /hello` - Random greeting with simulated work
- `GET /calculate` - Random calculation with logging
- `GET /process-order` - **Best for traces!** Complex multi-service order processing showing distributed tracing across frontend and backend services
- `GET /error` - Simulates errors for testing

### 3. Backend Service

A second Flask microservice demonstrating distributed tracing:
- Auto-instrumented with OpenTelemetry
- Called by the frontend service via HTTP
- Automatically creates distributed trace spans
- Demonstrates trace propagation across service boundaries

Backend endpoints (called internally by frontend):
- `POST /check-inventory` - Inventory availability check
- `POST /calculate-price` - Pricing calculations with tax and discounts
- `POST /process-payment` - Payment processing with validation

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
- How to build interactive trace waterfall visualizations with time axes
- How to inspect individual spans with clickable UI elements
- How to display real-time metrics charts with histogram distributions
- How in-memory storage with TTL works

**Built from scratch** in ~2,350 lines of code to be readable and educational.

### Architecture

TinyOlly follows a proper observability pipeline architecture:

**Data Flow:**
```
Frontend Service (TinyOTel)  ←→  Backend Service
         ↓                              ↓
    OTel Collector  ←──────────────────┘
         ↓
    TinyOlly OTLP Receiver (OTLP/HTTP)
         ↓
    Redis (in-memory storage)
         ↓
    TinyOlly Frontend (web UI)
```

**Components:**
- **Frontend Service**: Main Flask app with auto-instrumentation (~270 lines)
- **Backend Service**: Second Flask microservice for distributed tracing (~240 lines)
- **TinyOlly OTLP Receiver**: Python Flask service that receives OTLP telemetry from the collector and stores it in Redis (~240 lines)
- **TinyOlly Frontend**: Python Flask API serving the web UI (~330 lines)
- **Storage**: Redis with 10-minute TTL for all telemetry data
- **UI**: Single HTML file with Chart.js for visualization (~1,270 lines)

**Key Design:**
- Both services use automatic OpenTelemetry instrumentation only (no manual span creation)
- HTTP calls between services automatically create distributed traces
- The instrumented apps only speak standard OTLP - they have no knowledge of TinyOlly
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
- TinyOTel frontend service (main app)
- TinyOTel backend service (demonstrates distributed tracing)
- OpenTelemetry Collector
- TinyOlly OTLP Receiver (receives telemetry from collector)
- Redis (stores telemetry with 10-minute TTL)
- TinyOlly Frontend (web UI)

**Step 2:** Generate continuous traffic
```bash
./02-continuous-traffic.sh
```
Keep this running in a separate terminal to see live metric updates. Press Ctrl+C to stop.

**Pro tip:** The `/process-order` endpoint generates the most interesting distributed traces, showing automatic trace propagation across the frontend and backend services with multiple nested spans!

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

- **Logs Tab**: View structured logs with trace correlation links and individual counters
- **Metrics Tab**: Live charts showing app performance with histogram bucket visualization
- **Traces Tab**: Interactive waterfall visualization with time axis, clickable spans, and duration breakdown across services (see `/process-order` traces for distributed tracing examples!)

**Advanced Metrics Visualization:**
- **Counter & Gauge Metrics**: Real-time line charts with rolling 30-point window
- **Histogram Metrics**: Full histogram visualization with:
  - Min, Max, Average, and Count statistics
  - Bucket distribution bar charts showing data spread
  - Automatic detection and display for histogram-type metrics
- Smooth Chart.js animations with 2-second refresh intervals
- Interactive tooltips showing exact values on hover

**Correlation & Navigation:**
- Click trace ID in log → jump to trace detail
- Click "View Logs" in trace → filter logs by trace ID
- Bidirectional navigation between logs and traces

**Interactive Trace Waterfall:**
- Time axis showing 0%, 25%, 50%, 75%, 100% markers along the trace timeline
- Click any span bar to view full span JSON with attributes, timing, and metadata
- Visual highlighting of selected spans with yellow outline
- Smooth scrolling to span details on click
- Duration displayed on bars and in separate column for easy reference

**Interactive Details:**
- JSON inspection toggle for logs and traces
- Clickable spans in waterfall for detailed inspection
- Stats counters displayed within each tab (not in global header)
- Auto-refresh for metrics and traces (2 seconds)
- Manual refresh for logs (click refresh button to update)
- Clean, compact light-mode interface

### Tiny Metrics in Action

TinyOlly displays live charts for common application metrics:
- **Counters**: Request counts, calculation totals, greeting counts
- **Gauges**: Active connections and server status
- **Histograms**: Response time distributions, calculation result distributions
  - Full histogram stats (min/max/avg/count)
  - Bucket distribution visualization showing value ranges
- All updating in real-time with smooth Chart.js animations

Each chart shows a rolling window of the last 30 data points, refreshing every 2 seconds.

## Why "Tiny"?

Both TinyOTel and TinyOlly are intentionally minimal:

- **TinyOTel** - Just enough to show OpenTelemetry basics without overwhelming complexity
- **TinyOlly** - Simple enough to understand in an afternoon, complex enough to demonstrate real observability concepts

**Learn by reading the code:**
- ~270 lines for the frontend service (main instrumented app)
- ~240 lines for the backend service (distributed tracing demo)
- ~240 lines for the OTLP receiver (protocol parsing, histogram buckets, and storage)
- ~330 lines for the TinyOlly backend (API endpoints)
- ~1,270 lines of HTML/JS for the UI (visualization, histogram charts, and interaction)
- Total: ~2,350 lines of readable, commented code
- No heavy frameworks or abstractions - just Flask, Redis, and Chart.js
- Clear, commented code showing how things work

Perfect for:
- Learning how observability systems work internally
- Understanding trace correlation and context propagation
- Building your own monitoring tools
- Teaching others about observability

**Read more**: See [TINYOLLY-README.md](TINYOLLY-README.md) for detailed documentation on how TinyOlly works internally.

