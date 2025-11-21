#!/bin/bash

echo "Starting TinyOlly - Custom Observability Backend"
echo "=================================================="
echo ""
echo "Starting complete observability stack:"
echo "  - Demo Frontend (instrumented app)"
echo "  - Demo Backend (instrumented service)"
echo "  - OpenTelemetry Collector"
echo "  - TinyOlly OTLP Receiver (parses OTLP from collector)"
echo "  - Redis (stores telemetry with 10-min TTL)"
echo "  - TinyOlly Frontend (web UI)"
echo ""
echo "Starting services..."
echo ""

# Use docker-compose with TinyOlly config (rebuild to pick up changes)
# Use docker-compose with TinyOlly config (rebuild to pick up changes)
docker-compose -f docker-compose.yml up -d --build

echo ""
echo "Services started!"
echo ""
echo "TinyOlly UI:    http://localhost:5005"
echo "Demo Frontend:  http://localhost:5001"
echo ""
echo "Next steps:"
echo "  1. Generate traffic: ./02-traffic.sh (keep running)"
echo "  2. Open TinyOlly UI: open http://localhost:5005"
echo "  3. Stop services:    ./03-stop.sh"
echo ""

