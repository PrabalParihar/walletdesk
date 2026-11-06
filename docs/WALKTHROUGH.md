# Demo walkthrough

ETHGlobal rules: 2 to 4 minutes, 720p or higher, your own voice, not sped up, not recorded on a phone, no
text-to-speech. Partner judges watch this video, so every beat shows something on chain.

There are two ways to make it. Both use the same story.

## Option A: the rendered video plus your voice (fastest)

[`video/`](../video/README.md) renders the picture with Remotion: real screen recordings of the app on a local Unichain
fork (real transactions, played at real speed), animated title, explainer and proof scenes, and captions. It is silent.
Play `video/out/walletdesk-demo.mp4`, read the script below in your own voice, then mux the two (command in
`video/README.md`). The times below match the render.

| Time | On screen | Say (about 2.5 words a second) |
| --- | --- | --- |
| 0:00–0:05 | Title | "This is WalletDesk. Wallets back Uniswap pools without depositing." |
| 0:05–0:16 | The idea: 5 DA in, the pool fills 1, a wallet fills 4 | "A big swap arrives. The Uniswap v4 pool fills up to its cap; our hook fills the rest from a maker's wallet through 1inch Aqua, price-checked by Chainlink CRE, in one transaction." |
| 0:16–0:38 | 01 The overview | "Big swaps on thin pools pay heavy price impact. Market makers' tokens sit idle in wallets. And static quotes get picked off. Each part of WalletDesk answers one of those, on one partner's stack, and every claim on the site links to a transaction, a run log or a test." |
| 0:38–0:52 | 02 A maker ships a desk | "As a maker, I set a price band, a fee and a maximum deviation, and ship it to 1inch Aqua as a DeskBand strategy, our own SwapVM instruction. No tokens leave my wallet." |
| 0:52–1:20 | 03 An overflow swap | "Now a taker swaps three tokens through Uniswap's own PoolSwapTest router, not ours. Before signing, the page shows the split: the pool takes its cap of one, my desk takes two. It is one transaction: the hook advances the residual from PoolManager, Aqua pulls from my wallet, and the router settles everything at the end. My spread stays in my wallet." |
| 1:20–1:40 | 04 The price guard | "Static quotes get picked off when the market moves. Here I push the reference to 0.95 to stand in for a move; on Sepolia, Chainlink CRE writes it. My desk is now outside its one percent limit, so the hook skips it and the pool fills alone. A swap is never blocked." |
| 1:40–2:01 | 05 In the code | "Under the hood: the hook, the DeskBand opcode and the CRE workflow, each linked to the exact lines of code. Control K jumps to any contract, transaction or doc." |
| 2:01–2:10 | 06 Proof | "It is live on Unichain Sepolia: two real overflow fills, thirty-one verified transactions, the CRE simulation passed, and thirty-eight contract tests." |
| 2:10–2:15 | Outro | "WalletDesk. Links are in the README." |

## Option B: record the screen yourself

Run `./script/demo.sh` and wait for "WalletDesk demo is up". Open the UI at http://127.0.0.1:43127 and the keeper at
http://127.0.0.1:8787/reference. On the fork, the header has **Demo maker** and **Demo taker** buttons: they connect
Anvil's unlocked dev accounts through the fork RPC, so no wallet extension or key import is needed. Use in-app
navigation (the header links or Ctrl K) during the take; a full page reload drops the demo connection. Keep a Uniscan tab
open on the live Sepolia fill from `docs/DEPLOYMENTS.md` (the PoolSwapTest swap). The CRE simulation already passed
against the live Sepolia feed; its output is in `services/cre/desk-guard/SIMULATION.md`.

| Beat | Time | On screen | Say |
| --- | --- | --- | --- |
| 1 | 0:00–0:20 | Landing page: the hero split bar draws 1 DA pool, 4 DA wallet. Scroll once through the problem → fix rows | "Large swaps on thin Uniswap pools pay heavy price impact, while market makers' tokens sit idle in wallets. WalletDesk lets a wallet back a v4 pool without depositing anything." |
| 2 | 0:20–0:55 | Make a desk: click Demo maker. Band 0.99–1.01, 30 bps, max deviation 100 bps. Approve and ship; the step list ticks through pack, ship ("virtual balances, no transfer") and register. Show the register transaction and "Wallet movement: none on ship" | "I ship a DeskBand strategy on 1inch Aqua. DeskBand is our own SwapVM instruction: a value-weighted price band with decay and a fee. The tokens stay in my wallet." |
| 3 | 0:55–1:45 | Live page: disconnect, click Demo taker. Router = Uniswap PoolSwapTest, size 3: the preview shows the split (1 to the pool, 2 to the desk) before any wallet prompt. Run overflow. Point at Wallet vs Virtual balances changing, the fill table (residual 2, shelf out ~1.99) and the keeper's Aqua Pulled / Pushed lines | "This is Uniswap's own test router, not ours. The pool fills the first unit; our hook fills the rest from my wallet through Aqua in the same transaction. The hook advances the residual from PoolManager reserves and the router settles it, so any v4 router works." |
| 4 | 1:45–2:35 | Price guard card: pool spot vs CRE reference and its age. Then show the skip: push a 0.95 reference (commands below) and run another overflow; "Last skip" reads "desk price too far from the CRE reference". If you have it, cut to the CRE simulation output | "A static band gets picked off when the market moves. Every fill is checked against the pool spot and a reference price written by a Chainlink CRE workflow from Coinbase and Kraken. Outside the maker's limit, the desk is skipped and the pool fills alone. The swap never reverts because of a desk." |
| 5 | 2:35–3:10 | `docs/DEPLOYMENTS.md` (live Unichain Sepolia fills), `services/cre/desk-guard/SIMULATION.md` (CRE run against the live feed), README integration tables, test summary (38 local + 21 on a Unichain fork) | "WalletDesk: Uniswap v4 hook, 1inch Aqua with a custom SwapVM opcode, and a Chainlink CRE price guard. Tested against the live Unichain PoolManager and Aqua. Links are in the README." |

Beat 4 needs a skewed reference. The keeper both refreshes the reference every 30 seconds and indexes skips for the
"Last skip" line, so do not stop it: restart it with the refresh turned off, then push 0.95 from the feed forwarder
(Anvil's account 0 on the fork; addresses come from `contracts/deployments/local.json`):

```bash
DEPLOYMENTS_PATH=contracts/deployments/local.json KEEPER_PRIVATE_KEY="$KEEPER_KEY" RPC_URL=http://127.0.0.1:8545 REFERENCE_PUSH=0 node services/keeper/index.mjs
```

```bash
REPORT=$(cast abi-encode "f(bytes32,uint256,uint64)" "$POOL_ID" 950000000000000000 $(( $(date +%s) + 400000 )))
cast send "$PRICE_FEED" "onReport(bytes,bytes)" 0x "$REPORT" --private-key "$KEEPER_KEY" --rpc-url http://127.0.0.1:8545
```

(Stop the keeper that `demo.sh` started before starting this one. The report's observation time must be later than the
last report's, which is why it uses the wall clock.)

What you record yourself: the voice, and, for option B, the screen capture. The repo does not invent either.
