// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:attribution Powered by SwapVM — © Degensoft Ltd 2025
/// @custom:change 2026-11-06 WalletDesk: DeskBand pricing math executed by a modified SwapVM instruction set.

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title DeskBandMath
/// @notice Inventory-weighted linear price inside a band, then time decay, then a fee.
/// @dev Price unit: `priceX18` is raw token1 per 1 raw token0, scaled by 1e18. This is the same unit as a
///      Uniswap v4 pool price (`sqrtPriceX96^2 / 2^192`), so token decimals are already inside the number
///      and a WETH/USDC desk prices both directions correctly.
///
///      token0 / token1 follow Uniswap ordering (lower address is token0). A swap with `tokenIn < tokenOut`
///      is zeroForOne and pays `amountIn * price`. The reverse direction pays `amountIn / price`.
///
///      Inventory weight is the value share of token1 on the maker's Aqua shelf, valued at the band mid:
///      `w1 = bal1 / (bal0 * mid + bal1)`. Price moves from `priceLow` (w1 = 0) to `priceHigh` (w1 = 1).
///      - Lots of token1 on the shelf: price near `priceHigh`, so selling token0 into it pays more token1.
///      - Lots of token0 on the shelf: price near `priceLow`, so selling token1 into it pays more token0.
///      Either way the quote worsens for the taker as the side being paid out drains.
///
///      Decay is hyperbolic: `gross * halfLife / (halfLife + elapsed)`. Output halves at
///      `elapsed == halfLife` and tends to zero, so a set half life acts as a soft expiry. The hook's
///      price guard stops filling once the decayed quote drifts outside the maker's deviation limit.
library DeskBandMath {
    error DeskBandBadPrices(uint256 priceLowX18, uint256 priceHighX18);
    error DeskBandFeeTooHigh(uint16 feeBps);
    error DeskBandEmptyShelf(uint256 balanceOut);
    error DeskBandZeroOutput(uint256 amountOut);
    error DeskBandExceedsShelf(uint256 amountOut, uint256 balanceOut);

    uint256 internal constant PRICE_SCALE = 1e18;
    uint256 internal constant BPS = 10_000;

    struct Quote {
        uint256 amountOut;
        uint256 feeOut;
        uint256 priceX18;
    }

    /// @param zeroForOne True when `tokenIn` is token0 (the lower address).
    function quoteExactIn(
        uint256 balanceIn,
        uint256 balanceOut,
        uint256 amountIn,
        bool zeroForOne,
        uint256 priceLowX18,
        uint256 priceHighX18,
        uint16 feeBps,
        uint32 start,
        uint32 halfLife,
        uint256 timestamp
    ) internal pure returns (Quote memory q) {
        if (priceLowX18 == 0 || priceLowX18 > priceHighX18) revert DeskBandBadPrices(priceLowX18, priceHighX18);
        if (feeBps > BPS) revert DeskBandFeeTooHigh(feeBps);
        if (balanceOut == 0) revert DeskBandEmptyShelf(balanceOut);
        if (amountIn == 0) revert DeskBandZeroOutput(0);

        q.priceX18 = bandPrice(
            zeroForOne ? balanceIn : balanceOut, zeroForOne ? balanceOut : balanceIn, priceLowX18, priceHighX18
        );

        uint256 gross = zeroForOne
            ? Math.mulDiv(amountIn, q.priceX18, PRICE_SCALE)
            : Math.mulDiv(amountIn, PRICE_SCALE, q.priceX18);
        if (halfLife != 0 && timestamp > start) {
            uint256 elapsed = timestamp - start;
            gross = Math.mulDiv(gross, halfLife, uint256(halfLife) + elapsed);
        }

        q.feeOut = Math.mulDiv(gross, feeBps, BPS);
        q.amountOut = gross - q.feeOut;
        if (q.amountOut == 0) revert DeskBandZeroOutput(0);
        if (q.amountOut > balanceOut) revert DeskBandExceedsShelf(q.amountOut, balanceOut);
    }

    /// @notice Band price for a shelf holding `balance0` of token0 and `balance1` of token1.
    function bandPrice(uint256 balance0, uint256 balance1, uint256 priceLowX18, uint256 priceHighX18)
        internal
        pure
        returns (uint256)
    {
        uint256 mid = priceLowX18 + (priceHighX18 - priceLowX18) / 2;
        uint256 value0 = Math.mulDiv(balance0, mid, PRICE_SCALE);
        uint256 total = value0 + balance1;
        if (total == 0) revert DeskBandEmptyShelf(0);
        uint256 weight1 = Math.mulDiv(balance1, PRICE_SCALE, total);
        return priceLowX18 + Math.mulDiv(priceHighX18 - priceLowX18, weight1, PRICE_SCALE);
    }
}
