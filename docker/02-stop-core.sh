#!/bin/bash
set +e  # Don't exit on errors

echo "Stopping TinyOlly Core services..."
echo ""

# Stop services defined in the core compose file
docker-compose -f docker-compose-tinyolly-core.yml down 2>&1

echo ""
echo "✓ Core services stopped"
