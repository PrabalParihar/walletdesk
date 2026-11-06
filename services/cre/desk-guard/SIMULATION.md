# Simulation record

**Status: passed.** `cre workflow simulate desk-guard --target unichain-sepolia` ran successfully on the team's
machine on 6 Nov 2026 (CRE CLI v1.39.0); the full output is the last section of this file. The run fetched Coinbase and
Kraken, reached a consensus reference price, read the live `DeskPriceFeed` on Unichain Sepolia
(`0xb1749dDDd701D99a9f318610a7A6962b11409c82`, see `docs/DEPLOYMENTS.md`), and produced the report to write
(`action: written`). Simulation mode does not broadcast, so the report's `tx` is `0x`.

The first attempts failed before the workflow started: zod's `z.string().url()` needs the global `URL`, which the CRE
WASM engine lacks. Fixed in `main.ts`; `config.test.ts` reproduces it. The sandbox notes further down predate the run.

## Rerun (on a machine with `cre login`)

One command against the live Unichain Sepolia feed (config committed, addresses in `docs/DEPLOYMENTS.md`). It
appends the real output to the end of this file:

```bash
./services/cre/simulate-sepolia.sh
```

Manual equivalents:

```bash
cd services/cre
# local fork (see README section 3 for the etch and config steps)
cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0
cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0 --broadcast
# CRE-supported testnet
cre workflow simulate desk-guard --target unichain-sepolia --non-interactive --trigger-index 0
```

## What was run (2026-11-05, sandbox)

### `cre workflow simulate` (attempt)

```
$ cre workflow simulate desk-guard --target local-fork --non-interactive --trigger-index 0
Initializing...

! You are not logged in

✗ Authentication required: not logged in and no CRE_API_KEY set
  → Run 'cre login' interactively, or
  → Set CRE_API_KEY environment variable for non-interactive use
✗ authentication required: no credentials found: you are not logged in, run cre login and try again
```

`cre workflow build` is in the CLI's `LoginExemptCommands`. `cre workflow simulate` is not.

### `cre workflow build` (CRE CLI, TypeScript -> WASM, no login needed)

```
$ cre version
CRE CLI version v1.39.0
$ cre workflow build desk-guard -o /tmp/desk-guard.wasm
  Compiling workflow...
✓ Workflow compiled successfully
  Binary hash: 6eddba4c7f3580b5f327888feba28644278e456e2e442d8cb46e99d224294990
✓ Build output written to /tmp/desk-guard.wasm
```

### Unit tests (`bun test`, CRE SDK test runtime with mocked HTTP and EVM capabilities)

```
bun test v1.4.4 (38afee6c8)

 16 pass
 0 fail
 51 expect() calls
Ran 16 tests across 1 file.
```

The workflow's own log lines from the happy-path test follow. The source bodies were recorded from the live APIs. HTTP and EVM are mocked, and this is **not** simulator output.

```
source coinbase: 0.998450
source kraken: 0.998651 (inverted)
consensus reference price: 0.998550 (token1 per token0)
report written: poolId=0x1111…1111 priceX18=998550910021471014 observedAt=1793912880 tx=0x0101…0101
read back: referenceOf(poolId) = 998550910021471014 @ 1793912880
```

### Live sources (same parsers, plain HTTPS from the sandbox)

```
coinbase  0.998350
kraken    0.998552
median    0.998451  spread 2 bps
```

### Forwarder behaviour (read-only `debug_traceCall` with state overrides, nothing written)

The test put the runtime code of the Unichain Sepolia MockKeystoneForwarder (`0x6E9E…eDc1`, 5028 bytes, fetched with `eth_getCode`) into a state override. It also overrode a minimal ERC165-compliant receiver, then called `report(receiver, header(109 B) || payload, 0x, [])`.

```
CALL report            0x11289565
  CALL route           0x233fd52d
    STATICCALL supportsInterface(0x01ffc9a7)  gas 30000
    STATICCALL supportsInterface(0xffffffff)  gas 30000
    STATICCALL supportsInterface(0x805f2132)  gas 30000
    CALL onReport      0x805f2132  metadata.len=64  report == abi.encode(poolId, priceX18, observedAt)
```

- A receiver that returns true for `0xffffffff` stops after the second staticcall. `onReport` is never called, and the outer call does not revert.
- A receiver that reverts inside `onReport` shows the error on the inner call only. The outer `report()` still succeeds.

## Run on 2026-11-06T15:44:42Z (team machine, CRE CLI version v1.39.0)

Target `unichain-sepolia`, feed `0xb1749dDDd701D99a9f318610a7A6962b11409c82` (see docs/DEPLOYMENTS.md). Exit status: 0.

```
$ cre workflow simulate desk-guard --target unichain-sepolia --non-interactive --trigger-index 0
Initializing...
Loading settings...
! Using default private key for chain write simulation. To use your own key, set CRE_ETH_PRIVATE_KEY in your .env file or system environment.
Checking RPC connectivity...
Compiling workflow...
✓ Workflow compiled
✓ Simulation limits enabled
  HTTP: req=120kb resp=250kb timeout=10s | ConfHTTP: req=125kb resp=500kb timeout=1m30s | Consensus obs=25kb | ChainWrite evm_report=50kb evm_gas=10000000 solana_report=265b solana_cu=300000 | WASM binary=100mb compressed=20mb
  Binary hash: aa9ea86f612f5a1dbfa6c932be850399a8b12b35c3ce834dc31e68b94feeb49e
  Config hash: be95ee6c9619e1d7e1f61b5d2d8a4e17de8a7298bc5cb5d2c357a81543ed075b
2026-11-06T21:14:40Z [SIMULATION] Simulator Initialized

2026-11-06T21:14:40Z [SIMULATION] Running trigger trigger=cron-trigger@1.0.0
2026-11-06T21:14:41Z [USER LOG] source coinbase: 0.998950
2026-11-06T21:14:41Z [USER LOG] source kraken: 0.998951 (inverted)
2026-11-06T21:14:41Z [USER LOG] consensus reference price: 0.998950 (token1 per token0)
2026-11-06T21:14:41Z [USER LOG] onchain reference: priceX18=998615000000000000 updatedAt=1793976407 deviation=3 bps age=3474s
2026-11-06T21:14:42Z [USER LOG] report written: poolId=0xae93c1bd88e46a2fae33d97774b45f23f4b50d09592456487f208e1314bda1fe priceX18=998950550671794615 observedAt=1793979881 tx=0x

✓ Workflow Simulation Result:
{
  "action": "written",
  "deviationBps": "3",
  "observedAt": "1793979881",
  "onchainPriceX18": "998615000000000000",
  "poolId": "0xae93c1bd88e46a2fae33d97774b45f23f4b50d09592456487f208e1314bda1fe",
  "price": "0.998950",
  "priceX18": "998950550671794615",
  "txHash": "0x"
}

2026-11-06T21:14:42Z [SIMULATION] Execution finished signal received
2026-11-06T21:14:42Z [SIMULATION] Skipping WorkflowEngineV2

╭──────────────────────────────────────────────────────╮
│ Simulation complete! Ready to deploy your workflow?  │
│                                                      │
│ Run cre account access to request deployment access. │
╰──────────────────────────────────────────────────────╯
```
