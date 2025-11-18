"""
TinyOlly OTLP Receiver Backend
Receives OTLP data from OpenTelemetry Collector and stores in Redis
"""
import json
import time
import os
from flask import Flask, request, jsonify
import redis

app = Flask(__name__)

# Redis connection
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# TTL for data (10 minutes)
DATA_TTL = 600

def store_trace(trace_data):
    """Store trace data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_span in trace_data.get('resourceSpans', []):
            for scope_span in resource_span.get('scopeSpans', []):
                for span in scope_span.get('spans', []):
                    trace_id = span.get('traceId', '')
                    span_id = span.get('spanId', '')
                    
                    if not trace_id or not span_id:
                        continue
                    
                    # Convert to format compatible with TinyOlly frontend
                    span_record = {
                        'traceId': trace_id,
                        'trace_id': trace_id,
                        'spanId': span_id,
                        'span_id': span_id,
                        'name': span.get('name', ''),
                        'kind': span.get('kind', 0),
                        'startTimeUnixNano': span.get('startTimeUnixNano', 0),
                        'endTimeUnixNano': span.get('endTimeUnixNano', 0),
                        'parentSpanId': span.get('parentSpanId', ''),
                        'attributes': span.get('attributes', []),
                        'status': span.get('status', {})
                    }
                    
                    # Store span with TinyOlly's structure
                    # Add to trace's span list
                    trace_span_key = f"trace:{trace_id}:spans"
                    redis_client.rpush(trace_span_key, json.dumps(span_record))
                    redis_client.expire(trace_span_key, DATA_TTL)
                    
                    # Add trace_id to index
                    redis_client.zadd('trace_index', {trace_id: time.time()})
                    redis_client.expire('trace_index', DATA_TTL)
                    
    except Exception as e:
        print(f"Error storing trace: {e}")

def store_log(log_data):
    """Store log data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_log in log_data.get('resourceLogs', []):
            for scope_log in resource_log.get('scopeLogs', []):
                for log_record in scope_log.get('logRecords', []):
                    # Convert nanoseconds to seconds
                    timestamp = int(log_record.get('timeUnixNano', 0)) / 1_000_000_000
                    
                    # Extract trace context
                    trace_id = log_record.get('traceId', '')
                    span_id = log_record.get('spanId', '')
                    
                    # Extract message from body
                    body = log_record.get('body', {})
                    message = body.get('stringValue', str(body))
                    
                    # Extract severity
                    severity_number = log_record.get('severityNumber', 0)
                    severity_text = log_record.get('severityText', 'INFO')
                    
                    # Generate unique log ID
                    log_id = f"{int(timestamp * 1000)}-{hash(message) & 0xFFFFFF}"
                    
                    log_entry = {
                        'timestamp': timestamp,
                        'trace_id': trace_id,
                        'traceId': trace_id,
                        'span_id': span_id,
                        'spanId': span_id,
                        'severity': severity_text,
                        'message': message,
                        'attributes': log_record.get('attributes', [])
                    }
                    
                    # Store with TinyOlly's structure
                    redis_client.setex(f'log:{log_id}', DATA_TTL, json.dumps(log_entry))
                    
                    # Add to log index
                    redis_client.zadd('log_index', {log_id: timestamp})
                    redis_client.expire('log_index', DATA_TTL)
                    
                    # If trace_id exists, add to trace's log list
                    if trace_id:
                        trace_log_key = f"trace:{trace_id}:logs"
                        redis_client.rpush(trace_log_key, log_id)
                        redis_client.expire(trace_log_key, DATA_TTL)
                    
    except Exception as e:
        print(f"Error storing log: {e}")

def store_metric(metric_data):
    """Store metric data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_metric in metric_data.get('resourceMetrics', []):
            for scope_metric in resource_metric.get('scopeMetrics', []):
                for metric in scope_metric.get('metrics', []):
                    metric_name = metric.get('name', '')
                    
                    if not metric_name:
                        continue
                    
                    # Handle different metric types
                    if 'sum' in metric:
                        data_points = metric['sum'].get('dataPoints', [])
                    elif 'gauge' in metric:
                        data_points = metric['gauge'].get('dataPoints', [])
                    elif 'histogram' in metric:
                        data_points = metric['histogram'].get('dataPoints', [])
                    else:
                        continue
                    
                    for point in data_points:
                        # Convert nanoseconds to seconds
                        timestamp = int(point.get('timeUnixNano', 0)) / 1_000_000_000
                        
                        # Extract value
                        value = point.get('asInt', point.get('asDouble', 0))
                        
                        # Extract attributes/labels
                        labels = {}
                        for attr in point.get('attributes', []):
                            key = attr.get('key', '')
                            val = attr.get('value', {})
                            if 'stringValue' in val:
                                labels[key] = val['stringValue']
                            elif 'intValue' in val:
                                labels[key] = str(val['intValue'])
                        
                        metric_record = {
                            'timestamp': timestamp,
                            'value': value,
                            'labels': labels
                        }
                        
                        # Store with TinyOlly's structure
                        metric_key = f'metric:{metric_name}'
                        redis_client.zadd(metric_key, {json.dumps(metric_record): timestamp})
                        redis_client.expire(metric_key, DATA_TTL)
                        
                        # Keep track of all metric names
                        redis_client.sadd('metric_names', metric_name)
                        redis_client.expire('metric_names', DATA_TTL)
                        
    except Exception as e:
        print(f"Error storing metric: {e}")

@app.route('/v1/traces', methods=['POST'])
def receive_traces():
    """OTLP HTTP endpoint for traces"""
    try:
        data = request.get_json()
        if not data:
            print(f"Error: No JSON data received. Content-Type: {request.content_type}")
            return jsonify({'status': 'error', 'message': 'No JSON data'}), 400
        store_trace(data)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        import traceback
        print(f"Error receiving traces: {e}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/v1/logs', methods=['POST'])
def receive_logs():
    """OTLP HTTP endpoint for logs"""
    try:
        data = request.get_json()
        if not data:
            print(f"Error: No JSON data received. Content-Type: {request.content_type}")
            return jsonify({'status': 'error', 'message': 'No JSON data'}), 400
        store_log(data)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        import traceback
        print(f"Error receiving logs: {e}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/v1/metrics', methods=['POST'])
def receive_metrics():
    """OTLP HTTP endpoint for metrics"""
    try:
        data = request.get_json()
        if not data:
            print(f"Error: No JSON data received. Content-Type: {request.content_type}")
            return jsonify({'status': 'error', 'message': 'No JSON data'}), 400
        store_metric(data)
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        import traceback
        print(f"Error receiving metrics: {e}")
        print(traceback.format_exc())
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    try:
        redis_client.ping()
        return jsonify({'status': 'healthy', 'redis': 'connected'}), 200
    except:
        return jsonify({'status': 'unhealthy', 'redis': 'disconnected'}), 503

if __name__ == '__main__':
    print("Starting TinyOlly OTLP Receiver Backend...")
    print(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    app.run(host='0.0.0.0', port=5003, debug=False)

