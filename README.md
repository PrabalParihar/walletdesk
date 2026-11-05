# WalletDesk

Turn idle tokens in your wallet into a Uniswap market. Fees settle as USDC on Arc.

A maker ships a custom SwapVM strategy on 1inch Aqua. The tokens stay in the wallet. When a Uniswap v4 swap is larger than the pool cap, `OverflowHook` fills the pool leg from the pool and the residual from that wallet in one transaction. Maker fees are credited later as USDC on Arc.

ETHGlobal Mumbai. Partner picks: 1inch Aqua, Uniswap, Arc DeFi.

## What is working

Local Foundry tests and the Unichain mainnet fork tests pass, including a fill that checks real ERC-20 balances. The original 15 local tests and 5 fork tests are still there. Newer tests cover the CCTP bridge, a custom price band, and the reason the pool spot is not the desk quote.

- `ship` emits the Aqua bookkeeping events and does not change the maker's token balance.
- `quote` and `swap` on DeskBand return the same output. A worked example with equal shelves and a 0.99 to 1.01 band quotes `3.988` tokens out on `4` tokens in at 30 bps.
- A 5 token exact-input swap with a pool cap of 1 pulls `3.988` of the output token from the maker and pushes `4` of the input token back. The taker receives more than the shelf alone, so the pool filled the other leg.
- Swaps inside the cap do not touch the maker. Callers other than `OverflowRouter` emit `WouldRoute` and do not pull.
- Reentrancy into `beforeSwap` reverts.
- `FeeShareTreasury` deposit, split, claim, and the native-value reject are covered. Arc USDC at `0x3600000000000000000000000000000000000000` was read on testnet: symbol USDC, 6 decimals.

Fork command, from `contracts/`:

```bash
forge test --match-contract OverflowForkTest -vv
```

That forks `https://mainnet.unichain.org` (chain id 130), uses the live PoolManager and the live Aqua registry, deploys WalletDeskRouter and OverflowHook, and asserts the transfers above. Offline:

```bash
forge test --no-match-contract OverflowForkTest
```

## Demo

One command, from the repo root. It forks Unichain mainnet, deploys the desk, ships a maker, runs the overflow swap, credits the local treasury, and serves the UI. It refuses any RPC that is not loopback. It does not print private keys.

```bash
./script/demo.sh
```

Then open http://127.0.0.1:43127/live. The seeded fill is already on the fork. Keeper: http://127.0.0.1:8787/health. The beat-by-beat script is `docs/WALKTHROUGH.md`.

To click Approve, Ship, Run overflow, or Claim, import the Anvil maker and taker printed by the script. Their keys are in the Anvil log the script names. They are Foundry's public development accounts. Do not use them on a public network.

Switch the UI to Unichain Sepolia without a fork:

```bash
# apps/web/.env.local
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_RPC_URL=https://sepolia.unichain.org
```

Fill the contract addresses after you broadcast. See `apps/web/.env.example`.

## What is left for you

- No Arc Studio project URL yet. Paste steps are in `arc/README.md`. The source matches `contracts/src/FeeShareTreasury.sol`.
- No Unichain Sepolia or Arc broadcast has been sent. Scripts are env-driven. Add `--broadcast` yourself. Nothing in git is a key.
- `UniV4OracleAdapter` is not in the default program. `docs/ORACLE.md` says why. A test locks the quote difference.
- CCTP V2 from Unichain Sepolia to Arc testnet is implemented in `CctpFeeBridge` and `services/keeper/cctp-settle.mjs`. The local fork still uses `creditFromFill`, because Iris does not attest anvil state. See `docs/CCTP.md`.
- Canonical `AquaSwapVMRouter` `0x111111338c5091E8440b67B168bAe16a668AC0De` is not the router the hook calls. It has no DeskBand opcode. See `docs/SWAPVM_DIFF.md`.

## Uniswap integration

| What | Where |
| --- | --- |
| Permissions: `beforeSwap` and `beforeSwapReturnDelta` | `contracts/src/OverflowHook.sol:137` |
| Cap, no-op, and `WouldRoute` | `contracts/src/OverflowHook.sol:179` |
| Aqua swap, settle, and `BeforeSwapDelta` | `contracts/src/OverflowHook.sol:193` |
| `OverflowRouted` | `contracts/src/OverflowHook.sol:234` |
| Taker entry: prefund, `PoolManager.swap`, take output | `contracts/src/OverflowRouter.sol:43` |
| Pool spot Extruction target (not the default quote) | `contracts/src/UniV4OracleAdapter.sol:52` |
| Fork test against PoolManager `0x1F98400000000000000000000000000000000004` | `contracts/test/Overflow.t.sol` (`OverflowForkTest`) |

The hook follows `BaseHook` from OpenZeppelin `uniswap-hooks`, which is the current v4-template pattern.

## Aqua integration

| What | Where |
| --- | --- |
| DeskBand opcode (not XYCConcentrate) | `contracts/src/swapvm/DeskBand.sol:17` |
| Opcode table on the modified router | `contracts/src/swapvm/WalletDeskRouter.sol:52` |
| Preview uses the same math as the opcode | `contracts/src/swapvm/WalletDeskRouter.sol:28` |
| Program bytes | `contracts/src/swapvm/DeskBandProgram.sol` |
| Unmodified `Aqua.push` | `contracts/lib/swap-vm/src/SwapVM.sol:237` |
| Unmodified `Aqua.pull` | `contracts/lib/swap-vm/src/SwapVM.sol:286` |
| Ship does not move the wallet | `contracts/test/DeskBand.t.sol` |

Registry used on the fork: `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`. Checked with `cast codesize` on Unichain mainnet, 5 Nov 2026. KycNFT `0x26FFc7D378E8e49Be2c483295A3e3E511F96a468` has code on the same chain. The hook does not call it.

## Arc

`contracts/src/FeeShareTreasury.sol:84` credits a fill. `contracts/src/FeeShareTreasury.sol:106` pays the claim. Native 18-decimal value is rejected. `claimableNativeUnits` multiplies the 6-decimal balance by `1e12` for display only. `contracts/src/CctpFeeBridge.sol` burns USDC toward Arc domain 26. The fork demo does not call it.

Deploy, from `contracts/`, after exporting `PRIVATE_KEY` and `ATTESTOR`:

```bash
forge script script/DeployArcTreasury.s.sol \
  --rpc-url "$ARC_RPC" \
  --broadcast \
  --with-gas-price 20000000000
```

## Unichain Sepolia

The canonical PoolManager is `0x00B036B58a818B1BC34d502D3fE730Db729e62AC`. That is the only PoolManager on the Uniswap v4 deployments page and on the Unichain contract-address page (checked 5 Nov 2026). The same address is what hookmate returns. On `https://sepolia.unichain.org` it has code size 24009 and runtime codehash `0x7c5e10e0bd8580e13b48751e4cd7db6315577488d0f76b20bc6c8bcbe2646dc0`. `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95` also has code, size 24009, and a different codehash `0x2566e42d45723eef05d7253a7b7c140a6da61992594525fc66d06b4a973b5d0b`. It is not on the deployments page. The script defaults to the canonical address. Set `POOL_MANAGER` only if you mean the other one. The Sepolia explorer HTML sits behind a bot check, so the check above is the RPC code read plus the docs pages.

```bash
forge script script/DeployUnichainSepolia.s.sol \
  --rpc-url "$UNICHAIN_SEPOLIA_RPC" \
  --broadcast \
  --slow
```

See `contracts/.env.example`. The demo path is the mainnet fork, not Sepolia.

## Web

```bash
cd apps/web
npm install
npm run dev
```

`./script/demo.sh` starts this for you on http://127.0.0.1:43127. Screens: landing, ship (approve and ship), live fill, Arc fees (claim), docs. The keeper in `services/keeper` indexes `FeeAccrued` and Aqua `Pulled` / `Pushed`, and on a loopback RPC it credits the local treasury.

## Layout

```
contracts/     Foundry project. v4 hook, modified SwapVM, treasury, tests, scripts.
arc/           FeeShareTreasury source for Arc Studio.
apps/web/      Next.js maker shell.
docs/          Architecture diagram and the SwapVM diff.
```

`contracts/lib` vendors the upstream trees at the versions the tests compile against. SwapVM is tag `v1.0.2`. solidity-utils is tag `6.9.7`.

## Risks

- The hook only pulls a maker when `msg.sender` of `PoolManager.swap` is the configured `OverflowRouter`. A generic swap router will not prefund the residual, so the hook refuses it.
- DeskBand programs are not portable to the canonical Aqua router, and canonical programs are not portable here.
- Fork tests need a public Unichain RPC. If it is down, run the offline command above.
- Sepolia deploy uses the canonical PoolManager above. Override `POOL_MANAGER` if you have a reason to use the other contract.
- Arc Studio URL, a broadcast claim transaction, and an Iris-attested CCTP mint still need your key. The contracts and the settler script are in the repo. `docs/CCTP.md` says why the fork cannot finish CCTP.
- Aqua v1 is aimed at EOA makers. The tests use an EOA-style `vm.prank` maker.

## License

MIT for WalletDesk source. Upstream packages keep their own licenses, including the Degensoft SwapVM and Aqua notices under `contracts/lib`.
