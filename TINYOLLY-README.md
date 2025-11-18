# TinyOlly - Custom Observability Backend

A **minimal observability backend built from scratch** that receives, stores, and visualizes traces, metrics, and logs with full correlation capabilities.

## 🎯 What is TinyOlly?

TinyOlly is a lightweight observability platform that demonstrates how observability backends work under the hood. It's built entirely from scratch (no Jaeger, Grafana, or other existing solutions) to show:

- How to receive and store telemetry data
- How to correlate logs with traces using trace/span IDs
- How to visualize trace waterfalls
- How to query and display metrics
- How in-memory storage with TTL works

## 🏗️ Architecture

```
┌─────────────┐
│  Demo App   │ ──traces──> ┌──────────────┐
│  (Flask)    │ ──logs────> │  TinyOlly    │
│             │ ──metrics─> │   Backend    │
└─────────────┘              │   (Flask)    │
                             └──────┬───────┘
                                    │
                             ┌──────▼───────┐
                             │    Redis     │
                             │  (10min TTL) │
                             └──────────────┘
                                    │
                             ┌──────▼───────┐
                             │   Web UI     │
                             │  (HTML/JS)   │
                             └──────────────┘
```

### Components

1. **TinyOlly Backend (`tinyolly.py`)**
   - Flask API that receives traces, logs, and metrics
   - Stores data in Redis with 10-minute TTL
   - Provides query APIs for the UI
   - ~300 lines of Python

2. **Redis Storage**
   - In-memory storage with automatic expiration
   - Indexed by trace_id for correlation
   - Time-series data for metrics
   - Max 256MB memory (configurable)

3. **Web UI (`tinyolly.html`)**
   - Single-page application (no frameworks)
   - Trace waterfall visualization with D3.js-style charts
   - Log viewer with trace correlation
   - Metrics charts
   - Auto-refresh every 5 seconds

## 🚀 Quick Start

### Start TinyOlly

```bash
./07-start-tinyolly.sh
```

This starts:
- Redis (port 6379)
- TinyOlly backend (port 5002)
- Demo Flask app (port 5001)
- OTEL Collector (port 4317)

### Access the UI

Open in your browser:
```
http://localhost:5002
```

### Generate Traffic

```bash
./02-test-traffic.sh
```

This generates traces, logs, and metrics that flow into TinyOlly.

### Stop Services

```bash
./08-stop-tinyolly.sh
```

## 📊 Features

### Trace Visualization

- **Waterfall View**: Visual timeline of span execution
- **Span Details**: Duration, timing, and relationships
- **Trace List**: Recent traces with duration and span count
- **Correlation**: Click on a trace to see associated logs

### Log Correlation

- **Structured Logs**: JSON logs with trace/span IDs
- **Filtering**: Filter logs by trace ID
- **Severity Levels**: Color-coded INFO, WARNING, ERROR
- **Trace Links**: Click on trace ID to jump to trace view

### Metrics

- **Time-Series Charts**: Simple line charts showing metric trends
- **Real-Time Updates**: Auto-refresh every 5 seconds
- **Custom Metrics**: Any metric sent to TinyOlly is displayed
- **Last Value**: Shows most recent value prominently

## 🔧 API Endpoints

### Ingestion APIs

```bash
# Send traces
POST /v1/traces
{
  "traceId": "abc123...",
  "spanId": "def456...",
  "name": "my-operation",
  "startTimeUnixNano": 1234567890000000000,
  "endTimeUnixNano": 1234567890100000000
}

# Send logs
POST /v1/logs
{
  "timestamp": 1700000000.123,
  "severity": "INFO",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "message": "Operation completed"
}

# Send metrics
POST /v1/metrics
{
  "name": "http.requests",
  "timestamp": 1700000000.123,
  "value": 1,
  "labels": {"method": "GET", "endpoint": "/api"}
}
```

### Query APIs

```bash
# Get recent traces
GET /api/traces?limit=50

# Get specific trace
GET /api/traces/{trace_id}

# Get logs (optionally filtered by trace)
GET /api/logs?trace_id={trace_id}&limit=100

# Get metric names
GET /api/metrics

# Get metric time-series
GET /api/metrics/{name}?start={ts}&end={ts}

# Get statistics
GET /api/stats
```

## 💾 Storage Details

### Data Structure in Redis

```
# Traces
trace:{trace_id}:spans          - List of span JSON objects
trace:{trace_id}:logs           - List of log IDs for this trace
trace_index                     - Sorted set of trace IDs by time

# Logs
log:{log_id}                    - Individual log JSON
log_index                       - Sorted set of log IDs by time

# Metrics
metric:{metric_name}            - Sorted set of metric values by time
metric_names                    - Set of all metric names

# Spans
span:{span_id}                  - Individual span JSON
```

### TTL (Time To Live)

All data expires after **10 minutes** (600 seconds). This is configurable in `tinyolly.py`:

```python
TTL_SECONDS = 600  # Change this value
```

### Memory Management

Redis is configured with:
- Max memory: 256MB
- Eviction policy: `allkeys-lru` (Least Recently Used)

This ensures the system stays lightweight even with continuous data ingestion.

## 🎨 UI Features

### Dark Theme

Modern dark theme optimized for long viewing sessions, similar to popular developer tools.

### Auto-Refresh

The UI automatically refreshes every 5 seconds to show new data. Manual refresh available via the refresh button.

### Trace Waterfall

- Visual representation of span timing
- Proportional bar widths showing relative duration
- Hover effects for better UX
- Detailed timing information

### Responsive Design

Works on desktop and tablet screens. Optimized for screens ≥1024px wide.

## 🧪 Testing

### Manual Testing

```bash
# Start TinyOlly
./07-start-tinyolly.sh

# Generate traffic
./02-test-traffic.sh

# View UI
open http://localhost:5002

# Stop
./08-stop-tinyolly.sh
```

### Send Custom Data

```bash
# Send a custom trace
curl -X POST http://localhost:5002/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "traceId": "01234567890abcdef01234567890abcdef",
    "spanId": "0123456789abcdef",
    "name": "test-operation",
    "startTimeUnixNano": 1700000000000000000,
    "endTimeUnixNano": 1700000000100000000
  }'

# Send a custom log
curl -X POST http://localhost:5002/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1700000000.0,
    "severity": "INFO",
    "trace_id": "01234567890abcdef01234567890abcdef",
    "message": "Test log message"
  }'

# Send a custom metric
curl -X POST http://localhost:5002/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test.metric",
    "timestamp": 1700000000.0,
    "value": 42.5
  }'
```

## 🔍 How It Works

### Trace Correlation

1. App generates a trace with `trace_id` and `span_id`
2. When logging, the app includes these IDs in the log entry
3. TinyOlly stores both traces and logs
4. Logs are indexed by `trace_id` for fast correlation
5. UI queries logs by `trace_id` to show correlated logs

### Waterfall Rendering

1. Query trace to get all spans
2. Calculate trace start (min span start time)
3. Calculate trace duration (max end - min start)
4. For each span:
   - Calculate offset: `(span_start - trace_start) / trace_duration`
   - Calculate width: `span_duration / trace_duration`
   - Render as percentage-based positioned div

### Metric Visualization

1. Metrics stored as sorted sets in Redis (score = timestamp)
2. Query returns time-series data points
3. UI renders simple line chart using Canvas API
4. Auto-scales to min/max values

## 🛠️ Customization

### Change TTL

Edit `tinyolly.py`:

```python
TTL_SECONDS = 1800  # 30 minutes instead of 10
```

### Change Redis Memory Limit

Edit `docker-compose-with-tinyolly.yml`:

```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Add New Metrics

Just send them via the API - they'll automatically appear in the UI:

```bash
curl -X POST http://localhost:5002/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{"name": "my.custom.metric", "timestamp": 1700000000.0, "value": 123}'
```

### Customize UI Theme

Edit `templates/tinyolly.html` and modify the CSS variables:

```css
body {
    background: #0d1117;  /* Background color */
    color: #c9d1d9;       /* Text color */
}

.stat-card .value {
    color: #58a6ff;       /* Accent color */
}
```

## 📚 Learning Objectives

By studying TinyOlly, you'll learn:

1. **How observability backends store data**
   - Time-series data structures
   - Indexing strategies for fast queries
   - TTL and memory management

2. **How trace correlation works**
   - Using trace_id and span_id
   - Linking logs to traces
   - Querying related telemetry

3. **How to visualize traces**
   - Waterfall/Gantt chart rendering
   - Proportional timing visualization
   - Interactive trace exploration

4. **How to build web-based observability UIs**
   - Single-page applications
   - Real-time data updates
   - Chart rendering without heavy frameworks

## 🚀 Production Considerations

TinyOlly is a **learning tool** and not production-ready. For production, consider:

- **Persistent storage**: Use a database instead of Redis
- **High availability**: Multiple backend instances with load balancing
- **Security**: Authentication, authorization, input validation
- **Scalability**: Message queues for ingestion, separate storage tier
- **Advanced features**: Query language, alerting, retention policies
- **Real OTLP support**: Parse actual OTLP protobuf format

## 🔗 Integration with TinyOTel

TinyOlly is designed to work seamlessly with the TinyOTel demo:

- Demo app sends data to both OTEL Collector and TinyOlly
- Same trace/span IDs used for correlation
- Same data visible in collector logs and TinyOlly UI
- Complementary: Collector for exporting, TinyOlly for visualization

## 📝 Code Overview

| File | Lines | Purpose |
|------|-------|---------|
| `tinyolly.py` | ~330 | Backend API and storage logic |
| `templates/tinyolly.html` | ~800 | Complete web UI with embedded JS/CSS |
| `Dockerfile.tinyolly` | ~15 | Container for TinyOlly backend |
| `docker-compose-with-tinyolly.yml` | ~45 | Full stack with Redis |

**Total custom code: ~1,200 lines** to build a complete observability backend!

## 🎓 Next Steps

1. **Explore the UI**: Click through traces, logs, and metrics
2. **Read the code**: Start with `tinyolly.py` to understand the backend
3. **Customize it**: Add new features, change the UI, experiment
4. **Build on it**: Add alerting, dashboards, or other features

## 💡 Why Build This?

Understanding how observability tools work internally makes you a better engineer:

- Deeper understanding of distributed tracing
- Better at debugging production systems
- More effective at instrumenting applications
- Prepared to extend or customize observability tools

TinyOlly proves that observability isn't magic - it's just good software engineering!

---

**Built with ❤️ to demystify observability**

