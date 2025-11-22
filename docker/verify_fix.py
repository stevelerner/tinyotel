import json
import sys
import os
from unittest.mock import MagicMock

# Add the directory to path so we can import the module
sys.path.append('/Volumes/external/code/tinyolly/docker')

# Mock modules
sys.modules['redis'] = MagicMock()
sys.modules['flask'] = MagicMock()
sys.modules['flask_cors'] = MagicMock()

# Mock storage to capture what would be stored
class MockStorage:
    def store_metric(self, metric):
        print(f"Stored metric: {json.dumps(metric, indent=2)}")
        print(f"Value type: {type(metric['value'])}")
        
        # Assertions
        if metric['name'] == 'test_counter':
            if not isinstance(metric['value'], int):
                print("FAIL: test_counter value is not an int")
                sys.exit(1)
        elif metric['name'] == 'test_gauge':
            if not isinstance(metric['value'], float):
                print("FAIL: test_gauge value is not a float")
                sys.exit(1)

# Monkey patch the storage module in the receiver
import tinyolly_redis_storage
tinyolly_redis_storage.Storage = MockStorage

# Import the receiver function
from importlib.machinery import SourceFileLoader
receiver = SourceFileLoader("receiver", "/Volumes/external/code/tinyolly/docker/tinyolly-otlp-receiver.py").load_module()

# Inject mock storage
receiver.storage = MockStorage()

# Test data
test_data = {
  "resourceMetrics": [
    {
      "scopeMetrics": [
        {
          "metrics": [
            {
              "name": "test_counter",
              "sum": {
                "dataPoints": [
                  {
                    "timeUnixNano": "1630000000000000000",
                    "asInt": "10",
                    "attributes": []
                  }
                ]
              }
            },
            {
              "name": "test_gauge",
              "gauge": {
                "dataPoints": [
                  {
                    "timeUnixNano": "1630000000000000000",
                    "asDouble": 15.5,
                    "attributes": []
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}

print("Running verification test...")
receiver.store_metric(test_data)
print("Verification complete: SUCCESS")
