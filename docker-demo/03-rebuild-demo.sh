#!/bin/bash

# TinyOlly Demo - Rebuild Script
# Rebuilds demo applications without stopping them

set +e

echo "============================================"
echo "TinyOlly Demo - Rebuild"
echo "============================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Check if core services are running
if ! docker ps | grep -q tinyolly; then
    echo "ERROR: TinyOlly core services are not running"
    echo "Please run 'cd ../docker && ./01-start-core.sh' first"
    exit 1
fi

echo "Rebuilding demo applications..."
echo ""

# Rebuild all demo services
docker-compose -f docker-compose-demo.yml build 2>&1
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi

echo ""
echo "Restarting demo services..."
docker-compose -f docker-compose-demo.yml up -d 2>&1
UP_EXIT_CODE=$?

if [ $UP_EXIT_CODE -ne 0 ]; then
    echo ""
    echo "ERROR: Service restart failed with exit code $UP_EXIT_CODE"
    exit $UP_EXIT_CODE
fi

echo ""
echo "✓ Demo rebuild complete!"
echo ""
echo "Demo applications are generating traffic automatically."
echo "View telemetry at: http://localhost:5005"
echo ""
echo "Optional: Run './03-generate-traffic.sh' for additional manual traffic"
echo ""

