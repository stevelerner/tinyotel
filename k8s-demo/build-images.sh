#!/bin/bash

# Build demo app images in Minikube's Docker environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building demo app images in Minikube..."
echo ""

# Point to Minikube's Docker daemon
eval $(minikube docker-env)

# Build frontend image
echo "Building demo-frontend..."
docker build -t demo-frontend:latest -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR/"

echo ""
echo "Building demo-backend..."
docker build -t demo-backend:latest -f "$SCRIPT_DIR/Dockerfile.backend" "$SCRIPT_DIR/"

echo ""
echo "✓ Demo images built successfully in Minikube environment."
echo ""
echo "Images created:"
echo "  - demo-frontend:latest"
echo "  - demo-backend:latest"

