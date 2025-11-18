import json
import random
import time
import sys
import logging
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from opentelemetry import trace, metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

# Setup metrics
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
inventory_checks = meter.create_counter(
    "backend.inventory.checks",
    description="Number of inventory checks",
    unit="1"
)
pricing_calculations = meter.create_counter(
    "backend.pricing.calculations",
    description="Number of pricing calculations",
    unit="1"
)
payment_attempts = meter.create_counter(
    "backend.payments.attempts",
    description="Number of payment attempts",
    unit="1"
)

app = Flask(__name__)

def log_with_trace(level, message):
    """Helper to log with trace context"""
    log_method = getattr(logger, level.lower(), logger.info)
    log_method(message)
    
    span = trace.get_current_span()
    ctx = span.get_span_context()
    trace_id = format(ctx.trace_id, '032x') if ctx.trace_id != 0 else 'no_trace'
    span_id = format(ctx.span_id, '016x') if ctx.span_id != 0 else 'no_span'
    
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": level.upper(),
        "trace_id": trace_id,
        "span_id": span_id,
        "message": message,
        "service": "backend"
    }
    
    print(json.dumps(log_entry), file=sys.stderr, flush=True)

@app.route('/check-inventory', methods=['POST'])
def check_inventory():
    """Check if items are in stock"""
    data = request.get_json()
    item_count = data.get('items', 1)
    
    inventory_checks.add(1, {"item_count": str(item_count)})
    log_with_trace('info', f"Checking inventory for {item_count} items")
    
    # Simulate database query
    time.sleep(random.uniform(0.05, 0.12))
    
    in_stock = random.choice([True, True, True, False])  # 75% success
    
    if not in_stock:
        log_with_trace('warning', "Items out of stock, checking alternatives")
        time.sleep(random.uniform(0.03, 0.08))
    
    log_with_trace('info', f"Inventory check complete: {'available' if in_stock else 'out of stock'}")
    
    return jsonify({
        "available": in_stock,
        "checked_items": item_count
    })

@app.route('/calculate-price', methods=['POST'])
def calculate_price():
    """Calculate pricing with discounts and tax"""
    data = request.get_json()
    item_count = data.get('items', 1)
    base_price = data.get('base_price', 50.0)
    
    pricing_calculations.add(1)
    log_with_trace('info', f"Calculating price for {item_count} items at ${base_price:.2f} base")
    
    # Fetch pricing rules
    time.sleep(random.uniform(0.02, 0.05))
    
    # Apply discount
    discount_rate = random.choice([0, 0, 0.1, 0.15, 0.2])
    discount_amount = base_price * discount_rate
    log_with_trace('info', f"Applied {discount_rate*100}% discount: ${discount_amount:.2f}")
    time.sleep(random.uniform(0.01, 0.03))
    
    # Calculate tax
    tax_rate = 0.08
    subtotal = base_price - discount_amount
    tax_amount = subtotal * tax_rate
    total = subtotal + tax_amount
    
    log_with_trace('info', f"Price calculation complete: ${total:.2f}")
    time.sleep(random.uniform(0.01, 0.02))
    
    return jsonify({
        "base_price": round(base_price, 2),
        "discount": round(discount_amount, 2),
        "tax": round(tax_amount, 2),
        "total": round(total, 2)
    })

@app.route('/process-payment', methods=['POST'])
def process_payment():
    """Process payment for order"""
    data = request.get_json()
    amount = data.get('amount', 0)
    
    payment_attempts.add(1)
    log_with_trace('info', f"Processing payment for ${amount:.2f}")
    
    # Validate card
    time.sleep(random.uniform(0.03, 0.06))
    log_with_trace('info', "Card validated")
    
    # Charge card (simulate payment gateway)
    time.sleep(random.uniform(0.1, 0.25))
    
    # Occasional failure
    success = random.random() > 0.1  # 90% success
    
    if success:
        log_with_trace('info', f"Payment of ${amount:.2f} processed successfully")
        receipt_id = random.randint(10000, 99999)
        
        # Generate receipt
        time.sleep(random.uniform(0.02, 0.04))
        
        return jsonify({
            "success": True,
            "receipt_id": receipt_id,
            "amount": round(amount, 2)
        })
    else:
        log_with_trace('error', "Payment declined by gateway")
        return jsonify({
            "success": False,
            "error": "Payment declined"
        }), 402

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "backend"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

