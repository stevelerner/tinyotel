"""
Demo Backend Service
Uses OpenTelemetry auto-instrumentation for traces, metrics, and logs
"""
import random
import time
import logging
from flask import Flask, jsonify, request

# Configure standard Python logging - OpenTelemetry will capture these
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/check-inventory', methods=['POST'])
def check_inventory():
    """Check if items are in stock"""
    data = request.get_json()
    item_count = data.get('items', 1)
    
    logger.info(f"Checking inventory for {item_count} items")
    
    # Simulate database query
    time.sleep(random.uniform(0.05, 0.12))
    
    in_stock = random.choice([True, True, True, False])  # 75% success
    
    if not in_stock:
        logger.warning("Items out of stock, checking alternatives")
        time.sleep(random.uniform(0.03, 0.08))
    
    logger.info(f"Inventory check complete: {'available' if in_stock else 'out of stock'}")
    
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
    
    logger.info(f"Calculating price for {item_count} items at ${base_price:.2f} base")
    
    # Fetch pricing rules
    time.sleep(random.uniform(0.02, 0.05))
    
    # Apply discount
    discount_rate = random.choice([0, 0, 0.1, 0.15, 0.2])
    discount_amount = base_price * discount_rate
    logger.info(f"Applied {discount_rate*100}% discount: ${discount_amount:.2f}")
    time.sleep(random.uniform(0.01, 0.03))
    
    # Calculate tax
    tax_rate = 0.08
    subtotal = base_price - discount_amount
    tax_amount = subtotal * tax_rate
    total = subtotal + tax_amount
    
    logger.info(f"Price calculation complete: ${total:.2f}")
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
    
    logger.info(f"Processing payment for ${amount:.2f}")
    
    # Validate card
    time.sleep(random.uniform(0.03, 0.06))
    logger.info("Card validated")
    
    # Charge card (simulate payment gateway)
    time.sleep(random.uniform(0.1, 0.25))
    
    # Occasional failure
    success = random.random() > 0.1  # 90% success
    
    if success:
        logger.info(f"Payment of ${amount:.2f} processed successfully")
        receipt_id = random.randint(10000, 99999)
        
        # Generate receipt
        time.sleep(random.uniform(0.02, 0.04))
        
        return jsonify({
            "success": True,
            "receipt_id": receipt_id,
            "amount": round(amount, 2)
        })
    else:
        logger.error("Payment declined by gateway")
        return jsonify({
            "success": False,
            "error": "Payment declined"
        }), 402

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "backend"})

if __name__ == '__main__':
    logger.info("Starting demo backend service")
    app.run(host='0.0.0.0', port=5000)
