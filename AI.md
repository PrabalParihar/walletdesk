# AI disclosure

A Cursor cloud agent (Grok 4.7) wrote or edited the files below. Uniswap v4-core, v4-periphery, OpenZeppelin uniswap-hooks, forge-std, 1inch aqua, 1inch swap-vm, and 1inch solidity-utils under `contracts/lib/` are upstream. They were vendored, not authored here.

## Contracts and tests

- `contracts/src/CctpFeeBridge.sol`
- `contracts/src/OverflowHook.sol`
- `contracts/src/OverflowRouter.sol`
- `contracts/src/UniV4OracleAdapter.sol`
- `contracts/src/FeeShareTreasury.sol`
- `contracts/src/Addresses.sol`
- `contracts/src/interfaces/IDeskSwapVM.sol`
- `contracts/src/swapvm/DeskBand.sol`
- `contracts/src/swapvm/DeskBandMath.sol`
- `contracts/src/swapvm/DeskBandProgram.sol`
- `contracts/src/swapvm/WalletDeskRouter.sol`
- `contracts/src/swapvm/OrderBuilder.sol`
- `contracts/test/CctpFeeBridge.t.sol`
- `contracts/test/DeskBand.t.sol`
- `contracts/test/Overflow.t.sol`
- `contracts/test/FeeShareTreasury.t.sol`
- `contracts/script/DemoSeed.s.sol`
- `contracts/script/DeployUnichainSepolia.s.sol`
- `contracts/script/DeployArcTreasury.s.sol`
- `contracts/foundry.toml`
- `contracts/remappings.txt`
- `contracts/.env.example`
- `arc/FeeShareTreasury.sol`
- `arc/README.md`

## Web

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css` (brand tokens on top of the shadcn scaffold)
- `apps/web/src/app/desk/page.tsx`
- `apps/web/src/app/live/page.tsx`
- `apps/web/src/app/fees/page.tsx`
- `apps/web/src/app/docs/page.tsx`
- `apps/web/src/components/shell.tsx`
- `apps/web/src/components/providers.tsx`
- `apps/web/src/lib/desk.ts`
- `apps/web/src/lib/chains.ts`
- `apps/web/src/lib/contracts.ts`
- `apps/web/src/lib/use-deployment.ts`
- `apps/web/src/components/notice.tsx`
- `apps/web/eslint.config.mjs`

`apps/web/src/components/ui/*` and `apps/web/src/lib/utils.ts` come from the shadcn CLI.

## Docs

- `README.md`
- `FEEDBACK.md`
- `AI.md`
- `AI_DISCLOSURE.md`
- `docs/architecture.md`
- `docs/architecture.svg`
- `docs/SWAPVM_DIFF.md`
- `docs/ORACLE.md`
- `docs/CCTP.md`
- `docs/WALKTHROUGH.md`
- `SUBMISSION.md`
- `script/demo.sh`
- `services/keeper/index.mjs`
- `services/keeper/cctp-settle.mjs`
- `services/keeper/scale.mjs`
- `.github/workflows/ci.yml`
- `LICENSE`

Review the fork test output before treating any balance assertion as a measured production result. No users, volume, or partners are claimed.
