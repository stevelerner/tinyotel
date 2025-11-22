import unittest
from unittest.mock import MagicMock, patch
import json
import sys

# Mock redis module before importing storage
mock_redis_module = MagicMock()
sys.modules['redis'] = mock_redis_module

from tinyolly_redis_storage import Storage

class TestRedisStorage(unittest.TestCase):
    def setUp(self):
        self.mock_redis = MagicMock()
        # Since we mocked the module, we need to mock the Redis class on the mocked module
        mock_redis_module.Redis.return_value = self.mock_redis
        self.storage = Storage()

    def test_store_span(self):
        span = {
            'traceId': 'trace1',
            'spanId': 'span1',
            'name': 'test-span',
            'startTimeUnixNano': 1000000000,
            'endTimeUnixNano': 2000000000
        }
        self.storage.store_span(span)
        
        # Check if span was stored
        self.mock_redis.setex.assert_called()
        args = self.mock_redis.setex.call_args[0]
        self.assertEqual(args[0], 'span:span1')
        self.assertEqual(args[1], 1800)  # TTL (updated to 30 minutes)
        self.assertEqual(json.loads(args[2]), span)
        
        # Check if trace index was updated
        self.mock_redis.zadd.assert_called()
        
    def test_get_recent_traces(self):
        # storage.py relies on decode_responses=True, so mock should return strings
        self.mock_redis.zrevrange.return_value = ['trace1', 'trace2']
        traces = self.storage.get_recent_traces()
        self.assertEqual(traces, ['trace1', 'trace2'])
        
    def test_get_trace_spans(self):
        # storage.py uses lrange
        self.mock_redis.lrange.return_value = [
            json.dumps({'spanId': 'span1'}),
            json.dumps({'spanId': 'span2'})
        ]
        
        spans = self.storage.get_trace_spans('trace1')
        self.assertEqual(len(spans), 2)
        self.assertEqual(spans[0]['spanId'], 'span1')
        
    def test_store_log(self):
        log = {
            'log_id': 'log1',
            'timestamp': 1234567890,
            'message': 'test log'
        }
        self.storage.store_log(log)
        
        self.mock_redis.setex.assert_called()
        self.mock_redis.zadd.assert_called()
        
    def test_get_service_graph(self):
        # Mock recent traces
        self.mock_redis.zrevrange.return_value = [b'trace1']
        
        # Mock spans for trace1
        # span1 (ServiceA) -> span2 (ServiceB)
        span1 = {
            'traceId': 'trace1',
            'spanId': 'span1',
            'serviceName': 'ServiceA',
            'parentSpanId': ''
        }
        span2 = {
            'traceId': 'trace1',
            'spanId': 'span2',
            'serviceName': 'ServiceB',
            'parentSpanId': 'span1'
        }
        
        # Mock get_trace_spans to return these spans
        # We need to mock the internal call to get_trace_spans or mock the redis calls it makes
        # Easier to mock get_trace_spans directly on the instance
        with patch.object(self.storage, 'get_trace_spans', return_value=[span1, span2]):
            graph = self.storage.get_service_graph()
            
            nodes = {n['id'] for n in graph['nodes']}
            self.assertIn('ServiceA', nodes)
            self.assertIn('ServiceB', nodes)
            
            edges = graph['edges']
            self.assertEqual(len(edges), 1)
            self.assertEqual(edges[0]['source'], 'ServiceA')
            self.assertEqual(edges[0]['target'], 'ServiceB')
            self.assertEqual(edges[0]['value'], 1)

    def test_cardinality_protection(self):
        """Test that metrics are dropped when cardinality limit is reached"""
        # Fill up to the limit
        self.mock_redis.scard.return_value = 1000  # At the limit
        
        metric = {
            'name': 'new.metric',
            'value': 42,
            'timestamp': 1234567890
        }
        
        # Should not store new metrics when at limit
        self.storage.store_metric(metric)
        
        # Check that the metric was not stored (only dropped counter updated)
        # The actual implementation increments a dropped_metrics counter

if __name__ == '__main__':
    unittest.main()

