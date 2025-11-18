#!/bin/bash

echo "Starting TinyOTel OpenTelemetry Collector..."
docker-compose up -d

echo ""
echo "OpenTelemetry Collector is running!"
echo ""
echo "Generate traffic with: ./02-test-traffic.sh"
echo "View logs with: ./03-logs.sh"
echo "Stop with: ./06-cleanup.sh"

