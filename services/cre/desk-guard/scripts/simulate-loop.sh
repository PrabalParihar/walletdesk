#!/usr/bin/env bash
# Keeps DeskPriceFeed fresh on the local fork during a demo.
#
# `cre workflow simulate` runs a cron trigger once, immediately, and exits (cron is not
# supported by --listen). This loop re-runs it every INTERVAL seconds with --broadcast so the
# hook keeps seeing a fresh reference. Stop it and the reference goes stale, and the hook
# refuses desk fills: that is the fail-closed path.
#
#   ./desk-guard/scripts/simulate-loop.sh            # from services/cre
#   INTERVAL=30 TARGET=local-fork ./desk-guard/scripts/simulate-loop.sh
set -euo pipefail

cd "$(dirname "$0")/../.."   # services/cre (the CRE project root)
INTERVAL="${INTERVAL:-30}"
TARGET="${TARGET:-local-fork}"

while true; do
  cre workflow simulate desk-guard \
    --target "$TARGET" \
    --non-interactive --trigger-index 0 \
    --broadcast || echo "simulate failed; the onchain reference was not refreshed"
  sleep "$INTERVAL"
done
