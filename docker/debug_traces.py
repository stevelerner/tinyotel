import redis
import json
import os

host = os.getenv('REDIS_HOST', 'tinyolly-redis')
r = redis.Redis(host=host, port=6379, decode_responses=True)

# Get recent traces
trace_ids = r.zrevrange('trace_index', 0, 4)

print(f"Found {len(trace_ids)} traces")

for trace_id in trace_ids:
    print(f"\nTrace: {trace_id}")
    # Get spans
    span_data = r.lrange(f"trace:{trace_id}:spans", 0, -1)
    spans = [json.loads(s) for s in span_data]
    
    # Find root span
    root_span = next((s for s in spans if not s.get('parentSpanId') and not s.get('parent_span_id')), None)
    
    if root_span:
        print(f"  Root Span Name: {root_span.get('name')}")
        print(f"  Attributes type: {type(root_span.get('attributes'))}")
        print(f"  Attributes: {json.dumps(root_span.get('attributes'), indent=2)}")
    else:
        print("  No root span found")
