# Traffic Script Debugging Guide

## Important Note

**The `02-traffic.sh` script is now OPTIONAL!**

The demo apps (`demo-frontend` and `demo-backend`) now have **automatic traffic generation built-in**. When you run `./01-start.sh`, traffic starts flowing automatically.

**You only need `02-traffic.sh` if you want EXTRA traffic for testing.**

## Fixed Issues

The script has been improved with:
- ✅ Pre-flight check (verifies service is running before starting)
- ✅ Proper error handling (`set +e` to prevent exit on curl failures)
- ✅ Graceful Ctrl+C handling (trap INT)
- ✅ Timeout protection (5 second timeout per request)
- ✅ Failure tracking (warns after 5 consecutive failures)
- ✅ Visual feedback (✓/✗ for each request)

## Common Issues & Solutions

### Issue 1: Script Exits Immediately

**Symptoms:**
```
Checking if demo-frontend is available at http://localhost:5001...
ERROR: Cannot connect to demo-frontend at http://localhost:5001
```

**Cause:** Demo services aren't running.

**Solution:**
```bash
# Check if containers are running
docker ps | grep demo

# If not running, start them
./01-start.sh

# Wait 30 seconds for services to fully start
sleep 30

# Try traffic script again (but remember it's optional!)
./02-traffic.sh
```

### Issue 2: Script "Crashes" Terminal

**Symptoms:**
- Terminal becomes unresponsive
- Can't type commands
- Script won't stop with Ctrl+C

**Causes:**
1. Infinite loop without proper signal handling
2. Terminal input buffering issues

**Solutions:**

**Immediate Fix:**
```bash
# Force kill the script
Ctrl+Z  # Suspend the process
bg      # Send to background
jobs    # List background jobs
kill %1 # Kill job 1 (adjust number as needed)
```

**Or:**
```bash
# In another terminal
ps aux | grep 02-traffic
kill <PID>
```

**Permanent Fix:**
The updated script now has proper Ctrl+C handling via `trap`.

### Issue 3: Many Failed Requests

**Symptoms:**
```
✗ GET / (failed)
✗ GET /hello (failed)
⚠️  WARNING: 5 consecutive failures
```

**Cause:** Demo services crashed or stopped.

**Solution:**
```bash
# Check container logs
docker logs demo-frontend
docker logs demo-backend

# Restart if needed
./03-stop.sh
./01-start.sh
```

### Issue 4: Script Runs But No Data in TinyOlly

**Symptoms:**
- Script shows ✓ successful requests
- But TinyOlly UI at `http://localhost:5005` shows no data

**Cause:** OpenTelemetry pipeline might be broken.

**Solution:**
```bash
# Check all containers
docker ps

# Expected containers:
# - demo-frontend
# - demo-backend  
# - otel-collector
# - tinyolly-otlp-receiver
# - tinyolly (UI)
# - redis

# Check OTel Collector logs
docker logs otel-collector

# Check TinyOlly receiver logs
docker logs tinyolly-otlp-receiver

# Restart everything
./03-stop.sh
./01-start.sh
```

## Manual Testing (Without Script)

You don't need the script! Just use curl directly:

```bash
# Simple request
curl http://localhost:5001/hello

# Complex trace
curl http://localhost:5001/process-order

# Error endpoint
curl http://localhost:5001/error

# Check TinyOlly received it
curl http://localhost:5005/api/stats
```

## Automatic Traffic (Recommended)

The demo apps now generate traffic automatically every few seconds. Just:

```bash
# 1. Start demo
./01-start.sh

# 2. Wait 30 seconds

# 3. Open TinyOlly UI
open http://localhost:5005

# 4. Watch data flow automatically!
```

No manual script needed! 🎉

## Script Permissions

If you get "Permission denied":

```bash
chmod +x 02-traffic.sh
./02-traffic.sh
```

## Stop the Script

Press **Ctrl+C** (the script now handles this gracefully).

## Debugging the Script Itself

Enable debug output:

```bash
# Run with verbose mode
bash -x 02-traffic.sh
```

Check if curl is working:

```bash
# Test curl manually
curl -v http://localhost:5001/hello

# If this fails, the issue is not the script
```

## When to Use the Script

**Use the script when:**
- ✅ You want to generate EXTRA load for testing
- ✅ You want to test specific endpoints
- ✅ You're testing cardinality limits
- ✅ You need consistent traffic patterns

**Don't use the script when:**
- ❌ You just want to see TinyOlly in action (auto-traffic is enough)
- ❌ The demo services aren't running yet
- ❌ You're debugging other issues (one less thing to worry about)

## Summary

**Remember:** The script is **OPTIONAL** now! 

The demo apps generate traffic automatically. Only use `02-traffic.sh` if you need extra load for testing.

If the script exits:
1. Check if services are running: `docker ps | grep demo`
2. Start services: `./01-start.sh`
3. Wait 30 seconds
4. Try again (or just rely on auto-traffic!)

