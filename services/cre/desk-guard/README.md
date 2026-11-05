# desk-guard (Chainlink CRE workflow)

desk-guard writes an off-chain reference price for the WalletDesk pool to `DeskPriceFeed`. `OverflowHook` compares each desk quote against that reference. It refuses a fill when the quote deviates from the reference by more than the maker's limit, and it refuses when the reference is stale.

```
cron (*/30 s)
  -> HTTP, on every DON node: Coinbase USDT-USDC spot + Kraken USDCUSDT ticker (inverted)
     each node: median of its sources, fail if fewer than minSources or spread > maxSourceSpreadBps
  -> DON consensus: median of node observations (consensusMedianAggregation)
  -> sanity band [minPrice, maxPrice], decimals -> priceX18
  -> EVM read: DeskPriceFeed.referenceOf(poolId)       (skip if inside deviation + heartbeat)
  -> report = abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)
  -> EVM write: forwarder.report(...) -> DeskPriceFeed.onReport(metadata, report)
  -> EVM read back (broadcast only, verifyWrite): fail if the report did not land
```

`priceX18` is raw token1 units per 1 raw token0 unit, times 1e18. That is the Uniswap v4 unit `sqrtPriceX96^2 / 2^192`, scaled by 1e18. `observedAt` is DON time (`runtime.now()`) in seconds. If the workflow cannot get a trustworthy price, it throws and writes nothing, so the reference ages out and the hook fails closed.

Versions are pinned: CRE CLI v1.39.0, `@chainlink/cre-sdk` 1.23.0, viem 2.57.16, zod 3.25.76, typescript 5.9.3. You need Bun 1.2.21 or newer, because `cre-compile` runs under Bun.

## Layout

```
services/cre/                  CRE project root. Run every `cre` command from here.
  project.yaml                 targets: local-fork (experimental chain), unichain-sepolia
  .env.example                 CRE_ETH_PRIVATE_KEY (only for --broadcast)
  desk-guard/
    main.ts                    workflow (cron -> http -> consensus -> evm read/write)
    price.ts                   bigint price math and response parsers
    main.test.ts               bun tests (SDK test runtime, mocked HTTP + EVM)
    workflow.yaml              per-target workflow name + config path
    config.example.json        config template (no secrets)
    scripts/make-config.mjs    writes config.local.json / config.unichain-sepolia.json
    scripts/etch-mock-forwarder.mjs   puts MockKeystoneForwarder code on the local fork
    scripts/simulate-loop.sh   re-runs the simulation every 30 s during a demo
```

## Config keys

| key | meaning |
| --- | --- |
| `schedule` | cron with seconds, minimum 30 s on CRE (`*/30 * * * * *`) |
| `chainSelectorName` | `ethereum-mainnet-unichain-1` (local fork, experimental) or `ethereum-testnet-sepolia-unichain-1` |
| `feedAddress` | DeskPriceFeed |
| `poolId` | Uniswap v4 PoolId (`poolId` in `contracts/deployments/local.json`) |
| `gasLimit` | gas for the forwarder call into `onReport` |
| `token0Decimals`, `token1Decimals` | 18 / 18 for the demo pair (DA / DB) |
| `sources[]` | `{name, url, format: "coinbase-spot" or "kraken-ticker", invert}`; must yield token1 per token0 |
| `minSources`, `maxSourceSpreadBps` | per-node quorum and agreement |
| `minPrice`, `maxPrice` | sanity band on the human price |
| `deviationThresholdBps`, `heartbeatSeconds` | when to write; `heartbeatSeconds: 0` writes on every run |
| `verifyWrite` | read the feed back after a broadcast write |

The demo pool is two 18-decimal mocks, DA and DB, that trade around 1:1. The workflow treats DA as USDT and DB as USDC, so the reference is "USDC per USDT". If token0 and token1 sort the other way, flip `invert` on both sources.

## 1. Install (no install script)

```bash
# CRE CLI v1.39.0, Linux x86_64 with glibc > 2.35 (use cre_linux_amd64_ldd2-35.tar.gz on older glibc,
# cre_darwin_arm64.zip on Apple Silicon). Asset list: https://github.com/smartcontractkit/cre-cli/releases/tag/v1.39.0
curl -fL -o cre_linux_amd64.tar.gz https://github.com/smartcontractkit/cre-cli/releases/download/v1.39.0/cre_linux_amd64.tar.gz
curl -fL -o checksums.txt          https://github.com/smartcontractkit/cre-cli/releases/download/v1.39.0/checksums.txt
sha256sum cre_linux_amd64.tar.gz   # e840ee945d3741fbc76a3cae73749bc9a1730cc58c6babc5e65c2567413c7af0 (checksums.txt line "cre_v1.39.0_linux_amd64.tar.gz")
tar -xzf cre_linux_amd64.tar.gz && mv cre_v1.39.0_linux_amd64 cre && chmod +x cre && sudo mv cre /usr/local/bin/
cre version                        # CRE CLI version v1.39.0

cd services/cre/desk-guard && bun install && cd ..
```

`cre workflow simulate` needs a CRE account: run `cre login`, or set `CRE_API_KEY`. `cre workflow build` and `bun test` work without one.

## 2. Check without a chain

```bash
cd services/cre
cre workflow build desk-guard -o /tmp/desk-guard.wasm   # compiles TS -> WASM (no login)
cd desk-guard && bun test && bun run typecheck           # 16 unit tests, mocked HTTP + EVM
```

## 3. Simulate on the local Unichain-mainnet fork

CRE does not support Unichain mainnet (chain id 130). The `local-fork` target registers the fork as a simulator experimental chain. It uses the real Unichain chain selector `1923510103922296319`, the RPC `127.0.0.1:8545`, and the forwarder `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`. On mainnet that address is empty. The etch script copies the MockKeystoneForwarder runtime code there from Unichain Sepolia, which is the code `cre workflow simulate` targets on that testnet.

```bash
# 0. fork running (./script/demo.sh). DemoSeed makes the deployer the feed's forwarder; for the CRE
#    path the owner calls DeskPriceFeed.setForwarder(0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1).
cd services/cre
node desk-guard/scripts/etch-mock-forwarder.mjs           # anvil_setCode on 127.0.0.1 only
node desk-guard/scripts/make-config.mjs --feed <DeskPriceFeed> [--pool <poolId>]   # -> desk-guard/config.local.json
#   (without flags it reads "priceFeed" and "poolId" from contracts/deployments/local.json)

# dry run: fetches prices, reads the feed, eth_calls the forwarder, sends nothing
cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0

# real write on the fork: put a funded anvil dev key in services/cre/.env (CRE_ETH_PRIVATE_KEY=...)
cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0 --broadcast

cast call <DeskPriceFeed> "referenceOf(bytes32)(uint256,uint64)" <poolId> --rpc-url http://127.0.0.1:8545

# keep it fresh during the demo (stop it to show the stale-reference refusal)
./desk-guard/scripts/simulate-loop.sh
```

The simulator runs a cron trigger once, right away, and then exits. `--listen` does not support cron triggers, so `simulate-loop.sh` re-runs the simulation instead.

Read the dry-run result carefully. A dry run is an `eth_call` to `forwarder.report(...)`. The forwarder catches a revert inside `onReport` and still returns success, and a missing forwarder contract also returns success. Only `--broadcast` followed by the read-back (`verifyWrite`) proves that the report landed.

## 4. Simulate on Unichain Sepolia (CRE-supported)

```bash
node desk-guard/scripts/make-config.mjs --target unichain-sepolia --feed <DeskPriceFeed> --pool <poolId>
cre workflow simulate desk-guard --target unichain-sepolia --non-interactive --trigger-index 0 [--broadcast]
```

On Unichain Sepolia the simulation forwarder is the MockKeystoneForwarder at `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`. A deployed workflow uses the KeystoneForwarder at `0x98B8335d29Aca40840Ed8426dA1A0aAa8677d8D1`. Call `setForwarder` before you deploy. Deploying needs deploy access (`cre account access`) and is optional for the prize. With a deployed DON, consider `verifyWrite: false`.

## What DeskPriceFeed must do (checked against the forwarder code; all implemented in `contracts/src/DeskPriceFeed.sol`)

- Implement `onReport(bytes metadata, bytes report)` and accept calls only from the configured forwarder.
- Implement ERC165 in full. The forwarder runs `ERC165Checker` and makes three 30k-gas staticcalls: `supportsInterface(0x01ffc9a7)` must return true, `supportsInterface(0xffffffff)` must return false, and `supportsInterface(0x805f2132)` must return true. `0x805f2132` is `type(IReceiver).interfaceId`, which equals `onReport.selector`. If any check fails, `onReport` is never called and the transaction still succeeds.
- `metadata` is 64 bytes: `workflowId (32) | workflowName (10) | workflowOwner (20) | reportId (2)`. Do not require a length of 62. Do not check workflow identity while simulating.
- `report` is exactly `abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)`.
- Discard stale or out-of-order reports, for example by rejecting `observedAt <= last observedAt` for the pool. Use `block.timestamp` as `updatedAt` for the hook's staleness check, because DON time and anvil time can differ.
