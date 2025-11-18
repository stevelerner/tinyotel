import json
import random
import time
import sys
import logging
import requests
from datetime import datetime, timezone
from flask import Flask, jsonify
from opentelemetry import trace, metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

# Setup metrics - export every 5 seconds for better chart visibility
metric_exporter = OTLPMetricExporter(endpoint="http://otel-collector:4317")
metric_reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=5000)
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
order_counter = meter.create_counter(
    "app.orders.total",
    description="Total number of orders processed",
    unit="1"
)
order_value = meter.create_histogram(
    "app.order.value",
    description="Distribution of order values",
    unit="USD"
)

app = Flask(__name__)

# Backend service URL
BACKEND_URL = "http://backend-service:5000"

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
        "endpoints": ["/", "/hello", "/calculate", "/process-order", "/error"]
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

@app.route('/process-order')
def process_order():
    """
    Complex endpoint showing distributed tracing across services.
    All spans are automatically created by OpenTelemetry instrumentation!
    """
    request_counter.add(1, {"endpoint": "/process-order", "method": "GET"})
    order_counter.add(1, {"status": "initiated"})
    
    # Generate order details
    order_id = random.randint(1000, 9999)
    customer_id = random.randint(100, 999)
    item_count = random.randint(1, 5)
    base_price = random.uniform(10.0, 100.0) * item_count
    
    log_with_trace('info', f"Processing order {order_id} for customer {customer_id} with {item_count} items")
    
    # Step 1: Validate request (local work)
    log_with_trace('info', f"Validating order {order_id}")
    time.sleep(random.uniform(0.02, 0.05))
    log_with_trace('info', "Order validation successful")
    
    try:
        # Step 2: Check inventory via backend service
        # OpenTelemetry auto-instrumentation automatically creates distributed trace!
        log_with_trace('info', f"Checking inventory for {item_count} items")
        inventory_response = requests.post(
            f"{BACKEND_URL}/check-inventory",
            json={"items": item_count},
            timeout=5
        )
        inventory_data = inventory_response.json()
        in_stock = inventory_data.get('available', True)
        
        if not in_stock:
            log_with_trace('warning', "Items not available")
            order_counter.add(1, {"status": "failed"})
            return jsonify({
                "status": "failed",
                "order_id": order_id,
                "message": "Items out of stock"
            }), 409
        
        log_with_trace('info', "Inventory check complete - items available")
        
        # Step 3: Calculate pricing via backend service
        # Another automatic distributed trace span!
        log_with_trace('info', "Calculating order pricing")
        pricing_response = requests.post(
            f"{BACKEND_URL}/calculate-price",
            json={"items": item_count, "base_price": base_price},
            timeout=5
        )
        pricing_data = pricing_response.json()
        total_price = pricing_data.get('total', 0)
        
        log_with_trace('info', f"Pricing calculation complete: ${total_price:.2f}")
        
        # Step 4: Reserve inventory (local work)
        log_with_trace('info', f"Reserving {item_count} items")
        time.sleep(random.uniform(0.06, 0.1))
        log_with_trace('info', "Inventory reserved")
        
        # Step 5: Process payment via backend service
        # Final automatic distributed trace span!
        log_with_trace('info', f"Processing payment of ${total_price:.2f}")
        payment_response = requests.post(
            f"{BACKEND_URL}/process-payment",
            json={"amount": total_price},
            timeout=5
        )
        
        if payment_response.status_code == 200:
            payment_data = payment_response.json()
            receipt_id = payment_data.get('receipt_id')
            
            log_with_trace('info', f"Payment successful, receipt: {receipt_id}")
            
            # Step 6: Send confirmation (local work)
            log_with_trace('info', f"Sending confirmation to customer {customer_id}")
            time.sleep(random.uniform(0.04, 0.08))
            log_with_trace('info', "Confirmation sent")
            
            order_counter.add(1, {"status": "completed"})
            order_value.record(total_price, {"currency": "USD"})
            
            log_with_trace('info', f"Order {order_id} completed successfully")
            
            return jsonify({
                "status": "success",
                "order_id": order_id,
                "customer_id": customer_id,
                "items": item_count,
                "total": round(total_price, 2),
                "receipt_id": receipt_id,
                "message": "Order processed successfully"
            })
        else:
            log_with_trace('error', "Payment declined")
            order_counter.add(1, {"status": "failed"})
            
            return jsonify({
                "status": "failed",
                "order_id": order_id,
                "message": "Payment was declined"
            }), 402
            
    except requests.exceptions.RequestException as e:
        log_with_trace('error', f"Backend service error: {str(e)}")
        order_counter.add(1, {"status": "failed"})
        
        return jsonify({
            "status": "error",
            "order_id": order_id,
            "message": "Service temporarily unavailable"
        }), 503

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

