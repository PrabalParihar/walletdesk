# WalletDesk submission checklist

ETHGlobal Mumbai. Partner picks: 1inch Aqua, Uniswap, Arc DeFi. Stablecoin logic is the optional split on `FeeShareTreasury.setSplit`.

Status is what is in this repo on the commit that added this file. "You" means Prabal before submit. No users, volume, or partners are claimed here.

## ETHGlobal

| ID | Requirement | Status |
| --- | --- | --- |
| EG1 | Public GitHub, steady commits, no single Saturday dump | In progress. History starts at `4f83189` and continues in small commits on `main`. Squash is not used. The repo was still private when this file was written. Make it public before submit. |
| EG2 | Demo video, 2 to 4 min, at least 720p, real voice, not sped up, not a phone | Blocked on you. Script: `docs/WALKTHROUGH.md`. The local demo is `./script/demo.sh`. |
| EG3 | AI-assisted files disclosed | Done. `AI.md` and `AI_DISCLOSURE.md`. |
| EG4 | Partner picks are 1inch, Uniswap, and Arc DeFi | Blocked on you. Select them on the ETHGlobal dashboard. This file is not a screenshot. |
| EG5 | Work starts at the hackathon. No prior product code | Done. Fresh repo. Upstream libraries under `contracts/lib` are vendored public packages. |
| EG6 | Prabal signs off before submit | Blocked on you. |

## 1inch Aqua

| ID | Requirement | Status |
| --- | --- | --- |
| I1 | Official Aqua / SwapVM contracts, modified router documented | Done. Registry `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`. Canonical router `0x111111338c5091E8440b67B168bAe16a668AC0De` is not called, because it has no DeskBand opcode. `docs/SWAPVM_DIFF.md`. `WalletDeskRouter` inherits unmodified `SwapVM` and replaces the opcode table. |
| I2 | Onchain token transfers in the demo. A local fork is allowed | Done on a fork. `OverflowForkTest` and `./script/demo.sh` pull from the maker wallet and push the taker's input back. The live page and `GET /fills` show `Pulled` and `Pushed`. |
| I3 | Commit history | Same as EG1. |
| I4 | SwapVM usage | Done. Program bytes from `DeskBandProgram`. The UI calls `OrderBuilder.buildBand` and `Aqua.ship`. |
| I5 | Sophisticated position: concentrate, decay, fee, and an oracle path | Done for concentrate, decay, and fee (DeskBand). Extruction to `UniV4OracleAdapter` is implemented and tested, and it is not in the default program. `docs/ORACLE.md` says why that would drop the maker's band and fee. |

## Uniswap

| ID | Requirement | Status |
| --- | --- | --- |
| U1 | Public open-source repo | MIT `LICENSE` is in the repo. Visibility is the same blocker as EG1. |
| U2 | `FEEDBACK.md` | Done. |
| U3 | Feedback form submitted with the `FEEDBACK.md` URL | Blocked on you. Form: https://developers.uniswap.org/hackathon-feedback |
| U4 | README points at the integration file and line | Done. Section "Uniswap integration". |

## Arc

| ID | Requirement | Status |
| --- | --- | --- |
| A1 | Built in Arc Studio, shareable URL, show Studio in the video | Blocked on you. Exact paste steps: `arc/README.md`. No URL is invented here. |
| A2 | Working frontend and backend | Frontend is wired for the local fork and for Sepolia via env. The keeper is the local backend. Studio's own frontend exists after you deploy the project. |
| A3 | Architecture diagram | Done. Mermaid in `docs/architecture.md`. Drawing: `docs/architecture.svg`. |
| A4 | USDC settlement on Arc | Code is ready. CCTP V2 burn and mint script: `docs/CCTP.md`. No Arc testnet transaction is in this repo, because broadcasting needs your key. The fork demo claims 6-decimal USDC from `FeeShareTreasury` on the fork and labels that path `attestor`. |
| A5 | GitHub or Replit link | This repo. |
| A6 | Submission names the DeFi Studio bounty, and Stablecoin Logic if splits ship | Text you can paste is below. `setSplit` is in the treasury. A split transaction on Arc testnet still needs your broadcast. |

## Paste for the submission form

WalletDesk turns idle tokens in a wallet into a Uniswap v4 market. The maker ships a DeskBand strategy on 1inch Aqua. Tokens stay in the wallet. `OverflowHook` lets the pool fill up to a cap and settles the residual from that wallet in the same transaction through a modified SwapVM router. Maker fees are accounted as 6-decimal USDC. On Unichain Sepolia, `CctpFeeBridge` burns that USDC through Circle CCTP V2 to Arc domain 26. A local Unichain fork cannot get an Iris attestation, so the demo credits `FeeShareTreasury` directly. The treasury can set a protocol split in basis points.

Picks: 1inch Aqua, Uniswap, Arc DeFi (Arc Studio treasury, plus the stablecoin split).

## Commands the judges can run

```bash
cd contracts
forge test --no-match-contract OverflowForkTest
forge test --match-contract OverflowForkTest
cd ..
./script/demo.sh
```

Fork tests use `https://mainnet.unichain.org`. If that RPC is down, the local suite still runs.
