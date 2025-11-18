# TinyOTel - Minimal OpenTelemetry Demo

A minimal OpenTelemetry demo showing metrics, traces, and logs.

## Step 1: OpenTelemetry Collector

The collector is configured with:
- Receivers: OTLP (gRPC on port 4317, HTTP on port 4318)
- Exporters: Debug/Console exporter with detailed verbosity
- Pipelines: Traces, Metrics, and Logs

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

### Cleanup

```bash
./cleanup.sh
```

