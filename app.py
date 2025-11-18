import json
import random
import time
import sys
from datetime import datetime, timezone
from flask import Flask, jsonify
from opentelemetry import trace

app = Flask(__name__)

def log_with_trace(level, message):
    """Helper to log with trace context in structured JSON format"""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    trace_id = format(ctx.trace_id, '032x') if ctx.trace_id != 0 else 'no_trace'
    span_id = format(ctx.span_id, '016x') if ctx.span_id != 0 else 'no_span'
    
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": level.upper(),
        "trace_id": trace_id,
        "span_id": span_id,
        "message": message
    }
    
    print(json.dumps(log_entry), file=sys.stderr, flush=True)

@app.route('/')
def home():
    log_with_trace('info', "Home endpoint called")
    return jsonify({
        "message": "TinyOTel Demo App",
        "endpoints": ["/", "/hello", "/calculate", "/error"]
    })

@app.route('/hello')
def hello():
    name = random.choice(["Alice", "Bob", "Charlie", "Diana"])
    log_with_trace('info', f"Greeting user: {name}")
    
    # Simulate some work
    time.sleep(random.uniform(0.1, 0.5))
    
    log_with_trace('info', f"Completed greeting for {name}")
    
    return jsonify({
        "message": f"Hello, {name}!",
        "timestamp": time.time()
    })

@app.route('/calculate')
def calculate():
    log_with_trace('info', "Starting calculation")
    
    # Simulate complex calculation
    a = random.randint(1, 100)
    b = random.randint(1, 100)
    
    log_with_trace('info', f"Calculating {a} + {b}")
    time.sleep(random.uniform(0.2, 0.8))
    result = a + b
    
    log_with_trace('info', f"Calculation complete: {result}")
    
    return jsonify({
        "operation": "addition",
        "a": a,
        "b": b,
        "result": result
    })

@app.route('/error')
def error():
    log_with_trace('error', "Error endpoint called - simulating failure")
    
    # Randomly decide what kind of error
    if random.random() > 0.5:
        log_with_trace('error', "Raising ValueError")
        raise ValueError("Simulated error for testing")
    else:
        log_with_trace('warning', "Returning error response")
        return jsonify({"error": "Something went wrong"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

