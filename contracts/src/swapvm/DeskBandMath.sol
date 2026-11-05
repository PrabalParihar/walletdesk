// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title DeskBandMath
/// @notice Inventory-weighted linear price inside a band, then time decay, then a fee.
/// @dev This is not XYCConcentrate and not constant product. Price moves in a straight line
///      between `priceLowX18` and `priceHighX18` as the maker's output inventory share changes.
///      A full output shelf quotes near `priceHighX18`. A drained shelf quotes near `priceLowX18`.
///      `priceX18` is raw `tokenOut` per 1e18 raw `tokenIn` (no decimal normalization).
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

    function quoteExactIn(
        uint256 balanceIn,
        uint256 balanceOut,
        uint256 amountIn,
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

        uint256 denom = balanceIn + balanceOut;
        uint256 weight = Math.mulDiv(balanceOut, PRICE_SCALE, denom);
        q.priceX18 = priceLowX18 + Math.mulDiv(priceHighX18 - priceLowX18, weight, PRICE_SCALE);

        uint256 gross = Math.mulDiv(amountIn, q.priceX18, PRICE_SCALE);
        if (halfLife != 0 && timestamp > start) {
            uint256 elapsed = timestamp - start;
            gross = Math.mulDiv(gross, halfLife, uint256(halfLife) + elapsed);
        }

        q.feeOut = Math.mulDiv(gross, feeBps, BPS);
        q.amountOut = gross - q.feeOut;
        if (q.amountOut == 0) revert DeskBandZeroOutput(0);
        if (q.amountOut > balanceOut) revert DeskBandExceedsShelf(q.amountOut, balanceOut);
    }
}
