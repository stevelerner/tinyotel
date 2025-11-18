# TinyOlly - Learn Observability by Building It

A **minimal observability backend built from scratch** (~2,350 lines) to understand how logs, metrics, and traces work internally. No Grafana, no Jaeger, no Prometheus - just Flask, Redis, and Chart.js.

Includes **TinyOTel** - two auto-instrumented Flask microservices demonstrating distributed tracing with OpenTelemetry.

## Quick Start

**1. Start the full stack:**
```bash
./07-start-tinyolly.sh
```

**2. Generate traffic** (keep running in a separate terminal):
```bash
./02-continuous-traffic.sh
```

**3. Open the UI:**
```bash
open http://localhost:5002
```

**4. Explore the traces:**
- Click the **Traces** tab
- Select a trace (look for `/process-order` - these show distributed tracing across services!)
- Click any span bar to view full JSON details
- Use the time axis to understand timing

**5. Stop everything:**
```bash
./08-stop-tinyolly.sh
```

## What You'll See

### Interactive Trace Waterfall
- Time axis showing when each operation occurred (0%, 25%, 50%, 75%, 100%)
- Click any span to inspect attributes, timing, and metadata
- Visual highlighting and smooth scrolling to details
- Distributed traces across frontend and backend microservices

### Real-Time Metrics
- Live charts with Chart.js animations (2-second refresh)
- Histogram metrics with min/max/avg/count and bucket distributions
- Counters and gauges with rolling 30-point window

### Correlated Logs
- Click trace ID in log → jump to trace detail
- Click "View Logs" in trace → filter logs by trace ID
- Bidirectional navigation between logs and traces
- Manual refresh to avoid distractions

## Architecture

```
Frontend Service  ←→  Backend Service (distributed tracing)
        ↓                    ↓
   OTel Collector  ←─────────┘
        ↓
   TinyOlly OTLP Receiver (parses OTLP, stores in Redis)
        ↓
   Redis (10-minute TTL)
        ↓
   TinyOlly UI (Flask + single HTML file)
```

**Key Points:**
- Apps use **automatic OpenTelemetry instrumentation** - no manual span creation
- HTTP calls between services automatically create distributed traces
- Apps only speak OTLP - they don't know TinyOlly exists
- Standard observability pipeline architecture

**Demo Apps (TinyOTel):**
- `/process-order` - Complex multi-service flow (inventory, pricing, payment)
- `/hello`, `/calculate`, `/error` - Simple endpoints
- All endpoints generate logs, metrics, and traces

## What You'll Learn

By reading ~2,350 lines of code, you'll understand:
- How to receive and parse OTLP telemetry
- How trace/span correlation works with logs
- How to build interactive waterfall visualizations
- How to display real-time metrics with histograms
- How in-memory storage with TTL works

**Code Breakdown:**
- Frontend service: ~270 lines (instrumented Flask app)
- Backend service: ~240 lines (distributed tracing demo)
- OTLP receiver: ~240 lines (protocol parsing, storage)
- TinyOlly backend: ~330 lines (API endpoints)
- UI: ~1,270 lines (HTML/JS with Chart.js)

No heavy frameworks - just Flask, Redis, Chart.js, and clear, commented code.

## Advanced: Console Viewing

Want to see raw telemetry in the terminal? Use the basic TinyOTel stack:

```bash
# Start collector with console output
./01-start.sh

# Generate traffic (separate terminal)
./02-continuous-traffic.sh

# View telemetry in console
./03-show-logs.sh     # Structured logs
./04-show-traces.sh   # Distributed traces  
./05-show-metrics.sh  # Metrics (refreshes every 2s)

# Cleanup
./06-cleanup.sh
```

This mode uses the OpenTelemetry Collector's debug exporter to print telemetry to stdout.

## Why "Tiny"?

**TinyOlly** = Simple enough to understand in an afternoon, complex enough to demonstrate real observability concepts.

**TinyOTel** = Just enough OpenTelemetry to show automatic instrumentation and distributed tracing.

Perfect for:
- Learning how observability systems work internally
- Understanding trace correlation and context propagation  
- Building your own monitoring tools
- Teaching others about observability

