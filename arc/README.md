# Arc treasury

`FeeShareTreasury.sol` is the contract to paste into an Arc Studio project and deploy on Arc testnet.

There is no Studio URL in this repo yet. Create the project at https://studio.arc.io, paste this file, and record the shareable Studio URL plus the deployed address in the root README.

## Arc behavior this contract assumes

- Gas is USDC. Set `maxFeePerGas` to at least 20 gwei or the mempool drops the transaction with no receipt.
- The native balance uses 18 decimals. The ERC-20 interface at `0x3600000000000000000000000000000000000000` uses 6 decimals. One native unit is `1e12` ERC-20 units.
- `deposit`, `creditFromFill`, and `claim` use only the 6-decimal ERC-20 interface.
- `receive` and `fallback` revert. Do not send native value.
- Do not use `address(0)` as a recipient. Arc reverts native transfers there, and this contract rejects it in storage too.
- `PREVRANDAO` is unused. It is always 0 on Arc.
- Claims do not depend on `block.timestamp` increasing.

## Deploy

```bash
cp arc/FeeShareTreasury.sol contracts/src/FeeShareTreasury.sol   # already the same file
cd contracts
forge script script/DeployArcTreasury.s.sol \
  --rpc-url "$ARC_RPC" \
  --broadcast \
  --with-gas-price 20000000000
```

`PRIVATE_KEY`, `ATTESTOR`, and optional `ARC_USDC` / `OWNER` come from the environment. See `contracts/.env.example`. Do not commit them.

Aqua is not on Arc. Do not point this treasury at the Aqua registry.
