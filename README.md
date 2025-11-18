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
- Logs with trace/span IDs embedded
- Exports traces to the OTEL collector

Endpoints (available at http://localhost:5001):
- `GET /` - Home page with endpoint list
- `GET /hello` - Random greeting with simulated work
- `GET /calculate` - Random calculation with logging
- `GET /error` - Simulates errors for testing

Each request generates:
- Automatic traces sent to the collector
- Logs with embedded trace_id and span_id for correlation

### Quick Start

```bash
./start.sh
```

The collector will start and listen for OTLP data on ports 4317 (gRPC) and 4318 (HTTP).
All received telemetry data will be printed to the console.

### View Logs

```bash
docker-compose logs -f
```

### Generate Traffic

```bash
./test-traffic.sh
```

### View App Logs (with trace IDs)

```bash
docker-compose logs -f app
```

### View Collector Output (traces)

```bash
docker-compose logs -f otel-collector
```

### Cleanup

```bash
./cleanup.sh
```

