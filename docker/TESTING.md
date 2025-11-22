# TinyOlly Tests

## Running Tests

### Redis Storage Tests

Test the Redis storage layer with mocked Redis:

```bash
cd docker
python test_redis_storage.py
```

Or with pytest:
```bash
pytest test_redis_storage.py -v
```

### Test Coverage

The `test_redis_storage.py` tests cover:
- ✅ Storing spans with TTL
- ✅ Retrieving recent traces
- ✅ Getting trace spans
- ✅ Storing logs
- ✅ Service graph generation
- ✅ Cardinality protection for metrics

### Running All Tests

```bash
python -m pytest docker/ -v
```

## Test Structure

- `test_redis_storage.py` - Unit tests for `tinyolly_redis_storage.py`
  - Uses mocked Redis (no real Redis needed)
  - Tests all storage operations
  - Validates cardinality limits

## Adding New Tests

When adding new storage functionality:
1. Add corresponding test methods to `TestRedisStorage` class
2. Mock Redis responses appropriately
3. Verify both success and error cases
4. Test TTL and cardinality behavior

## CI/CD

These tests can run in CI without a Redis instance since they use mocks.

```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    pip install -r docker/requirements.txt
    python docker/test_redis_storage.py
```

