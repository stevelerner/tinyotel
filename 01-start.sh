#!/bin/bash

echo "Starting TinyOlly OpenTelemetry Collector..."
docker-compose up -d

echo ""
echo "OpenTelemetry Collector is running!"
echo ""
echo "Next steps:"
echo "  Generate traffic: ./02-continuous-traffic.sh"
echo "  View logs:        ./03-show-logs.sh"
echo "  View traces:      ./04-show-traces.sh"
echo "  View metrics:     ./05-show-metrics.sh"
echo "  Cleanup:          ./06-cleanup.sh"

