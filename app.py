import json
import random
import time
import sys
import logging
from datetime import datetime, timezone
from flask import Flask, jsonify
from opentelemetry import trace, metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

# Setup metrics
metric_exporter = OTLPMetricExporter(endpoint="http://otel-collector:4317")
metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=2000)
meter_provider = MeterProvider(metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)

# Setup logging
logger_provider = LoggerProvider()
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(OTLPLogExporter(endpoint="http://otel-collector:4317"))
)
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)

# Configure Python logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

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
    """Helper to log with trace context via OpenTelemetry"""
    # Log via OpenTelemetry (will include trace context automatically)
    log_method = getattr(logger, level.lower(), logger.info)
    log_method(message)
    
    # Also print to stderr for debugging
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
    start_time = time.time()
    request_counter.add(1, {"endpoint": "/hello", "method": "GET"})
    
    name = random.choice(["Alice", "Bob", "Charlie", "Diana"])
    greeting_counter.add(1, {"name": name})
    log_with_trace('info', f"Greeting user: {name}")
    
    # Simulate some work
    work_duration = random.uniform(0.1, 0.5)
    time.sleep(work_duration)
    
    log_with_trace('info', f"Completed greeting for {name}")
    
    return jsonify({
        "message": f"Hello, {name}!",
        "timestamp": time.time()
    })

@app.route('/calculate')
def calculate():
    start_time = time.time()
    request_counter.add(1, {"endpoint": "/calculate", "method": "GET"})
    calculation_counter.add(1, {"operation": "addition"})
    
    log_with_trace('info', "Starting calculation")
    
    # Simulate complex calculation
    a = random.randint(1, 100)
    b = random.randint(1, 100)
    
    log_with_trace('info', f"Calculating {a} + {b}")
    calc_duration = random.uniform(0.2, 0.8)
    time.sleep(calc_duration)
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
    start_time = time.time()
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

