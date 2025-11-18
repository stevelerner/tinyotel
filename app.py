import json
import random
import time
import sys
from datetime import datetime, timezone
from flask import Flask, jsonify
from opentelemetry import trace, metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter

# Setup metrics
metric_exporter = OTLPMetricExporter(endpoint="http://otel-collector:4318/v1/metrics")
metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=5000)
meter_provider = MeterProvider(metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)

# Create meter and metrics
meter = metrics.get_meter(__name__)
request_counter = meter.create_counter(
    "http.server.requests",
    description="Total number of HTTP requests",
    unit="1"
)
calculation_counter = meter.create_counter(
    "app.calculations.total",
    description="Total number of calculations performed",
    unit="1"
)
calculation_result = meter.create_histogram(
    "app.calculation.result",
    description="Distribution of calculation results",
    unit="1"
)
greeting_counter = meter.create_counter(
    "app.greetings.total",
    description="Total number of greetings by name",
    unit="1"
)

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
    request_counter.add(1, {"endpoint": "/", "method": "GET"})
    log_with_trace('info', "Home endpoint called")
    return jsonify({
        "message": "TinyOTel Demo App",
        "endpoints": ["/", "/hello", "/calculate", "/error"]
    })

@app.route('/hello')
def hello():
    request_counter.add(1, {"endpoint": "/hello", "method": "GET"})
    
    name = random.choice(["Alice", "Bob", "Charlie", "Diana"])
    greeting_counter.add(1, {"name": name})
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
    request_counter.add(1, {"endpoint": "/calculate", "method": "GET"})
    calculation_counter.add(1, {"operation": "addition"})
    
    log_with_trace('info', "Starting calculation")
    
    # Simulate complex calculation
    a = random.randint(1, 100)
    b = random.randint(1, 100)
    
    log_with_trace('info', f"Calculating {a} + {b}")
    time.sleep(random.uniform(0.2, 0.8))
    result = a + b
    
    calculation_result.record(result, {"operation": "addition"})
    log_with_trace('info', f"Calculation complete: {result}")
    
    return jsonify({
        "operation": "addition",
        "a": a,
        "b": b,
        "result": result
    })

@app.route('/error')
def error():
    request_counter.add(1, {"endpoint": "/error", "method": "GET", "status": "error"})
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

