#!/bin/bash

echo "Viewing collector output with traces (Ctrl+C to exit)..."
docker-compose logs -f otel-collector

