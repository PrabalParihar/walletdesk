# WalletDesk

Turn idle tokens in your wallet into a Uniswap market. Fees settle as USDC on Arc.

A maker ships a custom SwapVM strategy on 1inch Aqua. The tokens stay in the wallet. When a Uniswap v4 swap is larger than the pool cap, `OverflowHook` fills the pool leg from the pool and the residual from that wallet in one transaction. Maker fees are credited later as USDC on Arc.

ETHGlobal Mumbai. Partner picks: 1inch Aqua, Uniswap, Arc DeFi.

## What is working

Local Foundry tests (15) and the Unichain mainnet fork tests (5) pass, including a fill that checks real ERC-20 balances:

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

## What is stubbed

- No Arc Studio project URL yet. Paste `arc/FeeShareTreasury.sol` into https://studio.arc.io and deploy it there. The contract is the same file as `contracts/src/FeeShareTreasury.sol`.
- No Unichain Sepolia or Arc broadcast has been sent. Scripts are env-driven and refuse to run without `PRIVATE_KEY`. Nothing in git is a key.
- The web app is a maker shell: it packs the DeskBand program, stores it in the browser, and previews the split with the same integer math. Approve, ship, and claim are not wired to a deployed desk. Connect uses an injected wallet only.
- `UniV4OracleAdapter` quotes the pool spot and is tested for quote/swap agreement. The default program does not call it.
- CCTP from the desk chain onto Arc is not implemented. The attestor calls `creditFromFill`.
- Canonical `AquaSwapVMRouter` `0x111111338c5091E8440b67B168bAe16a668AC0De` is not the router the hook calls. It has no DeskBand opcode. See `docs/SWAPVM_DIFF.md`.

## Uniswap integration

| What | Where |
| --- | --- |
| Permissions: `beforeSwap` and `beforeSwapReturnDelta` | `contracts/src/OverflowHook.sol:133` |
| Cap, no-op, and `WouldRoute` | `contracts/src/OverflowHook.sol:164` |
| Aqua swap, settle, and `BeforeSwapDelta` | `contracts/src/OverflowHook.sol:189` |
| `OverflowRouted` | `contracts/src/OverflowHook.sol:230` |
| Taker entry: prefund, `PoolManager.swap`, take output | `contracts/src/OverflowRouter.sol:43` |
| Pool spot Extruction target | `contracts/src/UniV4OracleAdapter.sol:51` |
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

`contracts/src/FeeShareTreasury.sol:81` credits a fill. `contracts/src/FeeShareTreasury.sol:103` pays the claim. Native 18-decimal value is rejected. `claimableNativeUnits` multiplies the 6-decimal balance by `1e12` for display only.

Deploy, from `contracts/`, after exporting `PRIVATE_KEY` and `ATTESTOR`:

```bash
forge script script/DeployArcTreasury.s.sol \
  --rpc-url "$ARC_RPC" \
  --broadcast \
  --with-gas-price 20000000000
```

## Unichain Sepolia

Two PoolManager addresses have code on chain 1301 and their runtime codehashes differ. hookmate returns `0x00B036B58a818B1BC34d502D3fE730Db729e62AC`. Another docs page has been cited as `0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95`. The script requires `POOL_MANAGER` and does not default.

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

Serves http://127.0.0.1:43127. Screens: landing, ship, live overflow preview, Arc fees, docs.

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
- Sepolia deploy is unsafe until you re-check which PoolManager you want.
- Arc Studio, a claim transaction, and CCTP are still open.
- Aqua v1 is aimed at EOA makers. The tests use an EOA-style `vm.prank` maker.

## License

MIT for WalletDesk source. Upstream packages keep their own licenses, including the Degensoft SwapVM and Aqua notices under `contracts/lib`.
