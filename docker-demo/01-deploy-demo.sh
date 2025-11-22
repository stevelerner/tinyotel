#!/bin/bash
set +e  # Don't exit on errors

echo "========================================================"
echo "  TinyOlly - Deploy Demo Apps"
echo "========================================================"
echo ""

# Check if TinyOlly core is running
echo "Checking if TinyOlly core is running..."
if ! docker ps 2>/dev/null | grep -q "otel-collector"; then
    echo "✗ OTel Collector not found"
    echo ""
    echo "Please start TinyOlly core first:"
    echo "  cd ../docker"
    echo "  ./01-start-core.sh"
    echo ""
    exit 1
fi

if ! docker ps 2>/dev/null | grep -q "tinyolly-otlp-receiver"; then
    echo "✗ TinyOlly OTLP Receiver not found"
    echo ""
    echo "Please start TinyOlly core first:"
    echo "  cd ../docker"
    echo "  ./01-start-core.sh"
    echo ""
    exit 1
fi

echo "✓ TinyOlly core is running"
echo ""

# Deploy demo apps
echo "Deploying demo applications..."
echo ""

docker-compose -f docker-compose-demo.yml up -d --build 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "✗ Failed to deploy demo apps (exit code: $EXIT_CODE)"
    echo "Check the error messages above for details"
    exit 1
fi

echo ""
echo "========================================================"
echo "  Demo Apps Deployed!"
echo "========================================================"
echo ""
echo "Demo Frontend:  http://localhost:5001"
echo "TinyOlly UI:    http://localhost:5005"
echo ""
echo "The demo apps will automatically generate traffic."
echo "Watch the TinyOlly UI for traces, logs, and metrics!"
echo ""
echo "To stop demo apps:"
echo "  ./02-cleanup-demo.sh"
echo ""

