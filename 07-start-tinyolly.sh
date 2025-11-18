#!/bin/bash

echo "Starting TinyOlly - Custom Observability Backend"
echo "=================================================="
echo ""
echo "TinyOlly includes:"
echo "  - Redis for fast in-memory storage (10 min TTL)"
echo "  - Custom backend API for traces, logs, metrics"
echo "  - Web UI with trace waterfall visualization"
echo "  - Log correlation by trace ID"
echo "  - Metrics visualization"
echo ""
echo "Starting services..."
echo ""

# Use docker-compose with TinyOlly config (rebuild to pick up changes)
docker-compose -f docker-compose-with-tinyolly.yml up -d --build

echo ""
echo "Services started!"
echo ""
echo "TinyOlly UI:    http://localhost:5002"
echo "Demo App:       http://localhost:5001"
echo "OTEL Collector: localhost:4317"
echo ""
echo "Generate traffic with: ./02-test-traffic.sh"
echo "View TinyOlly UI:      open http://localhost:5002"
echo "Stop services:         ./08-stop-tinyolly.sh"
echo ""

