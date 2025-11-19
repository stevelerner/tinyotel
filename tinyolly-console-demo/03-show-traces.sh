#!/bin/bash

echo "Viewing traces from collector (Ctrl+C to exit)..."
docker-compose logs -f otel-collector

