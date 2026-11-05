# Why UniV4OracleAdapter is not in the default program

`UniV4OracleAdapter.extruction` replaces `amountOut` with the Uniswap v4 pool spot (`sqrtPriceX96`). It does not read the maker's price band, the half life, or the fee.

WalletDesk's default program is one opcode, DeskBand, registered at index 0 on `WalletDeskRouter`. The stock Extruction opcode is not registered. A DeskBand program therefore cannot call the adapter, and putting the adapter in front of DeskBand would discard the quote the maker shipped.

At the demo pool (tick 0, spot 1.0) the adapter quotes 4 tokens out for 4 tokens in. DeskBand with equal shelves, a 0.99 to 1.01 band, and 30 bps quotes 3.988. `OverflowLocalTest.test_poolSpotDoesNotReplaceDeskQuote` locks that difference. Quote and swap already agree because `preview` and the opcode both call `DeskBandMath.quoteExactIn`. The adapter does not improve that.

The adapter stays in the repo as a non-upgradeable spot target. Its body is `view`, so a static call and a state-changing call return the same amounts (`test_oracleAdapterIsStable`). A later router that registers Extruction can point at it. That is a different product from the concentrated desk.

## How price safety works instead (6 Nov 2026)

The band stays the maker's quote. Safety is a guard in `OverflowHook`, not a different opcode:

1. Pool spot: the desk quote for the residual must be within the maker's `maxDeviationBps` of `residual * spot`.
2. Chainlink CRE reference: when the hook owner sets a `DeskPriceFeed`, the quote must also be within `maxDeviationBps` of `residual * reference`, and the reference must be younger than `maxReferenceAge`. Missing or stale reference fails closed. The pool spot can be pushed inside one transaction; the off-chain reference cannot. See `docs/CRE.md`.

A desk outside either band is skipped and the pool fills the whole swap. `test_stalePriceSkipsDesk` and `test_creReferenceGuard` cover both.
