#!/bin/bash

echo "Stopping TinyOlly Core services..."
echo ""

# Stop services defined in the core compose file
docker-compose -f docker-compose-tinyolly-core.yml down

echo ""
echo "Core services stopped"
