# WalletDesk v2 design spec

Status: implemented on branch `claude/admiring-galileo-aq0yo0`, 6 Nov 2026 (IST). This file is the planning artifact
for the v2 changes. ETHGlobal asks spec-driven teams to keep specs and prompts in the repo; the prompts are in
`docs/prompts/`.

## Problem statement

v1 (first night of the hackathon) proved the composition: a Uniswap v4 hook caps the pool leg of an exact-input
swap and fills the residual from a maker wallet through a custom SwapVM instruction on 1inch Aqua. A review of v1
found four defects that a judge would hit, all reproduced with tests before fixing:

| # | Defect | Evidence |
| --- | --- | --- |
| D1 | Any address could overwrite the single desk slot of a pool and brick overflow swaps. | PoC: attacker registers an unshipped order with cap 1 wei; every OverflowRouter swap reverts. |
| D2 | The static band was picked off after the market moved. | PoC: pool spot moves ~3%, maker still pays 3.988 for 4 in vs 3.875 spot. |
| D3 | The band price was direction-blind and weighted raw units across decimals. | `amountIn * price` in both directions; WETH/USDC prices one side by ~3000x wrong. |
| D4 | Only `OverflowRouter` got maker liquidity, so no real router could reach desks. | Gate on `sender == overflowRouter`. PoC: a router that settles after the swap fills fine without it. |

Also: Aqua is not deployed on Unichain Sepolia, which made the Sepolia script (and the CCTP bridge deploy it
contained) revert; SwapVM-derived files were MIT instead of the SwapVM-1.1 license.

## Goals

1. A desk can never block or revert a swap. Desk problems are skips; the pool fills instead.
2. A maker is never filled far from the market: guard every fill against the pool spot and an off-chain
   reference that cannot be pushed inside one transaction.
3. Any v4 router reaches desks.
4. Correct pricing for any pair and either direction.
5. Stay inside the official Aqua / SwapVM contracts (modified SwapVM redeploy is allowed by 1inch's rules).

## Design

### Registry (D1)
- `Desk[]` per pool, at most `MAX_DESKS = 8`, one entry per maker (re-register replaces your own).
- `registerDesk` requires: caller is the maker; `USE_AQUA` trait set; no unwrap / zero-amount / maker-hook traits
  (bits 255, 253, 252..245); `1 <= maxDeviationBps <= 10_000`; pool cap set; Aqua `safeBalances` for the order
  succeeds and is non-zero (the strategy was really shipped).
- Full table: evict the desk with the least *deliverable* inventory, `min(shipped, wallet balance, Aqua allowance)`
  per side valued at pool spot, and only if the newcomer brings strictly more. Shipped balances are virtual, so they
  alone cannot be trusted.
- Pool cap is an owner setting (`setPoolCap`), not a maker setting, because several makers share one pool.

### Selection and guards (D2)
For each desk: `preview` (gas-capped, try/catch) → quote must be within `maxDeviationBps` of
`residual * spot` → if a feed is configured, within `maxDeviationBps` of `residual * reference` → maker wallet
balance and Aqua allowance must cover the quote. Best passing quote wins. A configured feed with a missing or
stale reference fails closed (no desk fills).

Reference: `DeskPriceFeed`, a Chainlink CRE consumer (`onReport(bytes,bytes)` from the forwarder, ERC165
`0x805f2132`). Report `abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)`; observations must move
forward in time.

### Fill (D4 and goal 1)
`take` the residual from PoolManager reserves → approve SwapVM → `swap` with a gas cap inside try/catch.
On revert: `sync` / transfer back / `settle`, emit `DeskSkipped(SwapFailed)` and `WouldRoute`, return a zero
delta. On success the returned `BeforeSwapDelta(+residual, -amountOut)` charges the caller for the residual, so the
unlock reverts unless the router settles. If PoolManager holds less than the residual of the input, skip up front.

### Pricing (D3)
Price unit = raw token1 per raw token0 × 1e18 (the v4 unit). `tokenIn < tokenOut` ⇒ zeroForOne ⇒
`out = in * P`; else `out = in / P`. Weight = value share of token1 at the band mid. Quote worsens for the taker as
the paid-out side drains, in both directions.

## Non-goals (documented as limitations)
- Splitting one residual across several desks, or sizing the pool leg by price impact instead of a fixed cap.
- Exact-output swaps and native ETH pools (skipped, pool fills).
- Capital-backed squatting: a party holding real inventory can occupy slots with off-market desks that the guard
  skips. Cost is capital lockup, not loss of funds.
- The pool-spot check alone is manipulable inside a transaction; the CRE reference is what closes that.

## Verification plan
- Unit + integration tests for each defect and each skip reason (`contracts/test/Overflow.t.sol`, `DeskBand.t.sol`).
- Same suite on a Unichain mainnet fork against the live PoolManager and Aqua (`OverflowForkTest`).
- `DemoSeed` broadcast on a local fork: OverflowRouter fill + Uniswap `PoolSwapTest` fill.
- Keeper on the fork: fills indexed, skip reasons indexed, live reference pushed.
