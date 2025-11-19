#!/bin/bash

echo "Deep Clean - Removing ALL TinyOlly Docker Images"
echo "==========================================================="
echo ""
echo "This will:"
echo "  1. Stop all running containers"
echo "  2. Remove all TinyOlly containers"
echo "  3. Remove all TinyOlly images"
echo ""
read -p "Are you sure? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "Stopping all services..."
docker-compose down 2>/dev/null
docker-compose -f docker-compose-with-tinyolly.yml down 2>/dev/null

echo ""
echo "Removing containers..."
docker rm -f demo-frontend demo-backend otel-collector tinyolly tinyolly-redis tinyolly-otlp-receiver 2>/dev/null

echo ""
echo "Removing images..."
docker rmi tinyolly-demo-frontend tinyolly-demo-backend tinyolly-tinyolly tinyolly-tinyolly-otlp-receiver 2>/dev/null

echo ""
echo "Removing volumes..."
docker volume prune -f

echo ""
echo "Deep clean complete!"
echo ""

