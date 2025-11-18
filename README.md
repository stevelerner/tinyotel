# TinyOTel - Minimal OpenTelemetry Demo

A minimal OpenTelemetry demo showing metrics, traces, and logs.

## Components

### 1. OpenTelemetry Collector

The collector is configured with:
- Receivers: OTLP (gRPC on port 4317, HTTP on port 4318)
- Exporters: Debug/Console exporter with detailed verbosity
- Pipelines: Traces, Metrics, and Logs

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

### Quick Start

```bash
./01-start.sh
```

The collector will start and listen for OTLP data on ports 4317 (gRPC) and 4318 (HTTP).
All received telemetry data will be printed to the console.

### Generate Traffic

```bash
./02-test-traffic.sh
```

### View Logs

View all logs:
```bash
./03-logs.sh
```

View app logs with structured JSON and trace IDs:
```bash
./04-logs-app.sh
```

View collector output with traces:
```bash
./05-logs-collector.sh
```

### View Metrics

The collector exports metrics every 5 seconds via the debug exporter.

Watch metrics as they're collected:
```bash
./07-show-metrics.sh
```

Or view recent metrics manually:
```bash
docker-compose logs --tail=200 otel-collector | grep -E "(Metrics|app\.|http\.server\.requests)"
```

### Cleanup

```bash
./08-cleanup.sh
```

