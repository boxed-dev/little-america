#!/usr/bin/env bash
# Daily hotel-index refresh. Run by cron. Uses the local tsx binary (no PATH assumptions).
set -euo pipefail
cd /home/ubuntu/hotelzify-gptapp
export TYPESENSE_HOST=127.0.0.1 TYPESENSE_PORT=8108 TYPESENSE_PROTOCOL=http
export TYPESENSE_API_KEY="$(cat /home/ubuntu/typesense/api-key.txt)"
# Auto-discovers all chains by default. Set CHAIN_IDS="99999" once the backend
# aggregate chain is live to pull the full inventory in one shot instead.
exec ./node_modules/.bin/tsx scripts/ingest-hotels.ts
