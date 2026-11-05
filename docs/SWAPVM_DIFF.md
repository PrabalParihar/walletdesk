# SwapVM diff

WalletDesk does not use the canonical `AquaSwapVMRouter` bytecode for pricing. That router, v1.0.2 at `0x111111338c5091E8440b67B168bAe16a668AC0De`, is unmodified and still present on Unichain. It does not contain DeskBand, and the deployed contract cannot grow an opcode in place.

## Unmodified

- `contracts/lib/swap-vm` is `1inch/swap-vm` tag `v1.0.2`. No patches.
- License: everything in `contracts/src/swapvm/` is a SwapVM modification and is licensed `LicenseRef-Degensoft-SwapVM-1.1` (copy in `contracts/src/swapvm/LICENSE-SwapVM-1.1.txt`), with dated change notes in each file header. Powered by SwapVM — © Degensoft Ltd 2025.
- `contracts/lib/aqua` is `1inch/aqua`. No patches. The fork test calls the live registry at `0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`.
- `WalletDeskRouter` inherits `SwapVM`. Order hashing, taker trait checks, `Aqua.push` (`SwapVM.sol` line 237) and `Aqua.pull` (`SwapVM.sol` line 286) are the upstream functions.

## Modified

`contracts/src/swapvm/WalletDeskRouter.sol` replaces `_instructions()`. The table has one entry:

| Index | Instruction |
| --- | --- |
| 0 | `DeskBand._deskBandXD` |

Stock `XYCConcentrate`, `XYCSwap`, `Decay`, `Fee`, and `Extruction` are not registered. A program built for the canonical router will not run here, and a DeskBand program will not run on `0x1111…c0de`.

`DeskBand` prices an exact-in swap as an inventory-weighted linear band, then optional hyperbolic time decay, then a fee in basis points. It does not compute virtual reserves or `x * y = k`.

- Price unit: raw token1 per 1 raw token0, scaled by 1e18. That is the Uniswap v4 price unit, so decimals are inside the number.
- Direction: token0 is the lower address. `tokenIn < tokenOut` pays `amountIn * price`; the reverse pays `amountIn / price`. (Before 6 Nov 2026 both directions used `amountIn * price`, which only worked for pairs near 1:1.)
- Weight: the value share of token1 on the shelf at the band mid, `bal1 / (bal0 * mid + bal1)`. Price runs from `priceLowX18` (w = 0) to `priceHighX18` (w = 1), so the quote worsens for the taker as the paid-out side drains, in both directions.
- Decay: `gross * halfLife / (halfLife + elapsed)`. Output halves at `elapsed == halfLife` and tends to zero, so it is a soft expiry. The hook's price guard stops filling once the decayed quote leaves the maker's deviation limit.

Program layout, consumed by `DeskBandProgram.encode`:

```
[opcode:1 = 0x00][argsLen:1 = 74][priceLowX18:32][priceHighX18:32][feeBps:2][start:4][halfLife:4]
```

`preview` does not walk the VM. It calls the same `DeskBandMath.quoteExactIn` the opcode calls, then `quote` and `swap` are checked against that result in `DeskBand.t.sol`.

`UniV4OracleAdapter` is a separate non-upgradeable Extruction target. It is not in the default program. `docs/ORACLE.md` explains why a pool spot would ignore the band, the decay, and the fee. Its `extruction` body is view, so a static call and a normal call return the same amounts.
