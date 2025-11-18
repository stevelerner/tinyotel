# TinyOlly Quick Start Guide

## What You've Got

**TinyOlly** is a complete observability backend built from scratch in ~1,200 lines of code. No external observability tools used - just Python, Redis, and vanilla JavaScript!

## File Overview

```
tinyotel/
├── tinyolly.py                      # Backend API (~330 lines)
├── templates/tinyolly.html          # Web UI (~800 lines)
├── Dockerfile.tinyolly              # Container for backend
├── tinyolly-requirements.txt        # Python dependencies
├── docker-compose-with-tinyolly.yml # Full stack compose file
├── 07-start-tinyolly.sh            # Start script
├── 08-stop-tinyolly.sh             # Stop script
├── TINYOLLY-README.md              # Full documentation
└── TINYOLLY-QUICKSTART.md          # This file
```

## Start in 3 Steps

### 1. Start TinyOlly

```bash
./07-start-tinyolly.sh
```

This starts:
- Redis (in-memory storage with 10-min TTL)
- TinyOlly backend (Flask API on port 5002)
- Demo app (sends traces, logs, metrics)
- OTEL Collector

### 2. Generate Traffic

```bash
./02-test-traffic.sh
```

This sends requests to the demo app which forwards telemetry to TinyOlly.

### 3. View the UI

```bash
open http://localhost:5002
```

Or manually open: **http://localhost:5002**

## What You'll See

### Traces Tab
- List of recent traces with duration
- Click on any trace to see:
  - **Waterfall visualization** showing span timing
  - **Correlated logs** for that trace
  - Duration and span details

### Logs Tab
- All recent logs with structured JSON
- Filter by trace ID
- Click on trace ID to jump to trace view
- Color-coded severity (INFO, WARNING, ERROR)

### Metrics Tab
- Real-time charts for all metrics
- Auto-updates every 5 seconds
- Shows:
  - `http.server.requests`
  - `app.greetings.total`
  - `app.calculations.total`
  - `app.calculation.result`

## How It Works

### Data Flow

```
1. Demo App generates telemetry (traces, logs, metrics)
2. App sends to TinyOlly backend via HTTP POST
3. TinyOlly stores in Redis with 10-minute TTL
4. Web UI queries TinyOlly API
5. UI displays with auto-refresh
```

### Key Features

**Trace Correlation**: 
- Each log includes `trace_id` and `span_id`
- TinyOlly indexes logs by `trace_id`
- UI can query all logs for a specific trace
- Click on trace → see all related logs!

**Waterfall Rendering**:
- Calculate trace start/end times
- For each span, compute offset and width as percentages
- Render as positioned divs with proportional widths
- Visual representation of span timing

**TTL Storage**:
- All data expires after 10 minutes
- Redis automatically removes old data
- Keeps memory usage under 256MB
- Perfect for live debugging, not long-term storage

## Test It Out

### Send Custom Trace

```bash
curl -X POST http://localhost:5002/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "traceId": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "spanId": "bbbbbbbbbbbbbbbb",
    "name": "my-custom-trace",
    "startTimeUnixNano": 1700000000000000000,
    "endTimeUnixNano": 1700000000200000000
  }'
```

### Send Custom Log

```bash
curl -X POST http://localhost:5002/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1700000000.0,
    "severity": "INFO",
    "trace_id": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "message": "This is my custom log!"
  }'
```

Now refresh the UI and you'll see your custom data!

## Architecture Deep Dive

### Backend (`tinyolly.py`)

**Ingestion Endpoints**:
- `POST /v1/traces` - Receive traces
- `POST /v1/logs` - Receive logs  
- `POST /v1/metrics` - Receive metrics

**Query Endpoints**:
- `GET /api/traces` - List recent traces
- `GET /api/traces/{id}` - Get trace details
- `GET /api/logs?trace_id={id}` - Get logs (optionally filtered)
- `GET /api/metrics` - List metric names
- `GET /api/metrics/{name}` - Get metric time-series data
- `GET /api/stats` - Overall statistics

**Storage Functions**:
- `store_span()` - Index span by trace_id
- `store_log()` - Index log by time and trace_id
- `store_metric()` - Store in time-series sorted set

### Frontend (`tinyolly.html`)

**Core Functions**:
- `loadTraces()` - Fetch and display trace list
- `showTraceDetail()` - Load and render trace waterfall
- `renderWaterfall()` - Calculate and draw span bars
- `loadLogs()` - Fetch and display logs
- `loadTraceLog()` - Get logs for specific trace
- `loadMetrics()` - Fetch and render metric charts

**Auto-Refresh**:
```javascript
setInterval(() => {
    loadStats();
    refreshCurrentTab();
}, 5000); // Every 5 seconds
```

### Redis Data Model

```
# Traces
trace:{trace_id}:spans         -> List of span JSON
trace_index                    -> Sorted set (score=timestamp)

# Logs  
log:{log_id}                   -> Log JSON
log_index                      -> Sorted set (score=timestamp)
trace:{trace_id}:logs          -> List of log IDs

# Metrics
metric:{name}                  -> Sorted set (score=timestamp)
metric_names                   -> Set of names

# TTL applied to ALL keys (600 seconds)
```

## Customization Ideas

### Change TTL

Edit `tinyolly.py`:
```python
TTL_SECONDS = 1800  # 30 minutes
```

### Add Authentication

Add to `tinyolly.py`:
```python
from functools import wraps

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if token != 'Bearer secret-token':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/traces')
@require_auth
def get_traces():
    # ...
```

### Add More Metrics

Just send them! They'll automatically appear:
```bash
curl -X POST http://localhost:5002/v1/metrics \
  -d '{"name": "custom.metric", "value": 99}'
```

### Change Theme

Edit `templates/tinyolly.html` CSS:
```css
body {
    background: #ffffff;  /* Light theme */
    color: #000000;
}
```

## Stop Services

```bash
./08-stop-tinyolly.sh
```

## Learning Path

1. **Start with the UI** - Click around, explore the features
2. **Read tinyolly.py** - Understand the backend logic (~330 lines)
3. **Read tinyolly.html** - See how the UI works (~800 lines)
4. **Send custom data** - Use curl to experiment
5. **Modify and extend** - Add your own features!

## Common Issues

### Port Already in Use

```bash
# Check what's using port 5002
lsof -i :5002

# Kill the process or change the port in docker-compose
```

### Redis Not Starting

```bash
# Check Redis logs
docker logs tinyolly-redis

# Restart Redis
docker restart tinyolly-redis
```

### No Data Showing

```bash
# Check if services are running
docker ps

# Generate traffic
./02-test-traffic.sh

# Check backend logs
docker logs tinyolly
```

## Next Steps

- Read [TINYOLLY-README.md](TINYOLLY-README.md) for comprehensive documentation
- Experiment with the code
- Build your own features
- Use as a foundation for learning observability!

---

**You just built a complete observability backend from scratch! 🎉**

