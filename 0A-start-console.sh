#!/bin/bash

echo "Starting TinyOlly OpenTelemetry Collector..."
docker-compose up -d

echo ""
echo "OpenTelemetry Collector is running!"
echo ""
echo "Next steps:"
echo "  Generate traffic: ./02-continuous-traffic.sh"
echo "  View logs:        ./0C-show-logs.sh"
echo "  View traces:      ./0D-show-traces.sh"
echo "  View metrics:     ./0E-show-metrics.sh"
echo "  Cleanup:          ./0F-cleanup.sh"

