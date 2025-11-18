#!/bin/bash

echo "Viewing metrics from collector (updates every ~2 seconds)..."
echo "Press Ctrl+C to stop"
echo ""

docker-compose logs -f otel-collector 2>&1 | grep --line-buffered -E "(Metrics|ResourceMetrics|Name: |Value: |Count: |Sum: |endpoint:|operation:|name:)" | grep --line-buffered -v "service.name"

