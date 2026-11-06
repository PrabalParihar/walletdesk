# WalletDesk submission checklist

ETHGlobal Mumbai. Submissions close **Sat 7 Nov 2026, 09:00 IST**. Late submissions are not accepted.
Partner picks (max 3): **1inch Aqua, Uniswap Foundation, Chainlink (CRE)**.

The repo stays **private** until the submission is filed, so the idea cannot be copied before judging. Making it
public is the second-to-last step below; Uniswap's rules require a public repo for judging.

## Status of the code (branch `claude/admiring-galileo-aq0yo0`)

Done and verified:
- 38 local tests, plus 21 fork tests against the live Unichain PoolManager and Aqua.
- `./script/demo.sh` end to end.
- Playwright drove the UI on the fork: a swap through Uniswap's PoolSwapTest filled from the desk, ship + register, and a rebate claim.
- Mainnet and Sepolia deploy + seed rehearsed on forks.
- The CRE workflow builds and its 16 tests pass.
- Web lint + build, and CI green.

## Remaining steps (in order)

| # | Step | Who | Status |
| --- | --- | --- | --- |
| 1 | Live deploy on Unichain mainnet: deploy, reference, ship, register, two overflow swaps | Claude, burner key funded by the team | Runs automatically once the burner `0xdC8415C8A712cDdD6Bf503d45b54DB29A1a4e759` holds ≥ 0.0005 ETH (full run costs ≈ 0.0001 ETH). Record: `docs/DEPLOYMENTS.md` |
| 2 | Same on Unichain Sepolia (self-deployed Aqua), then hand the feed to the CRE mock forwarder | Claude, burner funded with Sepolia ETH | **Done.** 31 verified transactions in `docs/DEPLOYMENTS.md` |
| 3 | `cre workflow simulate` (Chainlink requires a successful run) | You, on your Mac (your `cre login` lives there) | One command: `./services/cre/simulate-sepolia.sh`. It appends the output to `SIMULATION.md`; then commit and push |
| 4 | Cursor prompts | Claude | Done as a labelled reconstruction: `docs/prompts/01-cursor-v1.md` (the session was not exported) |
| 5 | Your own commits from here (SIMULATION.md output, any tweak). No squash or history rewrite | You | — |
| 6 | Video: 2–4 min, ≥720p, your voice, not sped up, not a phone | You | `./script/demo.sh`, then use the **Demo maker / Demo taker** buttons; script in `docs/WALKTHROUGH.md` |
| 7 | Make the repo public | You, right before filing | Uniswap requires it |
| 8 | Uniswap feedback form with the link to `FEEDBACK.md` | You | https://developers.uniswap.org/hackathon-feedback |
| 9 | File on ETHGlobal, select 1inch, Uniswap Foundation, Chainlink, paste the text below | You | Before 09:00 IST Sat 7 Nov |

### Step 3: the CRE simulation on your Mac

The Sepolia feed is live and owned by the CRE simulation forwarder, and the config is committed. From your WalletDesk
clone:

```bash
git checkout main && git pull
```

```bash
./services/cre/simulate-sepolia.sh
```

```bash
git add services/cre/desk-guard/SIMULATION.md && git commit -m "docs(cre): desk-guard simulation on Unichain Sepolia" && git push
```

Run it from the WalletDesk repo, not from `~/chainlink-cre`. The workflow there is a different, unrelated project.
It needs Bun 1.4 or newer (`bun upgrade`), because `desk-guard/bun.lock` is lockfile format 2.

## Requirement map

### 1inch: Build an Aqua App ($5,000: 2.5k / 1.5k / 1k)

| Requirement | Status |
| --- | --- |
| Official Aqua / SwapVM contracts; a redeployed modified SwapVM is allowed | Done. Live Aqua registry; `WalletDeskRouter` inherits unmodified SwapVM v1.0.2 and replaces the opcode table. `docs/SWAPVM_DIFF.md` |
| Sophisticated position; custom SwapVM instructions score higher | Done. DeskBand opcode: value-weighted band in the v4 price unit, both directions, decay, fee; guarded by spot and CRE |
| On-chain token transfers in the demo (local fork is fine) | Done. `./script/demo.sh` and the fork tests show Aqua `Pulled` / `Pushed`. Step 1 adds real mainnet transfers |
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
| Successful simulation via CRE CLI, or a live deployment | Step 3, on your logged-in machine |

### ETHGlobal

| Requirement | Status |
| --- | --- |
| Work started after hacking opened (21:00 IST 5 Nov) | First commit 00:38 IST 6 Nov |
| AI use documented, with prompts and spec files | Done: `AI.md` (with team contribution), `docs/prompts/`, `docs/spec/DESIGN.md` |
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
