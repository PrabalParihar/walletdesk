# Cursor agent prompts (v1): reconstruction

The v1 code (commits `4f83189` to `d7c4bfd`, 6 Nov 2026 00:38–02:05 IST) was produced by a Cursor cloud agent. That
agent session was **not exported**, so the verbatim prompts are not available. ETHGlobal asks for prompts and planning
artifacts; rather than invent wording, this file reconstructs **what each step asked the agent to build**, from the
commit messages. It is a summary, not a transcript.

| Step | Commit | What the agent was asked to build |
| --- | --- | --- |
| 1 | `6439024` | Scaffold a Foundry workspace where a Uniswap v4 hook (solc 0.8.26) and 1inch SwapVM (solc 0.8.30) coexist. |
| 2 | `7c60d3f` | Vendor Uniswap v4 (OpenZeppelin uniswap-hooks), 1inch Aqua, SwapVM v1.0.2 and solidity-utils 6.9.7. |
| 3 | `d94835f` | A custom SwapVM instruction (DeskBand) that prices from a band instead of XYCConcentrate; prove that ship leaves the wallet untouched and that quote equals swap. |
| 4 | `c992045` | A v4 hook that caps the pool leg of an exact-input swap and fills the residual from the maker wallet through DeskBand in the same transaction; test on a local pool and a Unichain mainnet fork. |
| 5 | `ea748fb` | An Arc USDC treasury that accounts in 6-decimal ERC-20 units and rejects native value, with an Arc Studio paste copy. |
| 6 | `8acd4c4` | Env-driven deploy scripts for Unichain Sepolia and Arc, with an explicit PoolManager. |
| 7 | `1194d4f` | A Next.js maker app: landing, ship, live overflow, fees. |
| 8 | `795c894` | Docs: architecture diagram, SwapVM diff, Uniswap feedback, AI file list. |
| 9 | `86e5f59` | A CCTP V2 bridge for USDC toward Arc domain 26. |
| 10 | `e28ae0f` | A one-command fork demo and a keeper that indexes Aqua Pulled / Pushed. |
| 11 | `d05b142` | Wire the app to the deployed desk: approve, ship, swap, claim. |
| 12 | `cae8b4d` | Submission checklist, demo walkthrough, CI. |
| 13 | `d7c4bfd` | Track the web env example. |

The direction behind these steps (the WalletDesk idea, the partner tracks, the architecture) came from the team; see
the team-contribution section in `AI.md`.
