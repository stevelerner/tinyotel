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
                        'spanId': span_id,
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
                        'traceId': trace_id,
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
                    try:
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
                            
                            # Extract value based on metric type
                            is_histogram = 'histogram' in metric
                            if is_histogram:
                                # For histograms, extract all components
                                hist_sum = float(point.get('sum', 0))
                                hist_count = float(point.get('count', 0))
                                hist_min = point.get('min')
                                hist_max = point.get('max')
                                
                                # Get bucket counts and boundaries
                                bucket_counts = point.get('bucketCounts', [])
                                explicit_bounds = point.get('explicitBounds', [])
                                
                                # Calculate average for line chart
                                value = (hist_sum / hist_count) if hist_count > 0 else hist_sum
                                
                                # Store histogram-specific data
                                histogram_data = {
                                    'sum': hist_sum,
                                    'count': int(hist_count),
                                    'min': float(hist_min) if hist_min is not None else None,
                                    'max': float(hist_max) if hist_max is not None else None,
                                    'average': value
                                }
                                
                                # Process buckets if available
                                # In OTLP: bucketCounts has N+1 elements (N boundaries + 1 +Inf bucket)
                                # explicitBounds has N elements (the boundaries)
                                if bucket_counts:
                                    buckets = []
                                    for i, count in enumerate(bucket_counts):
                                        # The last bucket is always +Inf if explicit_bounds exist
                                        if explicit_bounds and i < len(explicit_bounds):
                                            bucket_bound = explicit_bounds[i]
                                            buckets.append({
                                                'bound': float(bucket_bound),
                                                'count': int(count)
                                            })
                                        elif explicit_bounds and i == len(explicit_bounds):
                                            # This is the +Inf bucket
                                            buckets.append({
                                                'bound': None,  # None represents +Inf
                                                'count': int(count)
                                            })
                                        elif not explicit_bounds:
                                            # No boundaries specified, just store counts
                                            buckets.append({
                                                'bound': None,
                                                'count': int(count)
                                            })
                                    
                                    histogram_data['buckets'] = buckets
                            else:
                                # For counters and gauges
                                value = point.get('asInt', point.get('asDouble', 0))
                                histogram_data = None
                            
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
                            
                            # Add histogram data if available
                            if is_histogram and histogram_data:
                                metric_record['histogram'] = histogram_data
                            
                            # Store with TinyOlly's structure
                            metric_key = f'metric:{metric_name}'
                            redis_client.zadd(metric_key, {json.dumps(metric_record): timestamp})
                            redis_client.expire(metric_key, DATA_TTL)
                            
                            # Keep track of all metric names
                            redis_client.sadd('metric_names', metric_name)
                            redis_client.expire('metric_names', DATA_TTL)
                    except Exception as e:
                        print(f"Error processing individual metric: {e}", flush=True)
                        import traceback
                        traceback.print_exc()
                        continue
                        
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

