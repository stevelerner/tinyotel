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
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
TTL_SECONDS = 600  # 10 minutes

class Storage:
    def __init__(self, host=REDIS_HOST, port=REDIS_PORT, ttl=TTL_SECONDS):
        self.client = redis.Redis(host=host, port=port, decode_responses=True)
        self.ttl = ttl

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

    def get_recent_traces(self, limit=100):
        """Get recent trace IDs"""
        return self.client.zrevrange('trace_index', 0, limit - 1)

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
        
        return {
            'trace_id': trace_id,
            'span_count': len(spans),
            'duration_ms': duration_ns / 1_000_000 if duration_ns else 0,
            'start_time': min_start,
            'root_span_name': root_span.get('name', 'unknown') if root_span else 'unknown'
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
        """Store a metric"""
        name = metric.get('name')
        timestamp = metric.get('timestamp', time.time())
        
        if not name:
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

    def get_metric_names(self):
        """Get all metric names"""
        return list(self.client.smembers('metric_names'))

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
        """Get overall stats"""
        return {
            'traces': self.client.zcard('trace_index'),
            'logs': self.client.zcard('log_index'),
            'metrics': self.client.scard('metric_names')
        }
