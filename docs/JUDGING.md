# Judge WalletDesk in 5 minutes

WalletDesk lets market makers back a Uniswap v4 pool from their wallets without depositing. The pool fills a swap up
to a cap; the rest comes from the best maker desk (a 1inch Aqua strategy with our own SwapVM opcode) in the same
transaction, at a price checked against a Chainlink CRE reference.

## 60 seconds (any judge)

1. Read the problem and solution at the top of the [README](../README.md).
2. Open the live fill on Unichain Sepolia:
   [swap through Uniswap's stock PoolSwapTest router](https://sepolia.uniscan.xyz/tx/0x8d2b81fe61e8d7f5ea1187e32b6d8ad81904df3b3de595556a7809286f305d6e).
   In the logs, look for Aqua `Pulled` (maker wallet pays) and `Pushed` (maker receives the input) next to the v4 swap.
3. Open [SIMULATION.md](../services/cre/desk-guard/SIMULATION.md) and scroll to the last section: the CRE workflow
   fetched Coinbase and Kraken, agreed on 0.998950, read our live feed and produced the report.

Everything deployed, with links: [DEPLOYMENTS.md](DEPLOYMENTS.md).

## 1inch: Build an Aqua App

**What we built:** a new SwapVM instruction, DeskBand, that quotes a value-weighted price band with decay and a fee, on
a redeployed SwapVM that keeps the upstream Aqua `pull` / `push`. A maker's tokens stay in the wallet until a fill.

| Look at | Link |
| --- | --- |
| The opcode and its math | [DeskBand.sol#L21](../contracts/src/swapvm/DeskBand.sol#L21), [DeskBandMath.sol#L45](../contracts/src/swapvm/DeskBandMath.sol#L45), opcode table [WalletDeskRouter.sol#L58](../contracts/src/swapvm/WalletDeskRouter.sol#L58) |
| On-chain token transfers | [ship](https://sepolia.uniscan.xyz/tx/0x495fb08365fc9bc96679c21cfb056506d8b41c525e910c07a7f0031f02824378) (no tokens move), then [fill](https://sepolia.uniscan.xyz/tx/0x0c169e96abd27278b2330755717034dc30bc5d7eed5be48dbc48dbc43bff0340) (Aqua `Pulled` / `Pushed`) |
| Tests | `test_shipDoesNotMoveWallet_quoteMatchesSwap`, `test_bothDirectionsWithMixedDecimals`, `test_reverseDirectionQuoteMatchesSwap` in [DeskBand.t.sol](../contracts/test/DeskBand.t.sol) |

```bash
(cd contracts && forge test --match-contract DeskBandTest -vv)
```

What changed versus upstream SwapVM, and the license: [SWAPVM_DIFF.md](SWAPVM_DIFF.md).

## Uniswap Foundation: Build with Uniswap

**What we built:** a v4 hook with custom accounting (`beforeSwapReturnDelta`). Above a pool cap it fills the residual
from external wallet liquidity in the same swap, through any v4 router, and never reverts a swap because of a desk.

| Look at | Link |
| --- | --- |
| The hook | permissions [OverflowHook.sol#L270](../contracts/src/OverflowHook.sol#L270), routing [#L301](../contracts/src/OverflowHook.sol#L301), `take` [#L388](../contracts/src/OverflowHook.sol#L388), refund [#L393](../contracts/src/OverflowHook.sol#L393), returned delta [#L428](../contracts/src/OverflowHook.sol#L428) |
| Live fill through Uniswap's own router | [PoolSwapTest swap on Unichain Sepolia](https://sepolia.uniscan.xyz/tx/0x8d2b81fe61e8d7f5ea1187e32b6d8ad81904df3b3de595556a7809286f305d6e) |
| Tests | `test_stockV4RouterFillsFromDesk`, `test_failedFillRefundsAndFallsBack`, `test_stalePriceSkipsDesk`, `test_thinReservesFallBackToPool` in [Overflow.t.sol](../contracts/test/Overflow.t.sol) |

```bash
(cd contracts && forge test --match-contract OverflowLocalTest -vv)
(cd contracts && forge test --match-contract OverflowForkTest)     # same suite, live Unichain PoolManager + Aqua
```

Feedback for the Uniswap team: [FEEDBACK.md](../FEEDBACK.md).

## Chainlink: Best workflow with CRE

**What we built:** a CRE workflow (`desk-guard`) that is the hook's price guard: cron, Coinbase + Kraken over HTTP on
each node, DON consensus, signed report to our `DeskPriceFeed` consumer. Without a fresh report, no maker desk fills.

| Look at | Link |
| --- | --- |
| The workflow | [main.ts#L206](../services/cre/desk-guard/main.ts#L206) (`onCron`), consumer [DeskPriceFeed.sol#L66](../contracts/src/DeskPriceFeed.sol#L66), hook use [OverflowHook.sol#L461](../contracts/src/OverflowHook.sol#L461) |
| Successful simulation against the live Sepolia feed | [SIMULATION.md](../services/cre/desk-guard/SIMULATION.md) (last section) |
| Tests | 19 in [services/cre/desk-guard](../services/cre/desk-guard) (including `config.test.ts`, which reproduces the CRE WASM engine); `test_creReferenceGuard` in [Overflow.t.sol](../contracts/test/Overflow.t.sol) |

```bash
(cd services/cre/desk-guard && bun install && bun test)
./services/cre/simulate-sepolia.sh        # from the repo root; needs `cre login` and Bun 1.4+
```

Chain support, forwarders and consumer requirements: [CRE.md](CRE.md).
