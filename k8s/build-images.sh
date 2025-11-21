#!/bin/bash

# Point to Minikube's Docker daemon
eval $(minikube docker-env)

# Build images
echo "Building tinyolly-ui..."
docker build -t tinyolly-ui:latest -f docker/Dockerfile.tinyolly docker/

echo "Building tinyolly-otlp-receiver..."
docker build -t tinyolly-otlp-receiver:latest -f docker/Dockerfile.tinyolly-otlp-receiver docker/

echo "Images built successfully in Minikube environment."
