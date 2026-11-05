# Arc treasury

Paste `FeeShareTreasury.sol` into an Arc Studio project and deploy it on Arc testnet. This file matches `contracts/src/FeeShareTreasury.sol`. There is no Studio URL in the repo. You create the project. Do not invent one.

Studio docs: https://docs.arc.io/ai/arc-studio
EVM differences this contract is written for: https://docs.arc.io/arc/references/evm-differences

## Paste steps

1. Open https://studio.arc.io and sign in.
2. Start a project. Choose Smart Contract mode if the picker offers it. Build mode is fine if it does not.
3. Paste this prompt, then attach or paste the full source of `arc/FeeShareTreasury.sol` into the file workbench in place of any generated contract:

```text
Deploy FeeShareTreasury on Arc testnet. Use the Solidity file I paste, unchanged. Do not rewrite it and do not add a proxy.
Constructor arguments:
- usdc: 0x3600000000000000000000000000000000000000
- attestor: my wallet, until I replace it
- owner: my wallet
The contract accounts only in the 6-decimal ERC-20 USDC interface. Do not send native value. receive and fallback revert on purpose.
Flows to show in the preview: connect a wallet, read claimable(address), call claim(), show the Claimed event.
Set maxFeePerGas to at least 20 gwei. Arc drops anything lower and there is no receipt.
Do not deploy until I approve. After I approve, give me the shareable Studio URL and the deployed address.
```

4. In the workbench, confirm the contract source is the pasted file and not a rewritten one. The functions must be `deposit`, `creditFromFill`, `claim`, and `setSplit`.
5. Approve the deploy inside Studio. Copy the shareable project URL into the root README where it says the Studio URL is not created yet.
6. Fund claims with `deposit(uint256)` of 6-decimal USDC, or with a CCTP mint to the treasury followed by `creditFromFill`. Do not transfer native USDC to the contract.
7. From the Studio preview, or from the WalletDesk fees page with `NEXT_PUBLIC_NETWORK=sepolia` and `NEXT_PUBLIC_ARC_TREASURY` set, connect and call `claim()`.

## Foundry deploy, if you are not using Studio for the bytecode

```bash
cd contracts
forge script script/DeployArcTreasury.s.sol \
  --rpc-url "$ARC_RPC" \
  --with-gas-price 20000000000
```

Add `--broadcast` only when `PRIVATE_KEY` and `ATTESTOR` are set in your shell. The script checks chain id 5042002, requires 6-decimal USDC, and checks that CCTP `MessageTransmitterV2` has code. It does not send the broadcast by itself.

`PRIVATE_KEY`, `ATTESTOR`, and optional `ARC_USDC` / `OWNER` / `CCTP_MESSAGE_TRANSMITTER` come from the environment. See `contracts/.env.example`. Do not commit them.

Aqua is not on Arc. Do not point this treasury at the Aqua registry.

## Behavior the contract assumes

- Gas is USDC. `maxFeePerGas` below 20 gwei is dropped with no receipt.
- The native balance uses 18 decimals. The ERC-20 interface at `0x3600000000000000000000000000000000000000` uses 6 decimals. One native unit is `1e12` ERC-20 units.
- `deposit`, `creditFromFill`, and `claim` use only the 6-decimal interface.
- `receive` and `fallback` revert.
- `address(0)` is rejected. Arc also reverts native transfers there.
- `PREVRANDAO` is unused. It is always 0 on Arc.
- Claims do not depend on `block.timestamp` increasing.
