# Uniswap hackathon feedback

WalletDesk is a v4 hook that caps how much of an exact-input swap the pool fills, then settles the residual from a wallet through 1inch Aqua in the same transaction.

## What worked

- `uniswapfoundation/v4-template` via OpenZeppelin `uniswap-hooks` `BaseHook` is a clear place to start. `getHookPermissions` plus `deployCodeTo` in tests made the permission bits obvious.
- `beforeSwap` returning `BeforeSwapDelta` is the right tool for "the pool swaps less than `amountSpecified`." Positive specified delta shrinks the pool leg. The hook then has to `take` and `settle` so its own delta is zero before unlock ends.
- Forking Unichain mainnet and talking to PoolManager `0x1F98400000000000000000000000000000000004` worked with the v4-core interfaces shipped beside `uniswap-hooks`. Initialize, modify liquidity, and swap all succeeded against that bytecode.

## What was rough

- Unichain Sepolia has two contracts with PoolManager-sized code and different runtime codehashes: `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` and `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`. On 5 Nov 2026 the v4 deployments page and the Unichain contract-address page list only the first one, and hookmate returns that same address. We default the deploy script to it. The second address still has code. Please keep a single `deployments.json` entry so the next person does not have to diff codehashes. The Sepolia explorer page is behind a bot check, so we verified with `cast code` on `https://sepolia.unichain.org`.
- The sign of `BeforeSwapDelta` is easy to get backwards from the name alone. The behavior we relied on is in `Hooks.beforeSwap`: `amountToSwap += hookDeltaSpecified`, and the same delta is later accounted to the hook. A short example that prefunds, `take`s inside `beforeSwap`, and returns the cancelling delta would have saved a design pass.
- v4-core in this template is pinned to solc `0.8.26`. SwapVM v1.0.2 is pinned to `0.8.30`. One Foundry compilation unit cannot import both. The hook keeps a local ABI twin of the order struct and deploys the router from its artifact.
- A hook that `take`s input during `beforeSwap` will pull whatever ERC-20 balance the PoolManager currently holds. We only do that after `OverflowRouter` has settled the taker's input, and we ignore other callers with `WouldRoute`. That footgun deserves a sentence in the custom-accounting docs.

## Ask

Publish one canonical PoolManager per chain in `deployments.json` and have every doc page read it. Add a reference hook that fills part of an exact-input swap from an external contract and shows the settle order.
