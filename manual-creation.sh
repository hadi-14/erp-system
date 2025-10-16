#!/bin/bash
API_BASE_URL="http://212.85.24.65:3000"
# API_BASE_URL="http://localhost:3000"

echo "Initializing historical data..."
curl -X POST "$API_BASE_URL/api/monitoring/init-from-db" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50}'

echo "Running price monitoring..." 
curl -X POST "$API_BASE_URL/api/monitoring/manual-run" \
  -H "Content-Type: application/json" \
  -d '{}'

echo "Done!"