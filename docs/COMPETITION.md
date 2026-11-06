# How WalletDesk compares

A short competitive brief (UX-strategy method: direct, indirect and jobs-to-be-done competitors). It describes how each
system works, from its own public pages, read on 6 November 2026. It is not a ranking, and it is not a claim that
WalletDesk is better at what these systems are built for.

## The job

- **Taker:** "When my swap is bigger than the pool is deep, fill it in one transaction without paying heavy price impact,
  from the router I already use."
- **Maker:** "Earn on inventory I already hold, without depositing it into a pool, and without being filled at a stale price."

## Who else does that job

| | WalletDesk | UniswapX | RFQ desks (Hashflow, Bebop) | 1inch Aqua on its own | Bunni (v4 hook) |
| --- | --- | --- | --- | --- | --- |
| Kind | v4 hook | Intent / filler auction | Request for quote | Shared-liquidity AMM | v4 hook DEX |
| Where the extra liquidity sits | Maker wallets, through Aqua | Wherever fillers source it | Market makers' inventory | Maker wallets | LP deposits in Bunni pools |
| What the swapper does | A normal v4 pool swap, any router | Signs an order; fillers compete | Asks for a quote, then executes it | Swaps routed to Aqua strategies | A v4 pool swap |
| Reaches a v4 pool's own swaps | Yes, inside the pool swap | Separate order flow | Separate API | Not by itself | Yes (its own pools) |
| Guard against a stale price | Pool spot and Chainlink CRE reference, per maker limit | Dutch auction decay | Short quote expiry | Maker's strategy and range | Liquidity that reshapes with the market (its own description) |
| Maker deposits | None | n/a | None (off-chain quoting) | None | Yes |

**Positioning.** WalletDesk is not another order flow. It brings wallet-held maker liquidity into the Uniswap v4 pool
swap itself, so it complements the others: a UniswapX filler, an aggregator or an RFQ maker can still route through a
WalletDesk pool, and 1inch Aqua makers get a path to Uniswap v4 flow.

## What their pages say (verbatim, for copy research)

| Site | Hero | How it builds trust |
| --- | --- | --- |
| [1inch Aqua](https://1inch.com/aqua) | "Provide liquidity without deposits" | "How shared liquidity works", "Risk-controlled execution", "Atomic fulfillment", "JIT fee-sniping protection", audits, an FAQ on risks |
| [UniswapX](https://x.uniswap.org) | "Fast Swaps. Smart Protection. Deep Liquidity." | "Fillers Compete. You Win.", "No Fees for Failed Swaps", "Validated by Research" |
| [Bebop](https://bebop.xyz) | "Trade tokenized stocks onchain" | "Guaranteed fills at your size", "Going big? You deserve better", volume and trade counts, five audit firms |
| [Hashflow](https://www.hashflow.com) | "The Liquidity Layer for DeFi" | "$25 billion+" volume, "Battle-tested security" |
| [Bunni](https://bunni.xyz) | "The Shapeshifting Exchange" | "Respond to markets while you sleep", "Enjoy Uniswap's unmatched orderflow" |
| [CoW DAO](https://cow.fi) | "Don't get milked!" | "the most user-protective products in Ethereum" |

Not reachable from our research environment: EulerSwap (host did not resolve) and Angstrom (access denied).

## What we changed because of it

1. **Say what is different, early.** The landing page now has a "How it compares" table right after problem and fix,
   because a partner judge's first question is "why not UniswapX, an RFQ desk, or Aqua alone?".
2. **Answer the doubts up front.** Aqua and Bebop lead with risk answers and audits. We added "Questions judges ask"
   (unfunded wallet, price manipulation, router, failed fill, spam, audit), each answer checked against the contract.
3. **Proof we can link, not volume we do not have.** Competitors show billions in volume; we show four numbers that each
   open their source (transactions, CRE run log, tests), and we say plainly that the code is not audited.
4. **Use Aqua's own words.** Aqua's hero is "Provide liquidity without deposits"; ours, "Wallets back Uniswap pools without
   depositing", is the same promise carried into Uniswap v4, which is the point of the 1inch prize.
