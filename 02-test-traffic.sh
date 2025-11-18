#!/bin/bash

echo "Generating traffic to TinyOTel app..."
echo ""

for i in {1..5}; do
    echo "Request $i:"
    
    # Call different endpoints
    curl -s http://localhost:5001/ | jq -r '.message' 2>/dev/null || curl -s http://localhost:5001/
    echo ""
    
    curl -s http://localhost:5001/hello | jq -r '.message' 2>/dev/null || curl -s http://localhost:5001/hello
    echo ""
    
    curl -s http://localhost:5001/calculate | jq 2>/dev/null || curl -s http://localhost:5001/calculate
    echo ""
    
    # Occasionally hit the error endpoint
    if [ $((i % 3)) -eq 0 ]; then
        curl -s http://localhost:5001/error 2>/dev/null
        echo ""
    fi
    
    sleep 1
done

echo ""
echo "Traffic generation complete!"
echo "  View logs:    ./03-logs-app.sh"
echo "  View traces:  ./04-show-traces.sh"
echo "  View metrics: ./05-show-metrics.sh"

