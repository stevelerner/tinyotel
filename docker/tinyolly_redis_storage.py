"""
TinyOlly Storage Module
Handles all Redis interactions for traces, logs, and metrics.
"""
import json
import time
import uuid
import redis
import os

# Default configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
# Use REDIS_PORT_NUMBER to avoid conflict with K8s auto-generated REDIS_PORT variable
# K8s creates REDIS_PORT with value like "tcp://10.107.63.144:6379"
REDIS_PORT = int(os.getenv('REDIS_PORT_NUMBER', os.getenv('REDIS_PORT_OVERRIDE', '6379')))
TTL_SECONDS = int(os.getenv('REDIS_TTL', 1800))  # 30 minutes default (configurable)
MAX_METRIC_CARDINALITY = int(os.getenv('MAX_METRIC_CARDINALITY', 1000))  # Prevent cardinality explosion

class Storage:
    def __init__(self, host=REDIS_HOST, port=REDIS_PORT, ttl=TTL_SECONDS, max_cardinality=MAX_METRIC_CARDINALITY):
        self.client = redis.Redis(host=host, port=port, decode_responses=True)
        self.ttl = ttl
        self.max_cardinality = max_cardinality

    def is_connected(self):
        try:
            self.client.ping()
            return True
        except:
            return False

    # ============================================
    # Trace Storage
    # ============================================

    def store_span(self, span):
        """Store a span and index it"""
        trace_id = span.get('traceId') or span.get('trace_id')
        span_id = span.get('spanId') or span.get('span_id')
        
        if not trace_id or not span_id:
            return
        
        # Ensure consistent format for storage
        # We want to support both OTLP format (camelCase) and internal format
        # This is a simplified normalization
        
        # Store individual span
        span_key = f"span:{span_id}"
        self.client.setex(span_key, self.ttl, json.dumps(span))
        
        # Add span to trace set (for existence check)
        trace_key = f"trace:{trace_id}"
        self.client.sadd(trace_key, span_id)
        self.client.expire(trace_key, self.ttl)
        
        # Add to trace index (sorted by time)
        self.client.zadd('trace_index', {trace_id: time.time()})
        self.client.expire('trace_index', self.ttl)
        
        # Add to trace's list of spans (for retrieval)
        trace_span_key = f"trace:{trace_id}:spans"
        # We use rpush to append to the end, preserving order if inserted sequentially
        # But for safety, we might want to sort on retrieval
        self.client.rpush(trace_span_key, json.dumps(span))
        self.client.expire(trace_span_key, self.ttl)
        
        # Add to span index (sorted by time)
        self.client.zadd('span_index', {span_id: time.time()})
        self.client.expire('span_index', self.ttl)

    def get_recent_traces(self, limit=100):
        """Get recent trace IDs"""
        return self.client.zrevrange('trace_index', 0, limit - 1)

    def get_recent_spans(self, limit=100):
        """Get recent span IDs"""
        return self.client.zrevrange('span_index', 0, limit - 1)

    def get_span_details(self, span_id):
        """Get details for a specific span"""
        span_key = f"span:{span_id}"
        span_json = self.client.get(span_key)
        
        if not span_json:
            return None
            
        span = json.loads(span_json)
        
        # Extract attributes for display
        def get_attr(obj, keys):
            # Handle OTLP list of dicts format
            if isinstance(obj.get('attributes'), list):
                for attr in obj['attributes']:
                    if attr['key'] in keys:
                        val = attr['value']
                        # Return the first non-null value found
                        for k in ['stringValue', 'intValue', 'boolValue', 'doubleValue']:
                            if k in val:
                                return val[k]
            # Handle dict format (if normalized)
            elif isinstance(obj.get('attributes'), dict):
                for k in keys:
                    if k in obj['attributes']:
                        return obj['attributes'][k]
            return None

        method = get_attr(span, ['http.method', 'http.request.method'])
        route = get_attr(span, ['http.route', 'http.target', 'url.path'])
        status_code = get_attr(span, ['http.status_code', 'http.response.status_code'])
        server_name = get_attr(span, ['http.server_name', 'net.host.name'])
        scheme = get_attr(span, ['http.scheme', 'url.scheme'])
        host = get_attr(span, ['http.host', 'net.host.name'])
        target = get_attr(span, ['http.target', 'url.path'])
        url = get_attr(span, ['http.url', 'url.full'])
        
        start_time = int(span.get('startTimeUnixNano', span.get('start_time', 0)))
        end_time = int(span.get('endTimeUnixNano', span.get('end_time', 0)))
        duration_ns = end_time - start_time if end_time > start_time else 0

        return {
            'span_id': span_id,
            'trace_id': span.get('traceId') or span.get('trace_id'),
            'name': span.get('name', 'unknown'),
            'start_time': start_time,
            'duration_ms': duration_ns / 1_000_000,
            'method': method,
            'route': route,
            'status_code': status_code,
            'status': span.get('status', {}),
            'server_name': server_name,
            'scheme': scheme,
            'host': host,
            'target': target,
            'url': url
        }

    def get_trace_spans(self, trace_id):
        """Get all spans for a trace"""
        trace_key = f"trace:{trace_id}:spans"
        span_data = self.client.lrange(trace_key, 0, -1)
        
        if not span_data:
            return []
            
        return [json.loads(s) for s in span_data]

    def get_trace_summary(self, trace_id):
        """Get summary of a trace"""
        spans = self.get_trace_spans(trace_id)
        if not spans:
            return None
            
        # Calculate trace duration
        start_times = [int(s.get('startTimeUnixNano', s.get('start_time', 0))) for s in spans]
        end_times = [int(s.get('endTimeUnixNano', s.get('end_time', 0))) for s in spans]
        
        min_start = min(start_times) if start_times else 0
        max_end = max(end_times) if end_times else 0
        duration_ns = max_end - min_start
        
        # Find root span (no parent)
        root_span = next((s for s in spans if not s.get('parentSpanId') and not s.get('parent_span_id')), spans[0] if spans else None)
        
        # Extract root span details
        root_span_method = None
        root_span_route = None
        root_span_status_code = None
        
        if root_span:
            # Helper to get attribute value
            def get_attr(span, keys):
                attributes = span.get('attributes', [])
                # Handle both list of dicts (OTLP) and dict (if normalized)
                if isinstance(attributes, list):
                    for attr in attributes:
                        if attr.get('key') in keys:
                            val = attr.get('value', {})
                            if 'stringValue' in val: return val['stringValue']
                            if 'intValue' in val: return val['intValue']
                            if 'boolValue' in val: return val['boolValue']
                            return str(val)
                elif isinstance(attributes, dict):
                    for key in keys:
                        if key in attributes:
                            return attributes[key]
                return None

            root_span_method = get_attr(root_span, ['http.method', 'http.request.method'])
            root_span_route = get_attr(root_span, ['http.route', 'http.target', 'url.path'])
            root_span_status_code = get_attr(root_span, ['http.status_code', 'http.response.status_code'])
            root_span_server_name = get_attr(root_span, ['http.server_name', 'net.host.name'])
            root_span_scheme = get_attr(root_span, ['http.scheme', 'url.scheme'])
            root_span_host = get_attr(root_span, ['http.host', 'net.host.name'])
            root_span_target = get_attr(root_span, ['http.target', 'url.path'])
            root_span_url = get_attr(root_span, ['http.url', 'url.full'])
            
        return {
            'trace_id': trace_id,
            'span_count': len(spans),
            'duration_ms': duration_ns / 1_000_000 if duration_ns else 0,
            'start_time': min_start,
            'root_span_name': root_span.get('name', 'unknown') if root_span else 'unknown',
            'root_span_method': root_span_method,
            'root_span_route': root_span_route,
            'root_span_status_code': root_span_status_code,
            'root_span_status': root_span.get('status', {}) if root_span else {},
            'root_span_server_name': root_span_server_name,
            'root_span_scheme': root_span_scheme,
            'root_span_host': root_span_host,
            'root_span_target': root_span_target,
            'root_span_url': root_span_url
        }

    # ============================================
    # Log Storage
    # ============================================

    def store_log(self, log):
        """Store a log entry"""
        # Generate ID if not present
        if 'log_id' not in log:
            log['log_id'] = str(uuid.uuid4())
            
        log_id = log['log_id']
        timestamp = log.get('timestamp', time.time())
        
        # Ensure timestamp is in log
        log['timestamp'] = timestamp
        
        # Store log content
        log_key = f"log:{log_id}"
        self.client.setex(log_key, self.ttl, json.dumps(log))
        
        # Index by time
        self.client.zadd('log_index', {log_id: timestamp})
        self.client.expire('log_index', self.ttl)
        
        # Index by trace_id if present
        trace_id = log.get('trace_id') or log.get('traceId')
        if trace_id:
            trace_log_key = f"trace:{trace_id}:logs"
            self.client.rpush(trace_log_key, log_id)
            self.client.expire(trace_log_key, self.ttl)

    def get_logs(self, trace_id=None, limit=100):
        """Get logs, optionally filtered by trace_id"""
        if trace_id:
            trace_log_key = f"trace:{trace_id}:logs"
            log_ids = self.client.lrange(trace_log_key, 0, limit - 1)
        else:
            log_ids = self.client.zrevrange('log_index', 0, limit - 1)
            
        logs = []
        for log_id in log_ids:
            log_data = self.client.get(f"log:{log_id}")
            if log_data:
                logs.append(json.loads(log_data))
        
        return logs

    # ============================================
    # Metric Storage
    # ============================================

    def store_metric(self, metric):
        """Store a metric with cardinality protection"""
        name = metric.get('name')
        timestamp = metric.get('timestamp', time.time())
        
        if not name:
            return
        
        # Check cardinality limit before adding new metric
        current_count = self.client.scard('metric_names')
        is_existing = self.client.sismember('metric_names', name)
        
        if not is_existing and current_count >= self.max_cardinality:
            # Drop this metric to prevent cardinality explosion
            # Log to a separate key for monitoring
            self.client.incr('metric_dropped_count')
            self.client.expire('metric_dropped_count', self.ttl)
            self.client.sadd('metric_dropped_names', name)
            self.client.expire('metric_dropped_names', 3600)  # Keep for 1 hour for debugging
            return
            
        # Store in time-series sorted set
        metric_key = f"metric:{name}"
        
        # We store the whole metric object as the member
        # In a real system, this would be more optimized
        metric_data = json.dumps(metric)
        
        self.client.zadd(metric_key, {metric_data: timestamp})
        self.client.expire(metric_key, self.ttl)
        
        # Add to metric names index
        self.client.sadd('metric_names', name)
        self.client.expire('metric_names', self.ttl)

    def get_metric_names(self, limit=None):
        """Get metric names, optionally limited and sorted"""
        names = list(self.client.smembers('metric_names'))
        names.sort()  # Alphabetical sorting
        
        if limit and limit > 0:
            return names[:limit]
        return names
    
    def get_cardinality_stats(self):
        """Get metric cardinality statistics"""
        return {
            'current': self.client.scard('metric_names'),
            'max': self.max_cardinality,
            'dropped_count': int(self.client.get('metric_dropped_count') or 0),
            'dropped_names': list(self.client.smembers('metric_dropped_names'))
        }

    def get_metric_data(self, name, start_time, end_time):
        """Get metric data points for a time range"""
        metric_key = f"metric:{name}"
        data = self.client.zrangebyscore(metric_key, start_time, end_time)
        return [json.loads(d) for d in data]

    # ============================================
    # Service Map
    # ============================================

    def get_service_graph(self, limit=50):
        """Build service dependency graph from recent traces"""
        trace_ids = self.get_recent_traces(limit)
        
        nodes = set()
        edges = {}  # (source, target) -> count
        
        for trace_id in trace_ids:
            spans = self.get_trace_spans(trace_id)
            if not spans:
                continue
                
            # Map span_id to span for easy lookup
            span_map = {s.get('spanId', s.get('span_id')): s for s in spans}
            
            for span in spans:
                service = span.get('serviceName', 'unknown')
                nodes.add(service)
                
                parent_id = span.get('parentSpanId', span.get('parent_span_id'))
                if parent_id and parent_id in span_map:
                    parent = span_map[parent_id]
                    parent_service = parent.get('serviceName', 'unknown')
                    
                    if parent_service != service and parent_service != 'unknown' and service != 'unknown':
                        key = (parent_service, service)
                        edges[key] = edges.get(key, 0) + 1
                        
        # Format for frontend
        graph_nodes = [{'id': name, 'label': name} for name in nodes]
        graph_edges = [{'source': s, 'target': t, 'value': c} for (s, t), c in edges.items()]
        
        return {
            'nodes': graph_nodes,
            'edges': graph_edges
        }

    # ============================================
    # Stats
    # ============================================

    def get_stats(self):
        """Get overall stats including cardinality"""
        cardinality = self.get_cardinality_stats()
        return {
            'traces': self.client.zcard('trace_index'),
            'spans': self.client.zcard('span_index'),
            'logs': self.client.zcard('log_index'),
            'metrics': cardinality['current'],
            'metrics_max': cardinality['max'],
            'metrics_dropped': cardinality['dropped_count']
        }
