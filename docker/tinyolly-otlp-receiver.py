"""
TinyOlly OTLP Receiver Backend
Receives OTLP data from OpenTelemetry Collector and stores in Redis
"""
import json
import time
import os
from flask import Flask, request, jsonify
from tinyolly_redis_storage import Storage

app = Flask(__name__)

# Initialize storage
storage = Storage()

def store_trace(trace_data):
    """Store trace data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_span in trace_data.get('resourceSpans', []):
            # Extract service name from resource attributes
            service_name = 'unknown'
            resource = resource_span.get('resource', {})
            for attr in resource.get('attributes', []):
                if attr.get('key') == 'service.name':
                    val = attr.get('value', {})
                    service_name = val.get('stringValue', 'unknown')
                    break

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
                        'status': span.get('status', {}),
                        'serviceName': service_name
                    }
                    
                    # Use storage module
                    storage.store_span(span_record)
                    
    except Exception as e:
        print(f"Error storing trace: {e}")

def store_log(log_data):
    """Store log data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_log in log_data.get('resourceLogs', []):
            # Extract resource attributes (like service.name)
            resource_attrs = {}
            for attr in resource_log.get('resource', {}).get('attributes', []):
                key = attr.get('key', '')
                value = attr.get('value', {})
                if 'stringValue' in value:
                    resource_attrs[key] = value['stringValue']
                elif 'intValue' in value:
                    resource_attrs[key] = value['intValue']
                elif 'boolValue' in value:
                    resource_attrs[key] = value['boolValue']
            
            service_name = resource_attrs.get('service.name', 'unknown')
            
            for scope_log in resource_log.get('scopeLogs', []):
                for log_record in scope_log.get('logRecords', []):
                    # Convert nanoseconds to seconds
                    timestamp = int(log_record.get('timeUnixNano', 0)) / 1_000_000_000
                    
                    # Extract trace context
                    trace_id = log_record.get('traceId', '')
                    span_id = log_record.get('spanId', '')
                    
                    # Extract message from body
                    body = log_record.get('body', {})
                    raw_message = body.get('stringValue', str(body))
                    
                    # Try to parse JSON message
                    parsed_message = None
                    message_text = raw_message
                    try:
                        parsed_message = json.loads(raw_message)
                        message_text = parsed_message.get('message', raw_message)
                    except (json.JSONDecodeError, AttributeError):
                        # Not JSON, use as-is
                        pass
                    
                    # Extract severity
                    severity_number = log_record.get('severityNumber', 0)
                    severity_text = log_record.get('severityText', 'INFO')
                    
                    # Parse attributes into proper fields
                    parsed_attrs = {}
                    for attr in log_record.get('attributes', []):
                        key = attr.get('key', '')
                        value = attr.get('value', {})
                        
                        # Extract value based on type
                        if 'stringValue' in value:
                            parsed_attrs[key] = value['stringValue']
                        elif 'intValue' in value:
                            parsed_attrs[key] = value['intValue']
                        elif 'boolValue' in value:
                            parsed_attrs[key] = value['boolValue']
                        elif 'doubleValue' in value:
                            parsed_attrs[key] = value['doubleValue']
                    
                    # Generate unique log ID
                    log_id = f"{int(timestamp * 1000)}-{hash(message_text) & 0xFFFFFF}"
                    
                    log_entry = {
                        'log_id': log_id,
                        'timestamp': timestamp,
                        'traceId': trace_id,
                        'spanId': span_id,
                        'severity': severity_text,
                        'message': message_text,
                        'service_name': service_name,
                        'attributes': parsed_attrs  # Parsed OTLP attributes
                    }
                    
                    # If the log message itself was JSON, merge those fields in
                    if parsed_message and isinstance(parsed_message, dict):
                        for key, value in parsed_message.items():
                            if key != 'message':  # Don't overwrite the message field
                                log_entry[key] = value
                    
                    # Use storage module
                    storage.store_log(log_entry)
                    
    except Exception as e:
        print(f"Error storing log: {e}")
        import traceback
        traceback.print_exc()

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
                        metric_type = None
                        if 'sum' in metric:
                            data_points = metric['sum'].get('dataPoints', [])
                            # Check if sum is monotonic (counter) or non-monotonic (gauge)
                            # In OTLP, aggregationTemporality and isMonotonic determine this
                            is_monotonic = metric['sum'].get('isMonotonic', False)
                            if is_monotonic:
                                metric_type = 'counter'
                            else:
                                metric_type = 'gauge'
                        elif 'gauge' in metric:
                            data_points = metric['gauge'].get('dataPoints', [])
                            metric_type = 'gauge'
                        elif 'histogram' in metric:
                            data_points = metric['histogram'].get('dataPoints', [])
                            metric_type = 'histogram'
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
                                value = 0
                                if 'asInt' in point:
                                    value = int(point['asInt'])
                                elif 'asDouble' in point:
                                    value = float(point['asDouble'])
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
                                'name': metric_name,
                                'timestamp': timestamp,
                                'value': value,
                                'labels': labels,
                                'type': metric_type
                            }
                            
                            # Add histogram data if available
                            if is_histogram and histogram_data:
                                metric_record['histogram'] = histogram_data
                            
                            # Use storage module
                            storage.store_metric(metric_record)
                            
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
    if storage.is_connected():
        return jsonify({'status': 'healthy', 'redis': 'connected'}), 200
    else:
        return jsonify({'status': 'unhealthy', 'redis': 'disconnected'}), 503

if __name__ == '__main__':
    print("Starting TinyOlly OTLP Receiver Backend...")
    print(f"Redis: {os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}")
    app.run(host='0.0.0.0', port=5003, debug=False)

