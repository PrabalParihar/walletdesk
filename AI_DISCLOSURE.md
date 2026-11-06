# AI disclosure

Same list as `AI.md`. ETHGlobal's checklist asks for `AI.md`. This file is the same disclosure under the name requested for the repo.

A Cursor cloud agent (Grok 4.7) wrote the WalletDesk contracts, tests, deploy scripts, web shell, and docs. Upstream libraries under `contracts/lib/` were vendored unmodified: Uniswap v4-core and v4-periphery, OpenZeppelin uniswap-hooks, forge-std, 1inch/aqua, 1inch/swap-vm v1.0.2, and 1inch/solidity-utils 6.9.7.

The custom SwapVM surface is `contracts/src/swapvm/`. `SwapVM.sol` itself was not edited. `WalletDeskRouter` only overrides the opcode table.

The same agent later wired the maker UI to a local Unichain fork, added `CctpFeeBridge`, the keeper, the demo script, and the submission notes. Phase 2 used Claude Code: a review of v1 with proof-of-concept tests, then the v2 fixes (desk registry, any-router
fills, price guards, direction-aware pricing, license headers), the Chainlink CRE workflow, new deploy scripts, the
keeper reference stand-in, web updates and docs. Those commits are authored `Claude <noreply@anthropic.com>`.

Prompts are in `docs/prompts/` and the spec in `docs/spec/DESIGN.md`, as ETHGlobal asks for spec-driven work. The file
list in `AI.md` is the full set for both phases.
