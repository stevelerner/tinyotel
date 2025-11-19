#!/bin/bash

echo "Generating CONTINUOUS traffic to Demo Frontend..."
echo "Press Ctrl+C to stop"
echo ""

count=0
while true; do
    count=$((count + 1))
    echo "Batch $count:"
    
    # Randomly call different endpoints
    case $((RANDOM % 5)) in
        0)
            curl -s http://localhost:5001/ > /dev/null
            echo "  -> GET /"
            ;;
        1)
            curl -s http://localhost:5001/hello > /dev/null
            echo "  -> GET /hello"
            ;;
        2)
            curl -s http://localhost:5001/calculate > /dev/null
            echo "  -> GET /calculate"
            ;;
        3)
            curl -s http://localhost:5001/process-order > /dev/null
            echo "  -> GET /process-order (complex trace)"
            ;;
        4)
            curl -s http://localhost:5001/error > /dev/null 2>&1
            echo "  -> GET /error"
            ;;
    esac
    
    # Small delay between requests
    sleep 1
done

