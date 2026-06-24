#!/usr/bin/env bash
# Daily hotel-index refresh. Run by cron. Uses the local tsx binary (no PATH assumptions).
set -euo pipefail
cd /home/ubuntu/hotelzify-gptapp
export TYPESENSE_HOST=127.0.0.1 TYPESENSE_PORT=8108 TYPESENSE_PROTOCOL=http
export TYPESENSE_API_KEY="$(cat /home/ubuntu/typesense/api-key.txt)"
export CHAIN_IDS="${CHAIN_IDS:-1,2,3}"  # set to 99999 once the backend aggregate chain is live
exec ./node_modules/.bin/tsx scripts/ingest-hotels.ts
