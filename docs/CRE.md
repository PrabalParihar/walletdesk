# Chainlink CRE: desk-guard reference price

A static DeskBand price band is safe only while the market stays inside it. `desk-guard` is a Chainlink CRE workflow. It writes an off-chain reference price for the desk pool to `DeskPriceFeed`. `OverflowHook` checks each desk quote against that reference before the maker's wallet fills anything.

Code and commands: `services/cre/desk-guard/README.md`. Run record: `services/cre/desk-guard/SIMULATION.md`.

## Why it matters

The worked example in the README quotes 3.988 tokens out for 4 in. That is about 0.997 per token, from a 0.99 to 1.01 band at 30 bps. Suppose the market moves so that 4 tokens are worth 3.875 (0.96875). The band does not move. A taker can still pull 3.988 from the maker, and the maker gives away 0.113 per 4 tokens. That is 291 bps above the market, and an arbitrageur takes it.

With desk-guard running, the hook sees the desk quote 291 bps from the reference. The fork deploy sets the maker's limit at `maxDeviationBps` 100, so the hook skips the desk and the pool fills alone. If the workflow stops, the reference ages past `maxReferenceAge` and the hook refuses desk fills again. An attacker can push the pool spot inside one transaction, but cannot push an off-chain reference that way.

## What the workflow does

```
cron */30s -> HTTP on every node: Coinbase USDT-USDC spot, Kraken USDCUSDT (inverted)
           -> per node: median of sources; fail if < minSources or spread > 50 bps
           -> DON consensus median -> sanity band 0.95..1.05 -> priceX18 (raw token1 per raw token0, 1e18)
           -> EVM read referenceOf(poolId) -> skip if inside deviation and heartbeat
           -> report abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)
           -> EVM write via the forwarder -> DeskPriceFeed.onReport(metadata, report)
           -> after a broadcast: read back and fail if the report did not land
```

If the workflow cannot form a price, it throws and writes nothing. The reference then goes stale, so the hook fails closed.

## Simulate

From `services/cre`, with CRE CLI v1.39.0 installed and logged in (`cre login`; simulation requires an account):

```bash
node desk-guard/scripts/etch-mock-forwarder.mjs                # local fork only
node desk-guard/scripts/make-config.mjs                        # reads priceFeed + poolId from contracts/deployments/local.json
cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0 [--broadcast]
./desk-guard/scripts/simulate-loop.sh                          # demo: re-run every 30 s
```

`--broadcast` needs `CRE_ETH_PRIVATE_KEY` in `services/cre/.env`. On the fork, use a funded anvil dev key. Without `--broadcast` the run is a dry run: an `eth_call` to the forwarder that changes no state.

## Pointing it at a deployed feed

- **Local fork.** `DemoSeed` deploys `DeskPriceFeed(deployer, deployer)`, so the keeper EOA is the forwarder and posts the same median price as a local stand-in. For the CRE path, start the demo with `FEED_FORWARDER=0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1 ./script/demo.sh` (DemoSeed then calls `setForwarder`), run the etch script, and simulate. The feed has a single forwarder, so the keeper stops posting once CRE owns it.
- **Unichain Sepolia.** Deploy with `CRE_FORWARDER=0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1` (MockKeystoneForwarder) for simulation. Switch to `0x98B8335d29Aca40840Ed8426dA1A0aAa8677d8D1` (KeystoneForwarder) for a deployed workflow. Then run `node desk-guard/scripts/make-config.mjs --target unichain-sepolia --feed <feed> --pool <poolId>` and `--target unichain-sepolia`.

## Chain support (checked 5 Nov 2026)

| Chain | CRE | Chain name / selector | Forwarders |
| --- | --- | --- | --- |
| Unichain mainnet (130) | **Not supported.** It is absent from the supported-networks page, the forwarder directory, `EVMClient.SUPPORTED_CHAIN_SELECTORS` in SDK 1.23.0, and the simulator chain list in CLI 1.39.0. | `ethereum-mainnet-unichain-1` / `1923510103922296319` (chain-selectors registry only) | none. `eth_getCode` is empty at both addresses on mainnet.unichain.org |
| Unichain Sepolia (1301) | Supported (CLI ≥ 1.5.0, TS SDK ≥ 1.3.0) | `ethereum-testnet-sepolia-unichain-1` / `14135854469784514356` | mock `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`, production `0x98B8335d29Aca40840Ed8426dA1A0aAa8677d8D1`. Both have code. |

The demo runs on an anvil fork of Unichain mainnet, so `project.yaml` registers it as a simulator `experimental-chains` entry with the selector, `rpc-url` and `forwarder` fields. This entry is documented only in the CLI's `project.yaml` template and source, not on docs.chain.link. The forwarder address is empty on mainnet. `etch-mock-forwarder.mjs` copies the Unichain Sepolia MockKeystoneForwarder runtime there with `anvil_setCode`. The CLI's own e2e test uses the same `anvil_setCode` method. A DON deployment needs Unichain Sepolia or another supported chain.

## Consumer contract requirements (verified)

- `onReport(bytes metadata, bytes report)`. `type(IReceiver).interfaceId` is `0x805f2132`.
- The forwarder runs `ERC165Checker`: `supportsInterface(0x01ffc9a7)` must return true, `(0xffffffff)` must return false, and `(0x805f2132)` must return true. Each check gets 30k gas. If a check fails, `onReport` is silently skipped.
- `metadata` is 64 bytes: workflowId 32, name 10, owner 20, reportId 2. `report` is the raw payload.
- A revert inside `onReport` does not revert the forwarder transaction. The simulator reports success, so desk-guard reads the feed back after a broadcast write.

A read-only `debug_traceCall` used state overrides to route a report through the Unichain Sepolia mock forwarder code into the `DeskPriceFeed` deployed on the local fork. The ERC165 answers were 1, 0, 1, and `onReport` ran with no error.

## Verified

- **`cre workflow simulate desk-guard --target unichain-sepolia` passed** on the team's machine (CRE CLI v1.39.0)
  against the live `DeskPriceFeed` `0xb1749dDDd701D99a9f318610a7A6962b11409c82`: Coinbase 0.998950, Kraken 0.998951,
  consensus 0.998950, on-chain reference read back (`998615000000000000`), report produced (`action: written`). Full
  output: [SIMULATION.md](../services/cre/desk-guard/SIMULATION.md). Rerun: `./services/cre/simulate-sepolia.sh`.
- The first attempts failed before the workflow started: zod's `z.string().url()` needs the global `URL`, which the
  CRE WASM engine does not provide. Source URLs are now validated with a plain regex, and `config.test.ts` reproduces
  the engine by deleting `globalThis.URL`.
- `cre workflow build` (TypeScript to WASM) and 19 SDK unit tests pass.

## Not verified

- The `local-fork` experimental-chain target is written from the CLI v1.39.0 source and has not been run.
- No `--broadcast` run yet: simulation mode returns `tx=0x`. A deployed workflow needs CRE deploy access, which the
  team has requested.

## Sources

- Supported networks: https://docs.chain.link/cre/supported-networks-ts
- Forwarder directory: https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts
- Consumer contracts, metadata layout, simulation forwarder: https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts
- Simulation and `--broadcast`: https://docs.chain.link/cre/guides/operations/simulating-workflows
- CLI install and releases: https://docs.chain.link/cre/getting-started/cli-installation/macos-linux, https://github.com/smartcontractkit/cre-cli/releases/tag/v1.39.0
- KeystoneForwarder: https://github.com/smartcontractkit/chainlink-evm/blob/b6427ea1f4847d640abdf24dbd6c6f01d7799d59/contracts/cre/src/v1/KeystoneForwarder.sol
- Experimental chains: `internal/settings/template/project.yaml.tpl` and `cmd/workflow/simulate/chain/evm/chaintype.go` in smartcontractkit/cre-cli
- Chain selectors: https://github.com/smartcontractkit/chain-selectors/blob/v1.0.111/selectors.yml
- SDK: https://www.npmjs.com/package/@chainlink/cre-sdk (1.23.0)
