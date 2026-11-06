#!/usr/bin/env bash
# One-command local demo. Forks Unichain mainnet, deploys the desk, ships a maker,
# runs the overflow swap, credits the local USDC treasury, and serves the UI.
# Refuses any RPC that is not loopback. Does not print private keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${DEMO_RPC_URL:-http://127.0.0.1:8545}"
PORT="${DEMO_PORT:-8545}"
export PATH="${PATH}:/home/ubuntu/.foundry/bin:${HOME}/.foundry/bin"

host="$(printf '%s' "$RPC" | sed -E 's#^[a-z]+://([^/:]+).*#\1#')"
case "$host" in
  127.0.0.1|localhost) ;;
  *)
    echo "demo.sh only broadcasts to a loopback RPC (got ${host})."
    exit 1
    ;;
esac

if curl -sf -m 2 -X POST "$RPC" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' >/dev/null; then
  echo "Something is already listening at ${RPC}. Stop it, or set DEMO_PORT to a free port."
  exit 1
fi

LOG="/tmp/walletdesk-anvil.log"
: >"$LOG"
anvil --fork-url "https://mainnet.unichain.org" --chain-id 130 --port "$PORT" --gas-limit 60000000 >"$LOG" 2>&1 &
ANVIL_PID=$!
KEEPER_PID=""
WEB_PID=""
cleanup() {
  kill "$ANVIL_PID" ${KEEPER_PID:-} ${WEB_PID:-} 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Waiting for the Unichain fork..."
ready=0
for _ in $(seq 1 120); do
  if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
    echo "anvil exited early"
    cat "$LOG"
    exit 1
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "fork did not answer on ${RPC}"
  cat "$LOG"
  exit 1
fi

chain="$(cast chain-id --rpc-url "$RPC")"
if [[ "$chain" != "130" ]]; then
  echo "expected chain id 130, got ${chain}"
  exit 1
fi

# Anvil prints its public development keys under "Private Keys". Read them from the log.
# Do not echo them. They are the keys from the Foundry book, not a production secret,
# and this script has already refused every non-loopback RPC.
DEPLOYER="$(awk '/Private Keys/{p=1; next} p && $1=="(0)" {print $2; exit}' "$LOG")"
MAKER_KEY="$(awk '/Private Keys/{p=1; next} p && $1=="(1)" {print $2; exit}' "$LOG")"
TAKER_KEY="$(awk '/Private Keys/{p=1; next} p && $1=="(2)" {print $2; exit}' "$LOG")"
if [[ -z "$DEPLOYER" || -z "$MAKER_KEY" || -z "$TAKER_KEY" ]]; then
  echo "Could not read Anvil's development accounts from ${LOG}"
  exit 1
fi

cd "$ROOT/contracts"
ALLOW_DEMO_BROADCAST=true \
  PRIVATE_KEY="$DEPLOYER" \
  MAKER_KEY="$MAKER_KEY" \
  TAKER_KEY="$TAKER_KEY" \
  DEMO_RPC_URL="$RPC" \
  forge script script/DemoSeed.s.sol --rpc-url "$RPC" --broadcast --slow --non-interactive

test -f "$ROOT/contracts/deployments/local.json"
mkdir -p "$ROOT/apps/web/public"
cp "$ROOT/contracts/deployments/local.json" "$ROOT/apps/web/public/deployments.json"

python3 - "$ROOT/contracts/deployments/local.json" "$RPC" <<'PY'
import json, subprocess, sys
path, rpc = sys.argv[1], sys.argv[2]
deployment = json.load(open(path))
print("hook", deployment["hook"])
print("maker", deployment["maker"])
print("taker", deployment["taker"])
print("treasury", deployment["treasury"])
print("price feed", deployment["priceFeed"])
print("pool", deployment["poolId"])
out = subprocess.check_output([
    "cast", "call", deployment["hook"],
    "lastFill(bytes32)(address,address,address,uint256,uint256,uint256,bytes32)",
    deployment["poolId"], "--rpc-url", rpc,
], text=True)
print(out.strip())
if deployment["maker"].lower() not in out.lower():
    raise SystemExit("seeded fill is missing the maker")
PY

if [[ ! -d "$ROOT/services/keeper/node_modules" ]]; then
  npm install --prefix "$ROOT/services/keeper"
fi
DEPLOYMENTS_PATH="$ROOT/contracts/deployments/local.json" \
  KEEPER_PRIVATE_KEY="$DEPLOYER" \
  RPC_URL="$RPC" \
  node "$ROOT/services/keeper/index.mjs" > /tmp/walletdesk-keeper.log 2>&1 &
KEEPER_PID=$!

if [[ ! -d "$ROOT/apps/web/node_modules" ]]; then
  npm install --prefix "$ROOT/apps/web"
fi
NEXT_PUBLIC_NETWORK=fork \
  NEXT_PUBLIC_RPC_URL="$RPC" \
  npm run build --prefix "$ROOT/apps/web" > /tmp/walletdesk-web-build.log
# npm --prefix runs the app's own "start" script inside apps/web, where .next and node_modules live.
NEXT_PUBLIC_NETWORK=fork \
  NEXT_PUBLIC_RPC_URL="$RPC" \
  npm --prefix "$ROOT/apps/web" run start -- --hostname 0.0.0.0 --port 43127 > /tmp/walletdesk-web.log 2>&1 &
WEB_PID=$!
for _ in $(seq 1 30); do
  curl -sf -m 2 -o /dev/null http://127.0.0.1:43127/ && break
  sleep 1
done
if ! curl -sf -m 2 -o /dev/null http://127.0.0.1:43127/; then
  echo "The UI did not start. Log: /tmp/walletdesk-web.log"
  tail -20 /tmp/walletdesk-web.log
  exit 1
fi

echo
echo "WalletDesk demo is up."
echo "  UI      http://127.0.0.1:43127"
echo "  Live    http://127.0.0.1:43127/live"
echo "  Keeper  http://127.0.0.1:8787/health   (also /fills, /skips, /reference)"
echo "  The keeper posts a live USDT/USD reference to DeskPriceFeed every 30s, standing in for the CRE workflow."
echo "  Maker   $(cast wallet address --private-key "$MAKER_KEY")"
echo "  Taker   $(cast wallet address --private-key "$TAKER_KEY")"
echo "Import an Anvil account from ${LOG} if you want the buttons to send transactions."
echo "The seeded overflow fill is already on the fork. Ctrl-C stops anvil, the keeper, and the UI."
echo

wait "$ANVIL_PID"
