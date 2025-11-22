"""
TinyOlly - A minimal observability backend with visualization
Receives traces, metrics, and logs, stores them in Redis with TTL,
and provides a web UI for visualization and correlation.
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import time
from datetime import datetime
import uuid
from tinyolly_redis_storage import Storage

app = Flask(__name__)
CORS(app)

# Initialize storage
storage = Storage()

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
                    storage.store_span(span)
    elif 'spans' in data:
        # Simplified format
        for span in data['spans']:
            storage.store_span(span)
    else:
        # Single span
        storage.store_span(data)
    
    return jsonify({'status': 'ok'}), 200

@app.route('/v1/logs', methods=['POST'])
def ingest_logs():
    """Accept logs in JSON format"""
    data = request.json
    
    # Handle array or single log
    logs = data if isinstance(data, list) else [data]
    
    for log in logs:
        storage.store_log(log)
    
    return jsonify({'status': 'ok'}), 200

@app.route('/v1/metrics', methods=['POST'])
def ingest_metrics():
    """Accept metrics in JSON format"""
    data = request.json
    
    # Handle array or single metric
    metrics = data if isinstance(data, list) else [data]
    
    for metric in metrics:
        storage.store_metric(metric)
    
    return jsonify({'status': 'ok'}), 200

# ============================================
# Query Endpoints
# ============================================

@app.route('/api/traces', methods=['GET'])
def get_traces():
    """Get list of recent traces"""
    limit = int(request.args.get('limit', 100))
    
    # Get recent trace IDs from index
    trace_ids = storage.get_recent_traces(limit)
    
    traces = []
    for trace_id in trace_ids:
        trace_data = storage.get_trace_summary(trace_id)
        if trace_data:
            traces.append(trace_data)
    
    return jsonify(traces)

@app.route('/api/traces/<trace_id>', methods=['GET'])
def get_trace(trace_id):
    """Get full trace with all spans"""
    spans = storage.get_trace_spans(trace_id)
    
    if not spans:
        return jsonify({'error': 'Trace not found'}), 404
    
    # Sort spans by start time
    spans.sort(key=lambda s: s.get('startTimeUnixNano', s.get('start_time', 0)))
    
    return jsonify({
        'trace_id': trace_id,
        'spans': spans,
        'span_count': len(spans)
    })

@app.route('/api/spans', methods=['GET'])
def get_spans():
    """Get list of recent spans"""
    limit = int(request.args.get('limit', 100))
    
    # Get recent span IDs from index
    span_ids = storage.get_recent_spans(limit)
    
    spans = []
    for span_id in span_ids:
        span_data = storage.get_span_details(span_id)
        if span_data:
            spans.append(span_data)
    
    return jsonify(spans)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent logs, optionally filtered by trace_id"""
    trace_id = request.args.get('trace_id')
    limit = int(request.args.get('limit', 100))
    
    logs = storage.get_logs(trace_id, limit)
    return jsonify(logs)

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get metric names with optional limit"""
    limit = request.args.get('limit', type=int)
    names = storage.get_metric_names(limit=limit)
    cardinality = storage.get_cardinality_stats()
    
    return jsonify({
        'names': names,
        'cardinality': cardinality
    })

@app.route('/api/metrics/<name>', methods=['GET'])
def get_metric_data(name):
    """Get time-series data for a metric"""
    start_time = float(request.args.get('start', time.time() - 600))
    end_time = float(request.args.get('end', time.time()))
    
    points = storage.get_metric_data(name, start_time, end_time)
    
    return jsonify({
        'name': name,
        'data': points
    })

@app.route('/api/service-map', methods=['GET'])
def get_service_map():
    """Get service dependency graph"""
    limit = int(request.args.get('limit', 100))
    graph = storage.get_service_graph(limit)
    return jsonify(graph)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    return jsonify(storage.get_stats())

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
    if storage.is_connected():
        return jsonify({'status': 'healthy', 'redis': 'connected'})
    else:
        return jsonify({'status': 'unhealthy', 'redis': 'disconnected'}), 503

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)

