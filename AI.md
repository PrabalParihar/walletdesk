# AI disclosure

Two AI tools were used, in two phases. Prompts: `docs/prompts/`. Spec: `docs/spec/DESIGN.md`.

**Team contribution (TODO before submitting, in your own words):** what the team decided, wrote, reviewed and ran
yourselves, for example the idea and partner tracks, design choices, the deploys, the CRE simulation and the demo.
ETHGlobal may limit partner-prize eligibility for projects that rely entirely on AI, so state this accurately.

## Phase 1: Cursor cloud agent (v1, commits `4f83189` to `d7c4bfd`)

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

## Phase 2: Claude Code (v2, branch `claude/admiring-galileo-aq0yo0`, from commit `755231b`)

Claude Code reviewed v1 against the prize rules (prompt `docs/prompts/02-claude-review.md`), wrote proof-of-concept
tests for the defects it found, then implemented the fixes and features (prompt `docs/prompts/03-claude-v2.md`).
Commits in this phase are authored `Claude <noreply@anthropic.com>`.

Written or rewritten:

- `contracts/src/OverflowHook.sol` (multi-desk registry, any-router fill, price guards, refund path)
- `contracts/src/DeskPriceFeed.sol` (new, Chainlink CRE consumer)
- `contracts/src/swapvm/DeskBandMath.sol`, `DeskBand.sol`, `WalletDeskRouter.sol` (direction-aware, value-weighted pricing), license headers on all of `contracts/src/swapvm/`
- `contracts/test/Overflow.t.sol`, `contracts/test/DeskBand.t.sol`
- `contracts/script/DeskDeployBase.sol`, `DemoSeed.s.sol`, `DeployUnichainSepolia.s.sol`, `DeployCctpBridge.s.sol`, `DeployUnichainMainnet.s.sol`
- `contracts/remappings.txt`
- `services/cre/**` and `docs/CRE.md` (written by a Claude Code sub-agent, reviewed and adjusted in the main session)
- `services/keeper/index.mjs`, `services/keeper/reference.mjs`, `services/keeper/reference.test.mjs`
- `apps/web/src/app/live/page.tsx`, `desk/page.tsx`, `fees/page.tsx`, `docs/page.tsx`, `page.tsx`, `layout.tsx`, `apps/web/src/lib/*.ts`, `apps/web/src/components/shell.tsx`, `providers.tsx`, `apps/web/.env.example`
- `README.md`, `SUBMISSION.md`, `FEEDBACK.md`, `AI.md`, `AI_DISCLOSURE.md`, `arc/README.md`, `script/demo.sh`, `.github/workflows/ci.yml`
- `docs/spec/DESIGN.md`, `docs/THREAT_MODEL.md`, `docs/prompts/*`, `docs/SWAPVM_DIFF.md`, `docs/ORACLE.md`, `docs/CCTP.md`, `docs/WALKTHROUGH.md`, `docs/architecture.md`

Review the fork test output before treating any balance assertion as a measured production result. No users, volume,
or partners are claimed.
