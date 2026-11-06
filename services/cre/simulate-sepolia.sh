#!/usr/bin/env bash
# One command for the Chainlink CRE proof: simulates WalletDesk's desk-guard workflow against the live
# DeskPriceFeed on Unichain Sepolia (addresses in docs/DEPLOYMENTS.md, config already committed) and appends the
# real simulator output to desk-guard/SIMULATION.md. Needs the CRE CLI with `cre login` done, and Bun 1.4 or newer.
# Run from anywhere:  ./services/cre/simulate-sepolia.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v cre >/dev/null || { echo "CRE CLI not found. Install it, then run: cre login"; exit 1; }
command -v bun >/dev/null || { echo "Bun not found. Install it: brew install oven-sh/bun/bun"; exit 1; }
# desk-guard/bun.lock is lockfile format 2, which Bun 1.4+ reads (CI uses 1.4.4). Older Bun fails on the frozen install.
BUN_VERSION="$(bun --version)"
case "$BUN_VERSION" in
  0.*|1.[0-3].*) echo "Bun $BUN_VERSION is too old for desk-guard/bun.lock. Run: bun upgrade (or brew upgrade oven-sh/bun/bun), then rerun."; exit 1 ;;
esac
cre whoami >/dev/null 2>&1 || { echo "Not logged in to CRE. Run: cre login"; exit 1; }

(cd desk-guard && bun install --frozen-lockfile >/dev/null)

OUT="$(mktemp)"
set +e
cre workflow simulate desk-guard --target unichain-sepolia --non-interactive --trigger-index 0 2>&1 | tee "$OUT"
STATUS=${PIPESTATUS[0]}
set -e

{
  echo
  echo "## Run on $(date -u +%Y-%m-%dT%H:%M:%SZ) (team machine, $(cre version 2>/dev/null | head -1))"
  echo
  echo "Target \`unichain-sepolia\`, feed \`0xb1749dDDd701D99a9f318610a7A6962b11409c82\` (see docs/DEPLOYMENTS.md). Exit status: $STATUS."
  echo
  echo '```'
  echo '$ cre workflow simulate desk-guard --target unichain-sepolia --non-interactive --trigger-index 0'
  # Drop ANSI colors; keep everything else verbatim.
  sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g' "$OUT"
  echo '```'
} >> desk-guard/SIMULATION.md
rm -f "$OUT"

echo
if [ "$STATUS" -eq 0 ]; then
  echo "Simulation passed. Output appended to services/cre/desk-guard/SIMULATION.md. Commit it:"
else
  echo "Simulation exited with $STATUS. The output is in SIMULATION.md; send it to Claude. To commit anyway:"
fi
echo "  git add services/cre/desk-guard/SIMULATION.md && git commit -m 'docs(cre): desk-guard simulation on Unichain Sepolia' && git push"
