#!/bin/bash

echo "========================================================"
echo "  TinyOlly - Cleanup Demo Apps"
echo "========================================================"
echo ""

echo "Stopping and removing demo containers..."
docker-compose -f docker-compose-demo.yml down

echo ""
echo "✓ Demo apps removed"
echo ""
echo "TinyOlly core is still running."
echo "To stop core: cd .. && ./02-stop-core.sh"
echo ""

