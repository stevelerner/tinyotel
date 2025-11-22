import json
import time

# Mock storage
class MockStorage:
    def store_metric(self, metric):
        print(f"Stored metric: {json.dumps(metric, indent=2)}")
        print(f"Value type: {type(metric['value'])}")

storage = MockStorage()

def store_metric(metric_data):
    """Store metric data in Redis (compatible with TinyOlly frontend)"""
    try:
        for resource_metric in metric_data.get('resourceMetrics', []):
            for scope_metric in resource_metric.get('scopeMetrics', []):
                for metric in scope_metric.get('metrics', []):
                    try:
                        metric_name = metric.get('name', '')
                        
                        if not metric_name:
                            continue
                        
                        # Handle different metric types
                        metric_type = None
                        if 'sum' in metric:
                            data_points = metric['sum'].get('dataPoints', [])
                            metric_type = 'counter'
                        elif 'gauge' in metric:
                            data_points = metric['gauge'].get('dataPoints', [])
                            metric_type = 'gauge'
                        elif 'histogram' in metric:
                            data_points = metric['histogram'].get('dataPoints', [])
                            metric_type = 'histogram'
                        else:
                            print(f"Unknown metric type for {metric_name}")
                            continue
                        
                        for point in data_points:
                            # Convert nanoseconds to seconds
                            timestamp = int(point.get('timeUnixNano', 0)) / 1_000_000_000
                            
                            # Extract value based on metric type
                            is_histogram = 'histogram' in metric
                            if is_histogram:
                                # For histograms, extract all components
                                hist_sum = float(point.get('sum', 0))
                                hist_count = float(point.get('count', 0))
                                hist_min = point.get('min')
                                hist_max = point.get('max')
                                
                                # Get bucket counts and boundaries
                                bucket_counts = point.get('bucketCounts', [])
                                explicit_bounds = point.get('explicitBounds', [])
                                
                                # Calculate average for line chart
                                value = (hist_sum / hist_count) if hist_count > 0 else hist_sum
                                
                                # Store histogram-specific data
                                histogram_data = {
                                    'sum': hist_sum,
                                    'count': int(hist_count),
                                    'min': float(hist_min) if hist_min is not None else None,
                                    'max': float(hist_max) if hist_max is not None else None,
                                    'average': value
                                }
                                
                                # Process buckets if available
                                if bucket_counts:
                                    buckets = []
                                    for i, count in enumerate(bucket_counts):
                                        if explicit_bounds and i < len(explicit_bounds):
                                            bucket_bound = explicit_bounds[i]
                                            buckets.append({
                                                'bound': float(bucket_bound),
                                                'count': int(count)
                                            })
                                        elif explicit_bounds and i == len(explicit_bounds):
                                            buckets.append({
                                                'bound': None,
                                                'count': int(count)
                                            })
                                        elif not explicit_bounds:
                                            buckets.append({
                                                'bound': None,
                                                'count': int(count)
                                            })
                                    
                                    histogram_data['buckets'] = buckets
                            else:
                                # For counters and gauges
                                value = point.get('asInt', point.get('asDouble', 0))
                                histogram_data = None
                            
                            # Extract attributes/labels
                            labels = {}
                            for attr in point.get('attributes', []):
                                key = attr.get('key', '')
                                val = attr.get('value', {})
                                if 'stringValue' in val:
                                    labels[key] = val['stringValue']
                                elif 'intValue' in val:
                                    labels[key] = str(val['intValue'])
                            
                            metric_record = {
                                'name': metric_name,
                                'timestamp': timestamp,
                                'value': value,
                                'labels': labels,
                                'type': metric_type
                            }
                            
                            if is_histogram and histogram_data:
                                metric_record['histogram'] = histogram_data
                            
                            storage.store_metric(metric_record)
                            
                    except Exception as e:
                        print(f"Error processing individual metric: {e}")
                        continue
                        
    except Exception as e:
        print(f"Error storing metric: {e}")

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
            }
          ]
        }
      ]
    }
  ]
}

print("Running test...")
store_metric(test_data)
print("Test complete.")
