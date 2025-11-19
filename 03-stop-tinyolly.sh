#!/bin/bash

echo "Stopping TinyOlly services..."
docker-compose -f docker-compose-with-tinyolly.yml down

echo ""
echo "All services stopped"
echo ""

