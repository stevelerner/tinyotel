# Cardinality Protection - Quick Reference

## 🚀 Quick Start

TinyOlly automatically protects against metric cardinality explosions. **No configuration needed** for most users!

## 🎯 Default Settings

| Setting | Default | What It Means |
|---------|---------|---------------|
| **Max Metrics** | 1000 | Maximum unique metric names |
| **Display Limit** | 500 | Metrics shown in UI table |
| **TTL** | 30 min | How long metrics are kept |
| **Warning Threshold** | 70% | Yellow warning at 700 metrics |
| **Alert Threshold** | 90% | Red alert at 900 metrics |

## 📊 What You'll See

### Normal Operation (< 700 metrics)
```
Total Metrics: 450
```
✅ Everything is fine!

### Warning State (700-900 metrics)
```
⚠️ Cardinality: 750/1000 metrics (75%)
Total Metrics: 750 / 1000
```
🟡 Start investigating - check for UUID/ID patterns in metric names

### Critical State (900+ metrics)
```
⚠️ High cardinality: 950/1000 metrics (95%) - 23 metrics dropped
Total Metrics: 950 / 1000 (23 dropped)
```
🔴 **Action required** - metrics are being dropped!

### At Limit (1000 metrics)
```
⚠️ High cardinality: 1000/1000 metrics (100%) - 142 metrics dropped
Total Metrics: 1000 / 1000 (142 dropped)
ℹ️ Showing first 500 of 1000 metrics
```
🛑 **No new metrics accepted** until old ones expire

## 🔧 Configuration

### Increase Limit (Kubernetes)

```bash
# Temporary (until pod restart)
kubectl set env deployment/tinyolly-otlp-receiver MAX_METRIC_CARDINALITY=2000

# Permanent (edit manifest)
# k8s/tinyolly-otlp-receiver.yaml
env:
  - name: MAX_METRIC_CARDINALITY
    value: "2000"
    
kubectl apply -f k8s/tinyolly-otlp-receiver.yaml
```

### Increase Limit (Docker)

```bash
# docker-compose.yml
environment:
  MAX_METRIC_CARDINALITY: 2000
  
docker-compose up -d
```

## 🔍 Debugging

### Check Current Status

**Via UI:**
1. Open TinyOlly UI
2. Look at top stats: `Total Metrics: X / Y (Z dropped)`
3. Click **Metrics** tab for detailed warnings

**Via API:**
```bash
curl http://localhost:5002/api/stats | jq
```

Output:
```json
{
  "traces": 145,
  "logs": 892,
  "metrics": 850,
  "metrics_max": 1000,
  "metrics_dropped": 12
}
```

### Find Dropped Metrics

```bash
# Kubernetes
kubectl exec -it deployment/redis -- redis-cli SMEMBERS metric_dropped_names

# Docker
docker exec -it redis redis-cli SMEMBERS metric_dropped_names
```

Example output:
```
1) "user.login.count.user_12345"
2) "user.login.count.user_67890"
3) "api.request.session_abc123"
```

👀 **Notice the pattern?** User IDs and session IDs in metric names = bad!

## ✅ Best Practices

### DO ✅

```python
# Good: Use labels for high-cardinality data
metrics.counter("api.requests", {"user_id": user_id, "endpoint": "/login"})

# Good: Aggregate at source
metrics.counter("api.requests.total")
metrics.counter("api.errors.total")

# Good: Meaningful, stable names
metrics.gauge("system.memory.used_bytes")
```

### DON'T ❌

```python
# Bad: User ID in metric name
metrics.counter(f"api.requests.user_{user_id}")

# Bad: UUID in metric name
metrics.counter(f"session_{session_id}_duration")

# Bad: Timestamp in metric name
metrics.gauge(f"cpu.usage.{timestamp}")

# Bad: IP address in metric name
metrics.counter(f"requests_from_{ip_address}")
```

## 🎓 Understanding the Numbers

### What is "Cardinality"?

**Cardinality** = Number of unique metric names

```
Low Cardinality (Good):
- api.requests.total
- api.errors.total
- system.cpu.percent
Total: 3 metrics

High Cardinality (Bad):
- user.12345.login.count
- user.67890.login.count
- user.24680.login.count
... (10,000+ unique metrics)
```

### Why Does It Matter?

| Cardinality | Storage | Memory | UI Performance |
|-------------|---------|--------|----------------|
| 100 metrics | 10 KB | Minimal | Instant |
| 1,000 metrics | 100 KB | Low | Fast |
| 10,000 metrics | 1 MB | High | Slow/Freeze |
| 100,000 metrics | 10 MB | Critical | **Crash** |

**TinyOlly protects at 1,000 by default**

## 📈 When to Increase the Limit

### ✅ Increase if:
- You have **many distinct services** (100+ microservices)
- You have **many legitimate metric types** per service
- Your metrics follow **best practices** (no UUIDs in names)
- You **understand the memory/performance impact**

### ❌ Don't increase if:
- Metrics contain user IDs, session IDs, or UUIDs
- You haven't investigated **why** you hit the limit
- Dropped metrics show a **clear anti-pattern**
- You're just trying to **"make the warning go away"**

## 🚨 Common Patterns to Fix

### Pattern 1: User IDs in Metric Names

**Bad:**
```python
for user_id in users:
    metrics.counter(f"user_{user_id}_requests").inc()
```

**Fix:**
```python
metrics.counter("user_requests", {"user_id": str(user_id)}).inc()
# Or better: aggregate
metrics.counter("user_requests_total").inc()
```

### Pattern 2: Per-Session Metrics

**Bad:**
```python
metrics.gauge(f"session_{session_id}_duration").set(duration)
```

**Fix:**
```python
metrics.histogram("session_duration").observe(duration)
# Histogram automatically tracks min/max/avg/p95
```

### Pattern 3: Dynamic Resource Names

**Bad:**
```python
for pod in pods:
    metrics.gauge(f"pod_{pod.name}_memory").set(pod.memory)
```

**Fix:**
```python
for pod in pods:
    metrics.gauge("pod_memory", {"pod_name": pod.name}).set(pod.memory)
```

## 📚 More Information

- **Full Guide:** [CARDINALITY-PROTECTION.md](CARDINALITY-PROTECTION.md)
- **Implementation Details:** [CARDINALITY-IMPLEMENTATION-SUMMARY.md](CARDINALITY-IMPLEMENTATION-SUMMARY.md)
- **Main README:** [../README.md](../README.md)

## 💡 Key Takeaways

1. 🛡️ **Default limit of 1000** protects your system automatically
2. 🔔 **Warnings at 70%** give you time to investigate
3. 🔍 **Dropped metrics are tracked** for debugging
4. ⚙️ **Configurable** if you need more (but understand why first!)
5. 📊 **Use labels** instead of metric names for high-cardinality data

**Remember:** The goal isn't to maximize the number of metrics - it's to have **meaningful, actionable metrics** that help you understand your system!

