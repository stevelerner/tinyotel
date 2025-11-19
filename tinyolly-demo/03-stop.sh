#!/bin/bash

echo "Stopping TinyOlly services..."
docker-compose -f docker-compose.yml down

echo ""
echo "All services stopped"
echo ""

