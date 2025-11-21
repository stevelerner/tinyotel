# Cardinality Protection

## Overview

TinyOlly implements multi-layer cardinality protection to prevent metric explosion that can overwhelm storage, memory, and the UI.

## What is Cardinality?

**Cardinality** is the number of unique time series created by your metrics. High cardinality happens when:
- Metric names include high-variance data (user IDs, session IDs, timestamps)
- Labels/attributes have many unique values (IP addresses, UUIDs)
- Dynamic metric names are generated at runtime

### Example of Cardinality Explosion

❌ **Bad** (High Cardinality):
```
user.login.count.user_12345
user.login.count.user_67890
user.login.count.user_24680
... (10,000+ unique metrics)
```

✅ **Good** (Low Cardinality):
```
user.login.count  (with user_id as a label/attribute)
```

## Protection Layers

### 1. Storage Layer (Backend)

**File:** `tinyolly_redis_storage.py`

- **Hard Limit:** 1000 unique metric names by default (configurable via `MAX_METRIC_CARDINALITY` env var)
- **Behavior:** When limit is reached, new metrics are **dropped** and logged
- **Tracking:** Dropped metrics are tracked in `metric_dropped_count` and `metric_dropped_names` (kept for 1 hour)

```python
# Configuration
MAX_METRIC_CARDINALITY = int(os.getenv('MAX_METRIC_CARDINALITY', 1000))

# In store_metric():
if not is_existing and current_count >= self.max_cardinality:
    # Drop and track
    self.client.incr('metric_dropped_count')
    self.client.sadd('metric_dropped_names', name)
    return  # Metric not stored
```

### 2. API Layer

**File:** `tinyolly-ui.py`

- **Pagination:** `/api/metrics?limit=N` supports limiting returned metrics
- **Metadata:** API returns cardinality stats alongside metric names

```json
{
  "names": ["metric1", "metric2", ...],
  "cardinality": {
    "current": 450,
    "max": 1000,
    "dropped_count": 0,
    "dropped_names": []
  }
}
```

### 3. UI Layer

**File:** `templates/tinyolly.html`

- **Display Limit:** Shows first 500 metrics only
- **Visual Warnings:**
  - 🟡 **Yellow Warning:** 70-90% of limit reached
  - 🔴 **Red Alert:** 90%+ of limit reached
- **Info Messages:** Shows when metrics are truncated for display

#### Warning Examples

**70-90% (Yellow):**
```
⚠️ Cardinality: 750/1000 metrics (75%)
```

**90%+ (Red):**
```
⚠️ High cardinality: 950/1000 metrics (95%) - 12 metrics dropped
```

**Display Limit:**
```
ℹ️ Showing first 500 of 945 metrics
```

### 4. Stats Dashboard

The stats at the top of the UI show:
```
Total Metrics: 850 / 1000 (23 dropped)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_METRIC_CARDINALITY` | 1000 | Maximum unique metric names |
| `REDIS_TTL` | 1800 | Metric retention (seconds) |

### Kubernetes Deployment

Update `k8s/tinyolly-otlp-receiver.yaml`:

```yaml
env:
  - name: MAX_METRIC_CARDINALITY
    value: "2000"  # Increase limit
  - name: REDIS_TTL
    value: "3600"  # 1 hour retention
```

### Docker Deployment

Update `docker-compose.yml`:

```yaml
environment:
  MAX_METRIC_CARDINALITY: 2000
  REDIS_TTL: 3600
```

## Monitoring

### Check Current Cardinality

1. **UI Stats Tab:** Shows `current / max (dropped)`
2. **Metrics Tab:** Yellow/red warnings when approaching limit
3. **API Endpoint:** `GET /api/stats`

```bash
curl http://localhost:5002/api/stats
```

Response:
```json
{
  "traces": 145,
  "logs": 892,
  "metrics": 850,
  "metrics_max": 1000,
  "metrics_dropped": 23
}
```

### Investigate Dropped Metrics

```bash
# Connect to Redis
kubectl exec -it deployment/redis -- redis-cli

# Check dropped count
> GET metric_dropped_count
"23"

# See which metrics were dropped
> SMEMBERS metric_dropped_names
1) "user.request.count.user_12345"
2) "user.request.count.user_67890"
...
```

## Best Practices

### ✅ Do's

1. **Use labels/attributes** instead of metric names for high-cardinality data
2. **Aggregate at source** before sending to TinyOlly
3. **Set appropriate limits** based on your needs (default 1000 is conservative)
4. **Monitor warnings** in the UI regularly

### ❌ Don'ts

1. **Don't include UUIDs** in metric names
2. **Don't create per-user metrics** (use labels)
3. **Don't ignore warnings** - investigate before hitting limit
4. **Don't disable limits** without understanding the impact

## Example: Fixing High Cardinality

### Before (Bad)
```python
# Creates 10,000+ unique metrics
for user_id in users:
    metrics.counter(f"api.requests.user.{user_id}").inc()
```

### After (Good)
```python
# Creates 1 metric with user_id label
metrics.counter("api.requests", {"user_id": user_id}).inc()
```

## Troubleshooting

### Problem: Metrics being dropped
**Solution:**
1. Review `metric_dropped_names` in Redis
2. Identify patterns (e.g., user IDs in names)
3. Refactor to use labels instead
4. If legitimate, increase `MAX_METRIC_CARDINALITY`

### Problem: UI slow with many metrics
**Solution:**
1. UI already limits to 500 displayed
2. Use search box to filter
3. Consider reducing `REDIS_TTL` to expire old metrics faster

### Problem: Warning at 90%+ constantly
**Solution:**
1. Review metric naming conventions
2. Implement aggregation at application level
3. Increase limit if all metrics are legitimate
4. Consider time-based cleanup of unused metrics

## Technical Details

### Memory Impact

Each unique metric name consumes:
- Redis Set member: ~100 bytes (metric name)
- Time-series data: ~50 bytes per data point
- Chart in UI: ~1KB when expanded

At 1000 metrics:
- Metric names: ~100KB
- Time-series (10 points each): ~500KB
- UI (all charts): ~1MB (but only expanded ones loaded)

### Performance Characteristics

- **Storage check:** O(1) - Redis `SCARD` and `SISMEMBER`
- **API response:** O(N log N) - Sorting metric names
- **UI rendering:** O(N) - Table rows, O(1) per expanded chart

## Summary

TinyOlly's cardinality protection provides:
1. 🛡️ **Hard limits** at storage layer (prevent unbounded growth)
2. 📊 **Visibility** via warnings and stats (early detection)
3. 🔍 **Debugging** via dropped metric tracking (identify issues)
4. ⚙️ **Configurability** via environment variables (tune for your needs)

This multi-layer approach prevents cardinality explosions while maintaining observability into the system's behavior.

