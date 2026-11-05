# AI disclosure

Same list as `AI.md`. ETHGlobal's checklist asks for `AI.md`. This file is the same disclosure under the name requested for the repo.

A Cursor cloud agent (Grok 4.7) wrote the WalletDesk contracts, tests, deploy scripts, web shell, and docs. Upstream libraries under `contracts/lib/` were vendored unmodified: Uniswap v4-core and v4-periphery, OpenZeppelin uniswap-hooks, forge-std, 1inch/aqua, 1inch/swap-vm v1.0.2, and 1inch/solidity-utils 6.9.7.

The custom SwapVM surface is `contracts/src/swapvm/`. `SwapVM.sol` itself was not edited. `WalletDeskRouter` only overrides the opcode table.
