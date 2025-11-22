#!/bin/bash

# TinyOlly Core - Rebuild Script
# Rebuilds all core services without stopping them

set +e

echo "============================================"
echo "TinyOlly Core - Rebuild"
echo "============================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "Rebuilding TinyOlly core services..."
echo ""

# Rebuild all services
docker-compose -f docker-compose-tinyolly-core.yml build 2>&1
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi

echo ""
echo "Restarting services..."
docker-compose -f docker-compose-tinyolly-core.yml up -d 2>&1
UP_EXIT_CODE=$?

if [ $UP_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Service restart failed with exit code $UP_EXIT_CODE"
    exit $UP_EXIT_CODE
fi

echo ""
echo "✓ Rebuild complete!"
echo ""
echo "Services:"
echo "  - TinyOlly UI:         http://localhost:5005"
echo "  - OpenTelemetry:       http://localhost:4318/v1/metrics (OTLP)"
echo "  - Redis:               localhost:6379"
echo ""
echo "Check status with: docker-compose -f docker-compose-tinyolly-core.yml ps"
echo ""

