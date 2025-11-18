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
- Automatic traces sent to the collector via OTLP
- Structured JSON logs with fields:
  - `timestamp` (ISO 8601 format with timezone)
  - `severity` (INFO, WARNING, ERROR)
  - `trace_id` (32-character hex string)
  - `span_id` (16-character hex string)
  - `message` (log message)

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

### Cleanup

```bash
./06-cleanup.sh
```

