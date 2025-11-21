# TinyOlly Kubernetes Troubleshooting Guide

This guide helps you diagnose and fix common issues with the TinyOlly Kubernetes deployment.

## Quick Diagnostic Commands

```bash
# Run the comprehensive test script
./k8s/test-deployment.sh

# Check pod status
kubectl get pods

# Check pod logs
kubectl logs <pod-name>

# Describe a pod (shows events and errors)
kubectl describe pod <pod-name>

# Check services
kubectl get services
```

## Common Issues and Solutions

### 1. ImagePullBackOff or ErrImagePull

**Symptoms:**
- Pod status shows `ImagePullBackOff` or `ErrImagePull`
- Logs show: "Failed to pull image"

**Cause:** Docker images not built or not available in the cluster

**Solution for Minikube:**
```bash
# Make sure you're using Minikube's Docker daemon
eval $(minikube docker-env)

# Rebuild images
./k8s/build-images.sh

# Verify images exist
minikube ssh "docker images | grep tinyolly"

# Delete and recreate the pods
kubectl delete pod -l app=tinyolly-ui
kubectl delete pod -l app=tinyolly-otlp-receiver
```

**Solution for other clusters:**
- Build and push images to your container registry
- Update the image names in the YAML files to reference your registry
- Example: `your-registry.com/tinyolly-ui:latest`

### 2. CrashLoopBackOff

**Symptoms:**
- Pod status shows `CrashLoopBackOff`
- Pods restart repeatedly

**Common Causes:**

#### A. Redis Connection Failed

Check logs:
```bash
kubectl logs deployment/tinyolly-ui
kubectl logs deployment/tinyolly-otlp-receiver
```

If you see connection errors like "Connection refused" or "Cannot connect to Redis":

**Solution:**
```bash
# Check if Redis is running
kubectl get pods -l app=redis

# Check Redis logs
kubectl logs deployment/redis

# Verify Redis service exists
kubectl get service redis

# Test Redis connectivity from another pod
kubectl run -it --rm redis-test --image=redis:alpine --restart=Never -- redis-cli -h redis ping
```

#### B. Missing Dependencies

Check logs for import errors or missing modules:

**Solution:**
```bash
# Rebuild images with correct dependencies
eval $(minikube docker-env)
./k8s/build-images.sh

# Force pod recreation
kubectl rollout restart deployment/tinyolly-ui
kubectl rollout restart deployment/tinyolly-otlp-receiver
```

#### C. Application Error

Check the actual error in logs:
```bash
# Get detailed logs
kubectl logs deployment/tinyolly-ui --tail=100
kubectl logs deployment/tinyolly-ui --previous  # If pod restarted
```

### 3. Pods Running but Not Ready

**Symptoms:**
- Pod shows `Running` but `Ready: 0/1`
- Services not accessible

**Cause:** Application failed to start properly or health checks failing

**Solution:**
```bash
# Check pod details
kubectl describe pod <pod-name>

# Look for readiness probe failures
# Check application logs
kubectl logs <pod-name>

# Get into the container for debugging
kubectl exec -it <pod-name> -- /bin/sh

# Inside container, check if app is listening
# apt-get update && apt-get install -y curl
# curl localhost:5002  # for UI
# curl localhost:5003  # for receiver
```

### 4. OTel Collector Issues

**Symptoms:**
- OTel Collector pod not starting
- Configuration errors in logs

**Solution:**
```bash
# Check OTel Collector logs
kubectl logs deployment/otel-collector

# Verify ConfigMap
kubectl get configmap otel-collector-config -o yaml

# Common issues:
# - Invalid YAML in ConfigMap
# - Wrong endpoint configuration

# Test configuration manually
kubectl exec -it deployment/otel-collector -- cat /etc/otel-collector-config.yaml
```

### 5. Service Not Accessible (LoadBalancer Pending)

**Symptoms:**
- `kubectl get services` shows `EXTERNAL-IP` as `<pending>` for tinyolly-ui

**Cause:** LoadBalancer requires external integration

**Solution for Minikube:**
```bash
# Start minikube tunnel in a separate terminal
minikube tunnel

# Keep it running and access the UI at http://localhost:5002
```

**Solution for other local clusters:**
- Use `NodePort` instead of `LoadBalancer`:
```bash
kubectl patch service tinyolly-ui -p '{"spec":{"type":"NodePort"}}'
kubectl get service tinyolly-ui  # Note the NodePort
minikube ip  # Get Minikube IP
# Access at http://<minikube-ip>:<nodeport>
```

### 6. Environment Variables Not Set

**Symptoms:**
- Apps can't find Redis
- Connection to wrong host

**Solution:**
```bash
# Verify environment variables in pods
kubectl exec deployment/tinyolly-ui -- env | grep REDIS
kubectl exec deployment/tinyolly-otlp-receiver -- env | grep REDIS

# Should show:
# REDIS_HOST=redis
# REDIS_PORT=6379

# If not set correctly, check the deployment YAML files
```

### 7. DNS Resolution Issues

**Symptoms:**
- Services can't resolve each other by name
- "Name or service not known" errors

**Solution:**
```bash
# Test DNS resolution from a pod
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup redis
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup tinyolly-otlp-receiver

# Check CoreDNS is running
kubectl get pods -n kube-system | grep coredns

# Restart CoreDNS if needed
kubectl rollout restart deployment/coredns -n kube-system
```

## Step-by-Step Debugging Process

1. **Check Pod Status:**
   ```bash
   kubectl get pods
   ```

2. **Identify Failed Pods:** Look for status other than `Running` with `Ready: 1/1`

3. **Get Pod Logs:**
   ```bash
   kubectl logs <failing-pod-name>
   kubectl logs <failing-pod-name> --previous  # If restarted
   ```

4. **Describe Pod for Events:**
   ```bash
   kubectl describe pod <failing-pod-name>
   ```

5. **Check Service Connectivity:**
   ```bash
   kubectl get services
   kubectl get endpoints  # Shows if services have backend pods
   ```

6. **Test from Inside Cluster:**
   ```bash
   kubectl run -it --rm debug --image=busybox --restart=Never -- sh
   # Inside the pod:
   wget -O- http://redis:6379
   wget -O- http://tinyolly-ui:5002/health
   ```

## Complete Reset

If all else fails, perform a complete reset:

```bash
# 1. Clean up everything
./k8s/cleanup.sh

# 2. Rebuild images (for Minikube)
eval $(minikube docker-env)
./k8s/build-images.sh

# 3. Redeploy
kubectl apply -f k8s/

# 4. Watch deployment progress
kubectl get pods -w

# 5. Run diagnostics
./k8s/test-deployment.sh
```

## Getting Help

When asking for help, provide:

1. Output of `kubectl get pods`
2. Output of `kubectl describe pod <failing-pod>`
3. Output of `kubectl logs <failing-pod>`
4. Your Kubernetes version: `kubectl version`
5. Your cluster type (Minikube, Docker Desktop, cloud, etc.)

## Useful Debug Commands

```bash
# Watch pods in real-time
kubectl get pods -w

# Get all resources
kubectl get all

# Get events sorted by time
kubectl get events --sort-by='.lastTimestamp'

# Execute commands in a running pod
kubectl exec -it <pod-name> -- /bin/bash

# Port forward for local testing
kubectl port-forward service/tinyolly-ui 5002:5002

# Get resource usage
kubectl top pods  # Requires metrics-server

# View pod YAML
kubectl get pod <pod-name> -o yaml

# Check pod IP addresses
kubectl get pods -o wide
```

