#!/bin/bash

echo "Starting TinyOTel OpenTelemetry Collector..."
docker-compose up -d

echo ""
echo "OpenTelemetry Collector is running!"
echo ""
echo "View logs with: docker-compose logs -f"
echo "Stop with: ./cleanup.sh"

