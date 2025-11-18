"""
Bridge service that polls the demo app and forwards data to TinyOlly
"""

import requests
import time
import json
import re
from datetime import datetime

TINYOLLY_ENDPOINT = "http://tinyolly:5002"
APP_ENDPOINT = "http://app:5000"
POLL_INTERVAL = 2  # seconds

def extract_logs_from_docker():
    """
    In a real scenario, we'd parse logs from the app container.
    For this demo, we'll simulate by making requests and creating synthetic data.
    """
    pass

def poll_and_forward():
    """Poll app logs and forward telemetry to TinyOlly"""
    print("Bridge service started - forwarding telemetry to TinyOlly")
    print(f"   App: {APP_ENDPOINT}")
    print(f"   TinyOlly: {TINYOLLY_ENDPOINT}")
    
    last_request_time = time.time()
    
    while True:
        try:
            # Wait for services to be ready
            time.sleep(POLL_INTERVAL)
            
            # Check if we can reach TinyOlly
            try:
                health = requests.get(f"{TINYOLLY_ENDPOINT}/health", timeout=2)
                if health.status_code != 200:
                    print("TinyOlly not ready yet...")
                    continue
            except:
                print("Waiting for TinyOlly...")
                continue
            
            # In this simple version, we'll generate sample data when app is active
            # In a real implementation, we'd intercept OTLP data from the collector
            current_time = time.time()
            
            # Create a sample trace
            trace_id = format(int(current_time * 1000000) % (2**128), '032x')
            span_id = format(int(current_time * 1000) % (2**64), '016x')
            
            # Send sample trace
            trace_data = {
                "spans": [{
                    "traceId": trace_id,
                    "spanId": span_id,
                    "name": "sample.request",
                    "startTimeUnixNano": int((current_time - 0.1) * 1_000_000_000),
                    "endTimeUnixNano": int(current_time * 1_000_000_000),
                }]
            }
            
            try:
                requests.post(f"{TINYOLLY_ENDPOINT}/v1/traces", json=trace_data, timeout=2)
                print(f"Forwarded trace {trace_id[:16]}...")
            except Exception as e:
                print(f"Failed to forward trace: {e}")
            
            # Send sample log
            log_data = {
                "timestamp": current_time,
                "severity": "INFO",
                "trace_id": trace_id,
                "span_id": span_id,
                "message": f"Sample log entry at {datetime.fromtimestamp(current_time).isoformat()}"
            }
            
            try:
                requests.post(f"{TINYOLLY_ENDPOINT}/v1/logs", json=log_data, timeout=2)
                print(f"Forwarded log")
            except Exception as e:
                print(f"Failed to forward log: {e}")
            
            # Send sample metric
            metric_data = {
                "name": "sample.requests",
                "timestamp": current_time,
                "value": 1,
                "labels": {"method": "GET"}
            }
            
            try:
                requests.post(f"{TINYOLLY_ENDPOINT}/v1/metrics", json=metric_data, timeout=2)
                print(f"Forwarded metric")
            except Exception as e:
                print(f"Failed to forward metric: {e}")
            
        except Exception as e:
            print(f"Error in bridge: {e}")
            time.sleep(5)

if __name__ == '__main__':
    # Wait for services to start
    time.sleep(5)
    poll_and_forward()

