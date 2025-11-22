#!/bin/bash
set +e  # Don't exit on errors

echo "═══════════════════════════════════════════════════════════"
echo "  TinyOlly - Manual Traffic Generator (OPTIONAL)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "NOTE: The demo apps now generate traffic AUTOMATICALLY!"
echo "      This script is OPTIONAL for generating EXTRA traffic."
echo ""
echo "Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if demo-frontend is running
echo "Checking if demo-frontend is available at http://localhost:5001..."
if ! curl -s --connect-timeout 5 http://localhost:5001/ > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to demo-frontend at http://localhost:5001"
    echo ""
    echo "Is the demo running? Start with:"
    echo "  ./01-start.sh"
    echo ""
    echo "Check container status:"
    echo "  docker ps | grep demo"
    echo ""
    exit 1
fi

echo "✓ Demo frontend is responding"
echo ""

# Trap Ctrl+C gracefully
trap 'echo ""; echo "Stopped traffic generation."; exit 0' INT

count=0
failures=0
while true; do
    count=$((count + 1))
    echo "Batch $count:"
    
    # Randomly call different endpoints
    endpoint=$((RANDOM % 5))
    case $endpoint in
        0)
            if curl -s --max-time 5 http://localhost:5001/ > /dev/null 2>&1; then
                echo "  ✓ GET /"
                failures=0
            else
                echo "  ✗ GET / (failed)"
                failures=$((failures + 1))
            fi
            ;;
        1)
            if curl -s --max-time 5 http://localhost:5001/hello > /dev/null 2>&1; then
                echo "  ✓ GET /hello"
                failures=0
            else
                echo "  ✗ GET /hello (failed)"
                failures=$((failures + 1))
            fi
            ;;
        2)
            if curl -s --max-time 5 http://localhost:5001/calculate > /dev/null 2>&1; then
                echo "  ✓ GET /calculate"
                failures=0
            else
                echo "  ✗ GET /calculate (failed)"
                failures=$((failures + 1))
            fi
            ;;
        3)
            if curl -s --max-time 5 http://localhost:5001/process-order > /dev/null 2>&1; then
                echo "  ✓ GET /process-order (complex trace)"
                failures=0
            else
                echo "  ✗ GET /process-order (failed)"
                failures=$((failures + 1))
            fi
            ;;
        4)
            # Error endpoint is expected to fail with 500, so just check if it responds
            curl -s --max-time 5 http://localhost:5001/error > /dev/null 2>&1
            echo "  ✓ GET /error"
            failures=0
            ;;
    esac
    
    # If too many consecutive failures, warn user
    if [ $failures -ge 5 ]; then
        echo ""
        echo "⚠️  WARNING: 5 consecutive failures. Is the demo still running?"
        echo "   Check: docker ps | grep demo"
        echo ""
        failures=0
    fi
    
    # Small delay between requests
    sleep 1
done

