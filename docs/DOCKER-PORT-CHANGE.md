# Docker Port Change - Summary

## Problem
Docker and Kubernetes versions both used port **5002**, preventing them from running simultaneously on the same machine.

## Solution
Changed Docker version to use port **5005** externally while K8s continues to use **5002**.

## Port Assignments

| Environment | External Port | Internal Port | URL |
|-------------|---------------|---------------|-----|
| **Kubernetes** | 5002 | 5002 | `http://localhost:5002` |
| **Docker** | 5005 | 5002 | `http://localhost:5005` |

## Changes Made

### 1. Docker Compose Files

#### `/docker/docker-compose-tinyolly-core.yml`
```yaml
tinyolly:
  ports:
    - "5005:5002"  # Changed from "5002:5002"
```

#### `/docker/tinyolly-demo/docker-compose.yml`
```yaml
tinyolly:
  ports:
    - "5005:5002"  # Changed from "5002:5002"
```

### 2. Startup Scripts

#### `/docker/01-start-core.sh`
- Changed: `http://localhost:5002` → `http://localhost:5005`

#### `/docker/tinyolly-demo/01-start.sh`
- Changed: `http://localhost:5002` → `http://localhost:5005`

### 3. Documentation

#### `README.md`
- Docker demo section: Updated to `http://localhost:5005`
- Docker core section: Updated to `http://localhost:5005` with note about port choice

#### `/docker/tinyolly-demo/README.md`
- Updated UI URL to `http://localhost:5005`

### 4. Dockerfile Updates (JS Extraction Fix)

Both Dockerfiles now include the `static/` folder:

#### `/docker/Dockerfile.tinyolly`
```dockerfile
COPY static/ static/
```

#### `/docker/tinyolly-demo/Dockerfile.tinyolly`
```dockerfile
COPY static/ static/
```

## Benefits

✅ **Run both simultaneously** - Docker and K8s can run on the same machine
✅ **No port conflicts** - Different external ports prevent binding errors
✅ **Easy comparison** - Test Docker vs K8s deployments side-by-side
✅ **Development workflow** - Develop on Docker (5005), deploy to K8s (5002)

## Usage

### Start Docker Demo
```bash
cd docker/tinyolly-demo
./01-start.sh
# Access at: http://localhost:5005
```

### Start K8s
```bash
minikube start
kubectl apply -f k8s/
minikube tunnel
# Access at: http://localhost:5002
```

### Run Both at Once
```bash
# Terminal 1: Start Docker
cd docker/tinyolly-demo && ./01-start.sh

# Terminal 2: Start K8s
minikube tunnel

# Now you have:
# - Docker: http://localhost:5005
# - K8s:    http://localhost:5002
```

## Port Conflict Resolution

If you see errors like:
```
Error: bind: address already in use
```

**Diagnosis:**
```bash
# Check what's using port 5005
lsof -i :5005

# Check what's using port 5002
lsof -i :5002
```

**Resolution:**
- K8s using 5002? That's expected (stop `minikube tunnel` if needed)
- Docker using 5005? That's expected (stop with `./03-stop.sh` if needed)
- Something else? Kill that process or change TinyOlly port

## Internal Port (5002)

Both Docker and K8s use **5002 internally** because:
1. Flask app listens on 5002 (see `tinyolly-ui.py`)
2. No need to change application code
3. Only external mapping differs

```
Docker:     localhost:5005 → container:5002 → Flask:5002
Kubernetes: localhost:5002 → service:5002 → pod:5002 → Flask:5002
```

## Testing

### Verify Docker Works
```bash
cd docker/tinyolly-demo
./01-start.sh

# Wait 30 seconds for services to start
curl http://localhost:5005/api/stats

# Expected: {"traces": 0, "logs": 0, "metrics": 0, ...}
```

### Verify K8s Works
```bash
# In a separate terminal
minikube tunnel

# In another terminal
curl http://localhost:5002/api/stats

# Expected: {"traces": 0, "logs": 0, "metrics": 0, ...}
```

### Verify Both Work Together
```bash
# Docker
curl http://localhost:5005/api/stats

# K8s
curl http://localhost:5002/api/stats

# Both should respond independently
```

## Rollback

If you need to revert Docker back to port 5002:

```bash
# 1. Edit docker-compose files
sed -i '' 's/5005:5002/5002:5002/g' docker/docker-compose-tinyolly-core.yml
sed -i '' 's/5005:5002/5002:5002/g' docker/tinyolly-demo/docker-compose.yml

# 2. Edit scripts
sed -i '' 's/5005/5002/g' docker/01-start-core.sh
sed -i '' 's/5005/5002/g' docker/tinyolly-demo/01-start.sh

# 3. Rebuild
cd docker/tinyolly-demo && ./03-stop.sh && ./01-start.sh
```

## Summary

**Change:** Docker port **5002** → **5005**
**Reason:** Avoid conflict with Kubernetes
**Impact:** Minimal - just a port number change
**Benefits:** Run both Docker and K8s simultaneously

Docker users access TinyOlly at `http://localhost:5005` ✅

