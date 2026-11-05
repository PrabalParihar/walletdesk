# WalletDesk submission checklist

ETHGlobal Mumbai. Submissions close **Sat 7 Nov 2026, 09:00 IST**. Late submissions are not accepted.
Partner picks (max 3): **1inch Aqua, Uniswap Foundation, Chainlink (CRE)**.

The repo stays **private** until the submission is filed, so the idea cannot be copied before judging. Making it
public is the second-to-last step below; Uniswap's rules require a public repo for judging.

## Status of the code (branch `claude/admiring-galileo-aq0yo0`)

Done and verified: 38 local tests, 20 Unichain-fork tests against the live PoolManager and Aqua, DemoSeed broadcast on
a fork (OverflowRouter fill + Uniswap PoolSwapTest fill), mainnet deploy script rehearsed on a fork, keeper live on
the fork, CRE workflow builds and its 16 tests pass, web lint + build. Merge the branch into `main` before you
submit, or submit the branch URL.

## You must do these (in order)

| # | Step | Why | Where |
| --- | --- | --- | --- |
| 1 | `cre login`, then run the CRE simulation and paste its output into `services/cre/desk-guard/SIMULATION.md` | Chainlink requires "a successful simulation via the CRE CLI" | `docs/CRE.md` |
| 2 | Deploy on Unichain mainnet with your own key (cheap gas, mock tokens), then ship + register from the UI and run one overflow swap. Paste the tx hashes into the README | Real on-chain transfers beat a fork for credibility | `README.md` → Deploy |
| 3 | Optional: deploy on Unichain Sepolia with `DEPLOY_AQUA=true` and point the CRE workflow at it (CRE supports Sepolia, not mainnet) | A CRE run against a real chain | `docs/CRE.md` |
| 4 | Export the Cursor agent prompts into `docs/prompts/01-cursor-v1.md` | ETHGlobal requires prompts for spec-driven work | `docs/prompts/` |
| 5 | Make your own commits from now on (README tx hashes, video link, any tweak). Do not squash or rewrite history | "Proper Git commit history", and evidence of human work | — |
| 6 | Record the video: 2–4 min, ≥720p, your own voice, not sped up, not on a phone | ETHGlobal rules | `docs/WALKTHROUGH.md` |
| 7 | Make the repo public | Uniswap requires a public open-source repo | GitHub settings |
| 8 | Submit the Uniswap feedback form with the link to `FEEDBACK.md` | Uniswap qualification | https://developers.uniswap.org/hackathon-feedback |
| 9 | File the ETHGlobal submission, select 1inch, Uniswap Foundation, Chainlink, paste the text below | — | ETHGlobal dashboard |

Leave at least two hours of buffer before 09:00 IST.

## Requirement map

### 1inch: Build an Aqua App ($5,000: 2.5k / 1.5k / 1k)

| Requirement | Status |
| --- | --- |
| Official Aqua / SwapVM contracts; a redeployed modified SwapVM is allowed | Done. Live Aqua registry; `WalletDeskRouter` inherits unmodified SwapVM v1.0.2 and replaces the opcode table. `docs/SWAPVM_DIFF.md` |
| Sophisticated position; custom SwapVM instructions score higher | Done. DeskBand opcode: value-weighted band in the v4 price unit, both directions, decay, fee; guarded by spot and CRE |
| On-chain token transfers in the demo (local fork is fine) | Done. `./script/demo.sh` and the fork tests show Aqua `Pulled` / `Pushed`. Step 2 adds mainnet |
| Proper commit history, no single-commit entries on the final day | Keep committing in small steps (step 5) |
| License | `contracts/src/swapvm/` is SwapVM-1.1 with dated change notes; "Powered by SwapVM / Aqua" in README and UI footer |

### Uniswap Foundation: Build with Uniswap ($10,000: 4k / 3k / 2k / 1k)

| Requirement | Status |
| --- | --- |
| Public open-source repo | Step 7, at submission time |
| `FEEDBACK.md` + feedback form with its link | File done; form is step 8 |
| README points to the integration lines | Done. README → Uniswap integration |

### Chainlink: Best workflow with CRE ($1,500)

| Requirement | Status |
| --- | --- |
| CRE workflow used as an orchestration layer, meaningfully used | Done. It is the hook's off-chain price guard; without a fresh reference, desks do not fill |
| Connects a blockchain with an external API | Done. Coinbase + Kraken HTTP → `DeskPriceFeed` on chain |
| Successful simulation via CRE CLI, or a live deployment | Step 1 (needs your CRE login) |

### ETHGlobal

| Requirement | Status |
| --- | --- |
| Work started after hacking opened (21:00 IST 5 Nov) | First commit 00:38 IST 6 Nov |
| AI use documented, with prompts and spec files | `AI.md`, `docs/prompts/`, `docs/spec/DESIGN.md`. Step 4 completes it |
| Video 2–4 min | Step 6 |

## Paste for the submission form

**Short description.** WalletDesk turns idle tokens in a wallet into Uniswap v4 liquidity without depositing them.

**Long description.** A maker ships a DeskBand strategy on 1inch Aqua: a custom SwapVM instruction that quotes a
value-weighted price band with decay and a fee, while the tokens stay in the wallet. Our Uniswap v4 hook caps how much
of an exact-input swap the pool fills and fills the residual from the best registered desk in the same transaction,
through any v4 router: it advances the residual from PoolManager reserves and returns a `BeforeSwapDelta` that charges
the caller. Before a desk fills, its quote must sit within the maker's limit of both the pool spot and a reference
price that a Chainlink CRE workflow writes on chain from Coinbase and Kraken, so a stale band is skipped instead of
picked off. A desk can never revert a swap: unfunded wallets, failed fills and stale references fall back to the pool.

**How it's made.** Foundry, Uniswap v4 (OpenZeppelin `BaseHook`), 1inch Aqua + SwapVM v1.0.2 (redeployed with our
opcode), Chainlink CRE TypeScript SDK, Next.js + wagmi, a viem keeper. 38 local tests plus the same hook suite on a
Unichain mainnet fork against the live PoolManager and Aqua.

**Partner prizes.** 1inch (Build an Aqua App), Uniswap Foundation (Build with Uniswap), Chainlink (Best workflow with CRE).

## Commands the judges can run

```bash
cd contracts
forge test --no-match-contract OverflowForkTest
forge test --match-contract OverflowForkTest
cd ..
./script/demo.sh
```

```bash
cd services/cre/desk-guard && bun install && bun run typecheck && bun test
```

## If you switch the third pick to Arc instead of Chainlink

Every Arc prize requires Arc Studio as the starting point, a Studio URL, and Studio shown in the video. Only "Advanced
Stablecoin Logic" fits, using `FeeShareTreasury` (rebates, `setSplit`) and the CCTP bridge. Steps: `arc/README.md`.
