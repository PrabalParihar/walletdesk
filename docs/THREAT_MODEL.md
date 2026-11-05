# Threat model

Scope: `OverflowHook`, `DeskPriceFeed`, `WalletDeskRouter` (modified SwapVM), `OverflowRouter`. Upstream Aqua,
SwapVM base, and Uniswap v4 are trusted as audited upstream code.

| Threat | Mitigation | Test |
| --- | --- | --- |
| Overwrite or brick another maker's desk | Per-maker entries; registration needs a shipped strategy; eviction only by more deliverable inventory | `test_strangerCannotReplaceAnotherDesk`, `test_registrationNeedsAShippedStrategy`, `test_evictionNeedsMoreLiveInventory` |
| Bluff inventory to evict (ship virtual balances you do not hold) | Value = min(shipped, wallet, allowance) | `test_evictionNeedsMoreLiveInventory` |
| Stale band picked off after the market moves | Spot guard + CRE reference guard, per-maker `maxDeviationBps` | `test_stalePriceSkipsDesk`, `test_creReferenceGuard` |
| Move the pool spot in the same tx to pass the spot guard | Off-chain CRE reference is also required when a feed is set; missing/stale reference fails closed | `test_creReferenceGuard` |
| Desk that quotes but cannot pay (DoS all large swaps) | Wallet balance + allowance pre-check; SwapVM call in try/catch with refund | `test_unfundedMakerIsSkipped`, `test_failedFillRefundsAndFallsBack` |
| Maker hooks running code or burning gas inside the fill | Hook/unwrap/zero-amount traits rejected at registration; `PREVIEW_GAS` and `SWAP_GAS` caps | `test_registerRejectsMakerHooks` |
| Re-entering the pool from inside the fill | Storage lock in `_beforeSwap`; the re-entrant swap reverts with `Reentrancy` | `test_reentrancyGuard` |
| Hook takes reserves it is not owed | Returned delta charges the swap caller; unlock reverts unless settled. Up-front check that PoolManager holds the residual | `test_genericRouterFillsFromDesk`, `test_thinReservesFallBackToPool` |
| Replay or roll back a reference | `observedAt` must strictly increase; future skew capped at 300 s; only the forwarder may write | `test_feedRejectsStrangersAndRollbacks` |
| Quote and fill disagree | Same `DeskBandMath` in `preview` and in the opcode; mismatch reverts the whole swap | `test_shipDoesNotMoveWallet_quoteMatchesSwap`, `test_reverseDirectionQuoteMatchesSwap` |

## Trusted roles
- Hook owner: sets pool caps and the price feed. Cannot move maker funds or censor a registered desk.
- Feed owner: sets the CRE forwarder. A malicious forwarder can make desks skip (fail closed) or, within each
  maker's `maxDeviationBps`, accept a skewed price; it cannot take funds.
- FeeShareTreasury attestor: credits USDC rebates from the treasury's own balance. Rebates are a protocol-funded
  program, not the maker's trading fee.

## Residual risks
- Capital-backed slot squatting (see `docs/spec/DESIGN.md`).
- Not audited. Hackathon code.
