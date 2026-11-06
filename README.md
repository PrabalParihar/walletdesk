# WalletDesk

Turn idle tokens in your wallet into a Uniswap market, without depositing them.

A maker ships a custom SwapVM strategy (DeskBand) on 1inch Aqua. The tokens stay in the wallet. When a Uniswap v4
swap is larger than the pool cap, `OverflowHook` lets the pool fill the cap and fills the residual from the best
maker desk in the same transaction, through any v4 router. Every fill is checked against the pool spot and a
Chainlink CRE reference price, so a stale band is skipped instead of picked off.

ETHGlobal Mumbai. Partner picks: **1inch Aqua, Uniswap, Chainlink CRE**. Arc is optional (see `SUBMISSION.md`).

Powered by SwapVM — © Degensoft Ltd 2025 · Powered by Aqua — © Degensoft Ltd 2025

## What is working

| Check | Result |
| --- | --- |
| Local Foundry suite | 38 tests pass: `forge test --no-match-contract OverflowForkTest` |
| Same hook suite on a Unichain mainnet fork, live PoolManager `0x1F98…0004` and live Aqua `0x1111113C…a90a` | 21 tests pass: `forge test --match-contract OverflowForkTest` |
| `DemoSeed` broadcast on a local fork | Ship, register, fill through `OverflowRouter`, fill through Uniswap's stock `PoolSwapTest` router, USDC rebate. `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL` |
| `DeployUnichainMainnet` rehearsed on the fork | Deploys against the live contracts; refuses without `CONFIRM_MAINNET=true` |
| Keeper on the fork | Indexes fills (Aqua `Pulled` / `Pushed`) and skip reasons; posts a live USDT/USD reference (median of Coinbase and Kraken) |
| Chainlink CRE workflow | `cre workflow build`, `tsc` and 16 SDK tests pass. `cre workflow simulate` needs a CRE login: see `docs/CRE.md` |
| Web | `npm run lint` and `npm run build` pass. Playwright drove the real UI on the fork: a swap through Uniswap's PoolSwapTest filled from the desk, a maker shipped and registered a desk, and the maker claimed the USDC rebate, with no console errors |

Worked numbers (equal shelves, 0.99–1.01 band, 30 bps): 5 in with a pool cap of 1 pulls `3.988` of the output token
from the maker and pushes `4` of the input back. The pool fills the other 1.

## How it works

1. **Ship.** The maker approves Aqua and ships a DeskBand order. Aqua records virtual balances; nothing moves.
2. **Register.** `OverflowHook.registerDesk` checks the order was really shipped, rejects maker-hook traits, and
   stores the maker's `maxDeviationBps`. Up to 8 desks per pool, one per maker. A full table evicts the desk with
   the least *deliverable* inventory (min of shipped, wallet balance, Aqua allowance).
3. **Swap through any v4 router.** If the exact input exceeds the pool cap, the hook quotes every desk, drops any
   desk outside its deviation limit from the pool spot or from the CRE reference, or whose wallet cannot pay, and
   takes the best quote.
4. **Fill.** The hook advances the residual from PoolManager reserves, pays it to the maker through the modified
   SwapVM (Aqua `pull` / `push`), settles the maker's output, and returns a `BeforeSwapDelta` that charges the
   caller. The router settles at the end of the unlock or the whole transaction reverts.
5. **Never block a swap.** A failed SwapVM call is caught, the residual is handed back, and the pool fills
   everything. Every skip emits `DeskSkipped(reason)`.

## Uniswap integration

| What | Where |
| --- | --- |
| Permissions: `beforeSwap` and `beforeSwapReturnDelta` | `contracts/src/OverflowHook.sol:270` |
| Cap, residual, PoolManager reserve check, `WouldRoute` | `contracts/src/OverflowHook.sol:301` (reserves `:322`) |
| Best desk and guards (spot, CRE reference, funded wallet) | `contracts/src/OverflowHook.sol:344`, `:364` |
| Advance the residual from reserves (`take`) | `contracts/src/OverflowHook.sol:388` |
| Failed fill: refund with `sync` / `settle`, zero delta | `contracts/src/OverflowHook.sol:393` |
| Returned `BeforeSwapDelta` that charges the caller | `contracts/src/OverflowHook.sol:428` |
| Pool spot from `slot0` in the v4 price unit | `contracts/src/OverflowHook.sol:263` |
| Optional taker entry with slippage check | `contracts/src/OverflowRouter.sol:43` |
| Stock `PoolSwapTest` router filled from a desk | `contracts/test/Overflow.t.sol` (`test_stockV4RouterFillsFromDesk`), `contracts/script/DemoSeed.s.sol` |
| Fork tests against PoolManager `0x1F98400000000000000000000000000000000004` | `contracts/test/Overflow.t.sol` (`OverflowForkTest`) |

The hook follows `BaseHook` from OpenZeppelin `uniswap-hooks`. Feedback for the Uniswap team: `FEEDBACK.md`.

## 1inch Aqua / SwapVM integration

| What | Where |
| --- | --- |
| DeskBand instruction (new SwapVM opcode) | `contracts/src/swapvm/DeskBand.sol:21` |
| Pricing: price unit, both directions, value-weighted band, decay, fee | `contracts/src/swapvm/DeskBandMath.sol:45`, `:81` |
| Opcode table on the modified router | `contracts/src/swapvm/WalletDeskRouter.sol:58` |
| `preview` uses the same math as the opcode | `contracts/src/swapvm/WalletDeskRouter.sol:33` |
| Program bytes and order packing | `contracts/src/swapvm/DeskBandProgram.sol`, `contracts/src/swapvm/OrderBuilder.sol` |
| Unmodified `Aqua.push` / `Aqua.pull` | `contracts/lib/swap-vm/src/SwapVM.sol:237`, `:286` |
| Shipped-strategy check and deliverable inventory | `contracts/src/OverflowHook.sol:181`, `:515` |
| Ship does not move the wallet; quote equals swap in both directions | `contracts/test/DeskBand.t.sol` |

Registry: `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a` (live on Unichain). The canonical `AquaSwapVMRouter`
`0x111111338c5091E8440b67B168bAe16a668AC0De` has no DeskBand opcode, so WalletDesk redeploys a modified SwapVM, which
1inch's rules allow. Diff: `docs/SWAPVM_DIFF.md`.

## Chainlink CRE integration

| What | Where |
| --- | --- |
| Workflow: cron → two HTTP sources → DON consensus median → EVM write → read-back | `services/cre/desk-guard/main.ts` |
| Consumer: `IReceiver.onReport`, ERC165 `0x805f2132`, replay-safe ordering | `contracts/src/DeskPriceFeed.sol:66`, `:96` |
| Hook reads the reference; missing or stale fails closed | `contracts/src/OverflowHook.sol:461` |
| Tests: deviation skip, fresh fill, stale skip, forwarder auth, clock drift | `contracts/test/Overflow.t.sol` (`test_creReferenceGuard`, `test_feedRejectsStrangersAndRollbacks`, `test_feedUsesWriteTimeForFreshness`) |

CRE supports Unichain Sepolia, not Unichain mainnet. Simulation steps and forwarder addresses: `docs/CRE.md`.

## Demo

One command, from the repo root. It forks Unichain mainnet, deploys the desk, ships a maker, runs two overflow
swaps (WalletDesk's router and Uniswap's stock router), credits a USDC rebate, starts the keeper and serves the UI.
It refuses any RPC that is not loopback and does not print private keys.

```bash
./script/demo.sh
```

Then open http://127.0.0.1:43127/live. Keeper: http://127.0.0.1:8787/health (also `/fills`, `/skips`,
`/reference`). Beat-by-beat script: `docs/WALKTHROUGH.md`.

To click Approve, Ship, Run overflow, or Claim, use the **Demo maker** / **Demo taker** buttons in the header. On the
fork they connect Anvil's unlocked dev accounts through the RPC, so no key reaches the browser. A browser wallet
works too. These are Foundry's public development accounts; never use them on a public network.

## Deploy

All scripts are env-driven and broadcast only when you add `--broadcast`. See `contracts/.env.example`.

```bash
# Unichain mainnet, live PoolManager + live Aqua, mock-token demo pool
CONFIRM_MAINNET=true forge script script/DeployUnichainMainnet.s.sol --rpc-url "$UNICHAIN_RPC" --slow
# Then make it do real work with the same key: reference price, ship, register, two overflow swaps
# (OverflowRouter and Uniswap's PoolSwapTest). The reference is the keeper's public-API median.
REFERENCE_PRICE_X18=$(cd ../services/keeper && node --input-type=module -e \
  "import {fetchReference,toPriceX18} from './reference.mjs'; console.log(toPriceX18((await fetchReference()).price).toString())")
DEPLOYMENTS=./deployments/unichain.json REFERENCE_PRICE_X18=$REFERENCE_PRICE_X18 \
  forge script script/SeedLive.s.sol --rpc-url "$UNICHAIN_RPC" --slow
```

```bash
# Unichain Sepolia: Aqua is not deployed there, so deploy the unmodified registry too.
# Writes deployments/sepolia.json. Seed it with SeedLive (DEPLOYMENTS=./deployments/sepolia.json), then hand the
# feed to the CRE simulation forwarder: setForwarder(0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1).
DEPLOY_AQUA=true forge script script/DeployUnichainSepolia.s.sol --rpc-url "$UNICHAIN_SEPOLIA_RPC" --slow
```

```bash
# Optional USDC rebates: CCTP bridge on Unichain Sepolia, treasury on Arc testnet
forge script script/DeployCctpBridge.s.sol --rpc-url "$UNICHAIN_SEPOLIA_RPC" --slow
forge script script/DeployArcTreasury.s.sol --rpc-url "$ARC_RPC" --with-gas-price 20000000000
```

Web against a real deployment: set `NEXT_PUBLIC_NETWORK=unichain` (or `sepolia`) and the addresses in
`apps/web/.env.local`. See `apps/web/.env.example`.

## USDC rebates (optional)

The maker's spread on each fill stays in the maker wallet as the output token. Separately, `FeeShareTreasury` runs a
protocol-funded USDC rebate per attested fill, with an optional protocol split (`setSplit`). `CctpFeeBridge` moves
USDC from Unichain Sepolia to Arc (domain 26) with Circle CCTP V2. The local fork cannot get an Iris attestation, so
the demo credits the treasury directly and labels that path `attestor`. Details: `docs/CCTP.md`, `arc/README.md`.

## Layout

```
contracts/          Foundry project: hook, modified SwapVM, price feed, treasury, tests, scripts
services/cre/       Chainlink CRE desk-guard workflow (TypeScript SDK)
services/keeper/    Fill/skip indexer, local reference stand-in, fork rebates
apps/web/           Next.js maker app
arc/                FeeShareTreasury source for Arc Studio (optional track)
docs/               Architecture, design spec, threat model, prompts, SwapVM diff, CRE, CCTP, walkthrough
```

`contracts/lib` vendors the upstream trees at the versions the tests compile against: SwapVM `v1.0.2`, solidity-utils
`6.9.7`, Aqua, OpenZeppelin uniswap-hooks (with v4-core / v4-periphery), forge-std. Commit `7c60d3f` is that vendoring
and contains no WalletDesk code.

## Known limitations

- One residual goes to one desk; no splitting across desks. The pool leg is a fixed cap, not sized by price impact.
- Exact-output swaps and native-ETH pools skip desks (the pool fills).
- Someone holding real inventory can occupy desk slots with off-market quotes that the guard skips. It costs them
  capital lockup, not funds. See `docs/THREAT_MODEL.md`.
- The pool-spot check alone can be pushed within one transaction; the CRE reference is what closes that, so run the
  hook with a feed in production.
- Aqua v1 targets EOA makers. Tests use EOA-style makers. Not audited.

## AI disclosure

AI tools wrote most of this code under the team's direction. File-level attribution: `AI.md`. Prompts and the spec:
`docs/prompts/`, `docs/spec/DESIGN.md`.

## License

WalletDesk source is MIT, except `contracts/src/swapvm/`, which modifies SwapVM and is licensed
`LicenseRef-Degensoft-SwapVM-1.1` (text in `contracts/src/swapvm/LICENSE-SwapVM-1.1.txt`). Upstream packages under
`contracts/lib` keep their own licenses, including the Degensoft SwapVM and Aqua notices.
