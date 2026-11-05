# SwapVM diff

WalletDesk does not use the canonical `AquaSwapVMRouter` bytecode for pricing. That router, v1.0.2 at `0x111111338c5091E8440b67B168bAe16a668AC0De`, is unmodified and still present on Unichain. It does not contain DeskBand, and the deployed contract cannot grow an opcode in place.

## Unmodified

- `contracts/lib/swap-vm` is `1inch/swap-vm` tag `v1.0.2`. No patches.
- `contracts/lib/aqua` is `1inch/aqua`. No patches. The fork test calls the live registry at `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`.
- `WalletDeskRouter` inherits `SwapVM`. Order hashing, taker trait checks, `Aqua.push` (`SwapVM.sol` line 237) and `Aqua.pull` (`SwapVM.sol` line 286) are the upstream functions.

## Modified

`contracts/src/swapvm/WalletDeskRouter.sol` replaces `_instructions()`. The table has one entry:

| Index | Instruction |
| --- | --- |
| 0 | `DeskBand._deskBandXD` |

Stock `XYCConcentrate`, `XYCSwap`, `Decay`, `Fee`, and `Extruction` are not registered. A program built for the canonical router will not run here, and a DeskBand program will not run on `0x1111…c0de`.

`DeskBand` prices an exact-in swap as an inventory-weighted linear band, then optional hyperbolic time decay, then a fee in basis points. Output inventory share moves the price from `priceLowX18` toward `priceHighX18`. It does not compute virtual reserves or `x * y = k`.

Program layout, consumed by `DeskBandProgram.encode`:

```
[opcode:1 = 0x00][argsLen:1 = 74][priceLowX18:32][priceHighX18:32][feeBps:2][start:4][halfLife:4]
```

`preview` does not walk the VM. It calls the same `DeskBandMath.quoteExactIn` the opcode calls, then `quote` and `swap` are checked against that result in `DeskBand.t.sol`.

`UniV4OracleAdapter` is a separate non-upgradeable Extruction target. It is not in the default program. Its `extruction` body is view, so a static call and a normal call return the same amounts.
