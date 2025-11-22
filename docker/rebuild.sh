#!/bin/bash
echo "Rebuilding TinyOlly with fresh cache..."
cd /Volumes/external/code/tinyolly/docker
docker-compose -f docker-compose-tinyolly-core.yml up --build -d
echo "Done! TinyOlly restarted at http://localhost:5005"

