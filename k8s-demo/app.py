"""
Demo Frontend Application
Uses OpenTelemetry auto-instrumentation for traces, metrics, and logs
Includes automatic traffic generation for continuous telemetry
"""
import random
import time
import logging
import requests
import threading
import os
from flask import Flask, jsonify

# Configure standard Python logging - OpenTelemetry will capture these
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Backend service URL
BACKEND_URL = "http://demo-backend:5000"

# Auto-traffic generation settings
AUTO_TRAFFIC_ENABLED = os.getenv('AUTO_TRAFFIC', 'true').lower() == 'true'
TRAFFIC_INTERVAL_MIN = int(os.getenv('TRAFFIC_INTERVAL_MIN', '3'))  # seconds
TRAFFIC_INTERVAL_MAX = int(os.getenv('TRAFFIC_INTERVAL_MAX', '8'))  # seconds

def generate_auto_traffic():
    """Background thread that generates automatic traffic for demo purposes"""
    logger.info(f"Auto-traffic generation started (interval: {TRAFFIC_INTERVAL_MIN}-{TRAFFIC_INTERVAL_MAX}s)")
    
    # Wait a bit for the app to fully start
    time.sleep(10)
    
    endpoints = ['/hello', '/calculate', '/process-order', '/error']
    weights = [25, 25, 40, 10]  # 40% complex orders, 25% calc, 25% hello, 10% error
    
    while True:
        try:
            # Choose an endpoint based on weights
            endpoint = random.choices(endpoints, weights=weights, k=1)[0]
            
            logger.info(f"Auto-traffic: calling {endpoint}")
            
            # Make internal request
            try:
                response = requests.get(f"http://localhost:5000{endpoint}", timeout=10)
                logger.info(f"Auto-traffic: {endpoint} -> {response.status_code}")
            except Exception as e:
                logger.warning(f"Auto-traffic request failed: {e}")
            
            # Random delay between requests
            delay = random.uniform(TRAFFIC_INTERVAL_MIN, TRAFFIC_INTERVAL_MAX)
            time.sleep(delay)
            
        except Exception as e:
            logger.error(f"Auto-traffic generation error: {e}")
            time.sleep(5)

@app.route('/')
def home():
    logger.info("Home endpoint called")
    return jsonify({
        "message": "TinyOlly Demo App",
        "endpoints": ["/", "/hello", "/calculate", "/process-order", "/error"],
        "auto_traffic": "enabled" if AUTO_TRAFFIC_ENABLED else "disabled"
    })

@app.route('/hello')
def hello():
    name = random.choice(["Alice", "Bob", "Charlie", "Diana"])
    logger.info(f"Greeting user: {name}")
    
    # Simulate some work
    work_duration = random.uniform(0.1, 0.5)
    time.sleep(work_duration)
    
    logger.info(f"Completed greeting for {name}")
    
    return jsonify({
        "message": f"Hello, {name}!",
        "timestamp": time.time()
    })

@app.route('/calculate')
def calculate():
    logger.info("Starting calculation")
    
    # Simulate complex calculation
    a = random.randint(1, 100)
    b = random.randint(1, 100)
    
    logger.info(f"Calculating {a} + {b}")
    calc_duration = random.uniform(0.2, 0.8)
    time.sleep(calc_duration)
    result = a + b
    
    logger.info(f"Calculation complete: {result}")
    
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
    # Generate order details
    order_id = random.randint(1000, 9999)
    customer_id = random.randint(100, 999)
    item_count = random.randint(1, 5)
    base_price = random.uniform(10.0, 100.0) * item_count
    
    logger.info(f"Processing order {order_id} for customer {customer_id} with {item_count} items")
    
    # Step 1: Validate request (local work)
    logger.info(f"Validating order {order_id}")
    time.sleep(random.uniform(0.02, 0.05))
    logger.info("Order validation successful")
    
    try:
        # Step 2: Check inventory via backend service
        # OpenTelemetry auto-instrumentation automatically creates distributed trace!
        logger.info(f"Checking inventory for {item_count} items")
        inventory_response = requests.post(
            f"{BACKEND_URL}/check-inventory",
            json={"items": item_count},
            timeout=5
        )
        inventory_data = inventory_response.json()
        in_stock = inventory_data.get('available', True)
        
        if not in_stock:
            logger.warning("Items not available")
            return jsonify({
                "status": "failed",
                "order_id": order_id,
                "message": "Items out of stock"
            }), 409
        
        logger.info("Inventory check complete - items available")
        
        # Step 3: Calculate pricing via backend service
        logger.info("Calculating order pricing")
        pricing_response = requests.post(
            f"{BACKEND_URL}/calculate-price",
            json={"items": item_count, "base_price": base_price},
            timeout=5
        )
        pricing_data = pricing_response.json()
        total_price = pricing_data.get('total', 0)
        
        logger.info(f"Pricing calculation complete: ${total_price:.2f}")
        
        # Step 4: Reserve inventory (local work)
        logger.info(f"Reserving {item_count} items")
        time.sleep(random.uniform(0.06, 0.1))
        logger.info("Inventory reserved")
        
        # Step 5: Process payment via backend service
        logger.info(f"Processing payment of ${total_price:.2f}")
        payment_response = requests.post(
            f"{BACKEND_URL}/process-payment",
            json={"amount": total_price},
            timeout=5
        )
        
        if payment_response.status_code == 200:
            payment_data = payment_response.json()
            receipt_id = payment_data.get('receipt_id')
            
            logger.info(f"Payment successful, receipt: {receipt_id}")
            
            # Step 6: Send confirmation (local work)
            logger.info(f"Sending confirmation to customer {customer_id}")
            time.sleep(random.uniform(0.04, 0.08))
            logger.info("Confirmation sent")
            
            logger.info(f"Order {order_id} completed successfully")
            
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
            logger.error("Payment declined")
            
            return jsonify({
                "status": "failed",
                "order_id": order_id,
                "message": "Payment was declined"
            }), 402
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Backend service error: {str(e)}")
        
        return jsonify({
            "status": "error",
            "order_id": order_id,
            "message": "Service temporarily unavailable"
        }), 503

@app.route('/error')
def error():
    logger.error("Error endpoint called - simulating failure")
    
    # Randomly decide what kind of error
    if random.random() > 0.5:
        logger.error("Raising ValueError")
        raise ValueError("Simulated error for testing")
    else:
        logger.warning("Returning error response")
        return jsonify({"error": "Something went wrong"}), 500

if __name__ == '__main__':
    logger.info("Starting demo frontend application")
    
    # Start auto-traffic generation in background thread
    if AUTO_TRAFFIC_ENABLED:
        traffic_thread = threading.Thread(target=generate_auto_traffic, daemon=True)
        traffic_thread.start()
        logger.info("Auto-traffic generation thread started")
    else:
        logger.info("Auto-traffic generation disabled")
    
    app.run(host='0.0.0.0', port=5000)
