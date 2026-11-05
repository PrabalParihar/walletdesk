# Simulation record

**Status: `cre workflow simulate` has NOT been run successfully yet.** The official CRE CLI v1.39.0 binary is installed in the build sandbox. Its SHA-256 matches the release `checksums.txt`. Simulation needs a logged-in CRE account, and the sandbox has none. The CLI rejects the command before it compiles anything. Nothing below is simulator output except the authentication error. To produce the missing proof, run the commands in "To do" and paste their output here.

## To do (on a machine with `cre login`)

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
