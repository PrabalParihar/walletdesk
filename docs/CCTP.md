# USDC rebates, Unichain to Arc

What this is: the maker's spread on each fill already stays in the maker wallet as the output token. USDC here is a
separate, protocol-funded rebate program: the treasury owner deposits USDC, an attestor credits a rebate per fill
id, and makers claim it. CCTP V2 is how that USDC can move from Unichain to Arc. It is not the maker's trading fee
being moved.

Circle CCTP V2 lists both Unichain and Arc, and it lists their testnets when the mainnet is listed.

Sources checked 5 Nov 2026:

- Supported domains: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
  Unichain is domain 10. Arc is domain 26. Both are standard-transfer sources. Unichain is also a fast-transfer source. Arc fast transfer is marked N/A.
- Contract addresses: https://developers.circle.com/cctp/references/contract-addresses
- Arc EVM differences (6-decimal ERC-20 vs 18-decimal native USDC, 20 gwei floor): https://docs.arc.io/arc/references/evm-differences
- Aqua supported chains do not include Arc: https://business.1inch.com/portal/documentation/aqua/liquidity-layer/supported-chains

## What is on chain

| Chain | Piece | Address | Check on 5 Nov 2026 |
| --- | --- | --- | --- |
| Unichain Sepolia | TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | proxy, code size 2175. `localMessageTransmitter()` returns the transmitter below. Implementation contains `depositForBurn` `0x8e0250ee` and `depositForBurnWithHook` `0x779b432d`. |
| Unichain Sepolia | MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | code size 2175 |
| Unichain Sepolia | Circle USDC | `0x31d0220469e10c4E71834a79b1f276d740d3768F` | symbol USDC, 6 decimals. `TokenMinterV2.burnLimitsPerMessage` returned `10000000000000`. |
| Unichain Sepolia | cctp-go USDC | `0x5fd84259d66Cd46123540766Be93DFE6D43130D7` | no code on `https://sepolia.unichain.org`. Do not use it. |
| Arc testnet | TokenMessengerV2 | same `0x8FE6…2DAA` | code size 2175 |
| Arc testnet | MessageTransmitterV2 | same `0xE737…0C0A` | code size 2175 |
| Arc testnet | USDC ERC-20 | `0x3600000000000000000000000000000000000000` | symbol USDC, 6 decimals. Burn limit `10000000000000` on the testnet minter. |
| Unichain mainnet | TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | code size 2175. `localMinter()` is `0xfd78EE919681417d192449715b2594ab58f5D002`. |
| Unichain mainnet | USDC | `0x078D782b760474a361dDA0AF3839290b0EF57AD6` | symbol USDC. Burn limit `10000000000000`. |

`CctpFeeBridge.bridgeFee` pulls 6-decimal USDC and calls `depositForBurnWithHook` with destination domain 26. Hook data is `abi.encode(fillId, maker)`. `maxFee` 0 and finality 0 (the contract substitutes 2000, Circle's standard threshold) are the defaults. The owner can pass 1000 for a fast burn from Unichain.

## Why the local demo still uses the attestor

Iris attests a burn that was included on the real source chain. A transaction that exists only inside `anvil --fork-url https://mainnet.unichain.org` is not on Unichain, so `https://iris-api-sandbox.circle.com` will not sign it. Burning the fork's copy of mainnet USDC would also be a simulation of mainnet CCTP, which uses `https://iris-api.circle.com`, and that service will not see the fork transaction either.

The fork demo therefore deploys `FeeShareTreasury` next to the desk and the keeper calls `creditFromFill`. The USDC amount is the shelf fee scaled from 18 decimals to 6 (`fee / 1e12`). That is a decimal conversion for the mock tokens, not a market price. The UI labels this path `attestor`.

## Real testnet path (you broadcast)

Do not put a key in the repo. From a shell that already has your keys:

```bash
cd contracts
# Unichain Sepolia. Prints the bridge address. Add --broadcast yourself.
# The bridge has its own script: Aqua is not deployed on Unichain Sepolia, and the bridge does not need it.
forge script script/DeployCctpBridge.s.sol --rpc-url "$UNICHAIN_SEPOLIA_RPC" --slow

# Arc testnet. Gas price must be at least 20 gwei or the mempool drops the transaction.
forge script script/DeployArcTreasury.s.sol \
  --rpc-url "$ARC_RPC" \
  --with-gas-price 20000000000
```

Then, with the bridge and treasury addresses filled in, and with testnet USDC on the source key:

```bash
SOURCE_RPC=https://sepolia.unichain.org \
ARC_RPC=https://rpc.testnet.arc.io \
SOURCE_PRIVATE_KEY=... \
ARC_PRIVATE_KEY=... \
BRIDGE=0x... \
TREASURY=0x... \
USDC=0x31d0220469e10c4E71834a79b1f276d740d3768F \
FILL_ID=0x... \
MAKER=0x... \
AMOUNT=12000 \
node services/keeper/cctp-settle.mjs
```

The script refuses loopback RPCs. It approves USDC, calls `bridgeFee`, polls `https://iris-api-sandbox.circle.com/v2/messages/10?transactionHash=...`, calls `receiveMessage` on Arc's MessageTransmitterV2, then `creditFromFill` so the maker can claim. Pass an explicit gas limit on Arc. `eth_estimateGas` is unreliable for CCTP writes there (Circle's Arc testnet notes).

`creditFromFill` is still the line that assigns a minted balance to a maker. CCTP mints to the treasury address. It does not know WalletDesk's claim mapping. The burn's hook data and `FeeBurned` event are what the settler uses to make that assignment. That is narrower than an attestor who can credit any id: the settler only runs after Iris has attested that burn.
