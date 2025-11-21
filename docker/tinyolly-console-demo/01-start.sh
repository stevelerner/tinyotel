#!/bin/bash

echo "Starting TinyOlly OpenTelemetry Collector..."
docker-compose up -d

echo ""
echo "OpenTelemetry Collector is running!"
echo ""
echo "Next steps:"
echo "  Generate traffic: ./02-traffic.sh"
echo "  View logs:        ./02-show-logs.sh"
echo "  View traces:      ./03-show-traces.sh"
echo "  View metrics:     ./04-show-metrics.sh"
echo "  Cleanup:          ./05-cleanup.sh"

