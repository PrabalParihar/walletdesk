# Demo walkthrough

ETHGlobal rules: 2 to 4 minutes, 720p or higher, your own voice, not sped up, not recorded on a phone, no
text-to-speech. Partner judges watch this video, so every beat shows something on chain.

Before recording: run `./script/demo.sh` and wait for "WalletDesk demo is up". Open the UI at http://127.0.0.1:43127
and the keeper at http://127.0.0.1:8787/reference. On the fork, the header has **Demo maker** and **Demo taker**
buttons: they connect Anvil's unlocked dev accounts through the fork RPC, so no wallet extension or key import is
needed. Use in-app navigation (the header links) during the take; a full page reload drops the demo connection.
If you deployed to Unichain mainnet (SUBMISSION step 2), keep a block explorer tab on those transactions too.
If you ran the CRE simulation (SUBMISSION step 1), keep its terminal output ready.

| Beat | Time | On screen | Say |
| --- | --- | --- | --- |
| 1 | 0:00–0:20 | Landing page | "Large swaps on thin Uniswap pools pay heavy price impact, while market makers' tokens sit idle in wallets. WalletDesk lets a wallet back a v4 pool without depositing anything." |
| 2 | 0:20–0:55 | Ship page: click Demo maker. Band 0.99–1.01, 30 bps, max deviation 100 bps. Approve and ship; show the register transaction and "Wallet movement: none on ship" | "I ship a DeskBand strategy on 1inch Aqua. DeskBand is our own SwapVM instruction: a value-weighted price band with decay and a fee. The tokens stay in my wallet." |
| 3 | 0:55–1:45 | Live page: disconnect, click Demo taker. Router = Uniswap PoolSwapTest, size 3, Run overflow. Point at Wallet vs Virtual balances changing, the fill table (residual 4, shelf out ~3.988) and the keeper's Aqua Pulled / Pushed lines | "This is Uniswap's own test router, not ours. The pool fills the first unit; our hook fills the rest from my wallet through Aqua in the same transaction. The hook advances the residual from PoolManager reserves and the router settles it, so any v4 router works." |
| 4 | 1:45–2:35 | Price guard card: pool spot vs CRE reference and its age. Then show the skip: in a terminal, push a 0.95 reference (command below) and run another overflow; "Last skip" reads "desk price too far from the CRE reference". If you have it, cut to the CRE simulation output | "A static band gets picked off when the market moves. Every fill is checked against the pool spot and a reference price written by a Chainlink CRE workflow from Coinbase and Kraken. Outside the maker's limit, the desk is skipped and the pool fills alone. The swap never reverts because of a desk." |
| 5 | 2:35–3:10 | README integration tables, `docs/THREAT_MODEL.md`, test summary (38 local + 20 on a Unichain fork) | "WalletDesk: Uniswap v4 hook, 1inch Aqua with a custom SwapVM opcode, and a Chainlink CRE price guard. Tested against the live Unichain PoolManager and Aqua. Links are in the README." |

Push a skewed reference for beat 4 (the keeper key is the feed forwarder on the fork; values come from
`contracts/deployments/local.json`). Stop the keeper first or it will overwrite the reference within 30 seconds:

```bash
NOW=$(cast block latest -f timestamp --rpc-url http://127.0.0.1:8545)
REPORT=$(cast abi-encode "f(bytes32,uint256,uint64)" "$POOL_ID" 950000000000000000 $((NOW + 100000)))
cast send "$PRICE_FEED" "onReport(bytes,bytes)" 0x "$REPORT" --private-key "$KEEPER_KEY" --rpc-url http://127.0.0.1:8545
```

What you record yourself: the voice, the screen capture, the CRE simulation output, and any mainnet transaction
links. The repo does not invent any of them.
