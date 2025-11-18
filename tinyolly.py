"""
TinyOlly - A minimal observability backend with visualization
Receives traces, metrics, and logs, stores them in Redis with TTL,
and provides a web UI for visualization and correlation.
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import redis
import json
import time
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# Redis connection
redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
TTL_SECONDS = 600  # 10 minutes

# ============================================
# Data Ingestion Endpoints
# ============================================

@app.route('/v1/traces', methods=['POST'])
def ingest_traces():
    """Accept traces in OTLP JSON format or simplified format"""
    data = request.json
    
    # Handle both OTLP format and simplified format
    if 'resourceSpans' in data:
        # OTLP format
        for resource_span in data['resourceSpans']:
            for scope_span in resource_span.get('scopeSpans', []):
                for span in scope_span.get('spans', []):
                    store_span(span)
    elif 'spans' in data:
        # Simplified format
        for span in data['spans']:
            store_span(span)
    else:
        # Single span
        store_span(data)
    
    return jsonify({'status': 'ok'}), 200

@app.route('/v1/logs', methods=['POST'])
def ingest_logs():
    """Accept logs in JSON format"""
    data = request.json
    
    # Handle array or single log
    logs = data if isinstance(data, list) else [data]
    
    for log in logs:
        store_log(log)
    
    return jsonify({'status': 'ok'}), 200

@app.route('/v1/metrics', methods=['POST'])
def ingest_metrics():
    """Accept metrics in JSON format"""
    data = request.json
    
    # Handle array or single metric
    metrics = data if isinstance(data, list) else [data]
    
    for metric in metrics:
        store_metric(metric)
    
    return jsonify({'status': 'ok'}), 200

# ============================================
# Storage Functions
# ============================================

def store_span(span):
    """Store a span in Redis"""
    trace_id = span.get('traceId') or span.get('trace_id')
    span_id = span.get('spanId') or span.get('span_id')
    
    if not trace_id or not span_id:
        return
    
    # Store individual span
    span_key = f"span:{span_id}"
    redis_client.setex(span_key, TTL_SECONDS, json.dumps(span))
    
    # Add span to trace
    trace_key = f"trace:{trace_id}"
    redis_client.sadd(trace_key, span_id)
    redis_client.expire(trace_key, TTL_SECONDS)
    
    # Add to trace index
    redis_client.zadd('trace_index', {trace_id: time.time()})
    redis_client.expire('trace_index', TTL_SECONDS)
    
    # Index by trace_id for correlation
    trace_span_key = f"trace:{trace_id}:spans"
    redis_client.lpush(trace_span_key, json.dumps(span))
    redis_client.expire(trace_span_key, TTL_SECONDS)

def store_log(log):
    """Store a log entry in Redis"""
    log_id = str(uuid.uuid4())
    timestamp = log.get('timestamp', time.time())
    trace_id = log.get('trace_id') or log.get('traceId')
    span_id = log.get('span_id') or log.get('spanId')
    
    # Add timestamp if not present
    log['timestamp'] = timestamp
    log['log_id'] = log_id
    
    # Store log
    log_key = f"log:{log_id}"
    redis_client.setex(log_key, TTL_SECONDS, json.dumps(log))
    
    # Add to time-ordered index
    redis_client.zadd('log_index', {log_id: timestamp})
    redis_client.expire('log_index', TTL_SECONDS)
    
    # If trace_id exists, add to trace correlation
    if trace_id:
        trace_log_key = f"trace:{trace_id}:logs"
        redis_client.lpush(trace_log_key, log_id)
        redis_client.expire(trace_log_key, TTL_SECONDS)

def store_metric(metric):
    """Store a metric in Redis"""
    name = metric.get('name')
    timestamp = metric.get('timestamp', time.time())
    value = metric.get('value', 0)
    
    if not name:
        return
    
    # Store in time-series sorted set
    metric_key = f"metric:{name}"
    metric_data = json.dumps({
        'timestamp': timestamp,
        'value': value,
        'labels': metric.get('labels', {})
    })
    redis_client.zadd(metric_key, {metric_data: timestamp})
    redis_client.expire(metric_key, TTL_SECONDS)
    
    # Add to metric names index
    redis_client.sadd('metric_names', name)
    redis_client.expire('metric_names', TTL_SECONDS)

# ============================================
# Query Endpoints
# ============================================

@app.route('/api/traces', methods=['GET'])
def get_traces():
    """Get list of recent traces"""
    limit = int(request.args.get('limit', 100))
    
    # Get recent trace IDs from index
    trace_ids = redis_client.zrevrange('trace_index', 0, limit - 1)
    
    traces = []
    for trace_id in trace_ids:
        trace_data = get_trace_summary(trace_id)
        if trace_data:
            traces.append(trace_data)
    
    return jsonify(traces)

@app.route('/api/traces/<trace_id>', methods=['GET'])
def get_trace(trace_id):
    """Get full trace with all spans"""
    trace_key = f"trace:{trace_id}:spans"
    span_data = redis_client.lrange(trace_key, 0, -1)
    
    if not span_data:
        return jsonify({'error': 'Trace not found'}), 404
    
    spans = [json.loads(s) for s in span_data]
    
    # Sort spans by start time
    spans.sort(key=lambda s: s.get('startTimeUnixNano', s.get('start_time', 0)))
    
    return jsonify({
        'trace_id': trace_id,
        'spans': spans,
        'span_count': len(spans)
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent logs, optionally filtered by trace_id"""
    trace_id = request.args.get('trace_id')
    limit = int(request.args.get('limit', 100))
    
    if trace_id:
        # Get logs for specific trace
        trace_log_key = f"trace:{trace_id}:logs"
        log_ids = redis_client.lrange(trace_log_key, 0, limit - 1)
    else:
        # Get recent logs
        log_ids = redis_client.zrevrange('log_index', 0, limit - 1)
    
    logs = []
    for log_id in log_ids:
        log_data = redis_client.get(f"log:{log_id}")
        if log_data:
            logs.append(json.loads(log_data))
    
    return jsonify(logs)

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get metric names"""
    names = list(redis_client.smembers('metric_names'))
    return jsonify(names)

@app.route('/api/metrics/<name>', methods=['GET'])
def get_metric_data(name):
    """Get time-series data for a metric"""
    start_time = float(request.args.get('start', time.time() - 600))
    end_time = float(request.args.get('end', time.time()))
    
    metric_key = f"metric:{name}"
    data = redis_client.zrangebyscore(metric_key, start_time, end_time)
    
    points = [json.loads(d) for d in data]
    
    return jsonify({
        'name': name,
        'data': points
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    trace_count = redis_client.zcard('trace_index')
    log_count = redis_client.zcard('log_index')
    metric_count = redis_client.scard('metric_names')
    
    return jsonify({
        'traces': trace_count,
        'logs': log_count,
        'metrics': metric_count
    })

# ============================================
# Helper Functions
# ============================================

def get_trace_summary(trace_id):
    """Get summary information for a trace"""
    trace_key = f"trace:{trace_id}:spans"
    span_data = redis_client.lrange(trace_key, 0, -1)
    
    if not span_data:
        return None
    
    spans = [json.loads(s) for s in span_data]
    
    # Calculate trace duration
    start_times = [s.get('startTimeUnixNano', s.get('start_time', 0)) for s in spans]
    end_times = [s.get('endTimeUnixNano', s.get('end_time', 0)) for s in spans]
    
    min_start = min(start_times) if start_times else 0
    max_end = max(end_times) if end_times else 0
    duration_ns = max_end - min_start
    
    # Get root span name
    root_span = next((s for s in spans if not s.get('parentSpanId') and not s.get('parent_span_id')), spans[0] if spans else None)
    
    return {
        'trace_id': trace_id,
        'span_count': len(spans),
        'duration_ms': duration_ns / 1_000_000 if duration_ns else 0,
        'start_time': min_start,
        'root_span_name': root_span.get('name', 'unknown') if root_span else 'unknown'
    }

# ============================================
# Web UI Routes
# ============================================

@app.route('/')
def index():
    """Serve the main UI"""
    return render_template('tinyolly.html')

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        redis_client.ping()
        return jsonify({'status': 'healthy', 'redis': 'connected'})
    except:
        return jsonify({'status': 'unhealthy', 'redis': 'disconnected'}), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)

