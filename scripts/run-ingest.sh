#!/usr/bin/env bash
# Daily hotel-index refresh. Run by cron. Uses the local tsx binary (no PATH assumptions).
set -euo pipefail
cd /home/ubuntu/hotelzify-gptapp
export TYPESENSE_HOST=127.0.0.1 TYPESENSE_PORT=8108 TYPESENSE_PROTOCOL=http
export TYPESENSE_API_KEY="$(cat /home/ubuntu/typesense/api-key.txt)"
# Auto-discovers all chains by default, then merges the aggregate snapshot.
# Once chainId=9999999 returns 200 again, set CHAIN_IDS="9999999" to pull it live
# and drop the snapshot.
export INGEST_SNAPSHOT="${INGEST_SNAPSHOT:-/home/ubuntu/hotelzify-gptapp/data/aggregate.json}"
exec ./node_modules/.bin/tsx scripts/ingest-hotels.ts
