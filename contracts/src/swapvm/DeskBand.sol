// SPDX-License-Identifier: LicenseRef-Degensoft-SwapVM-1.1
pragma solidity 0.8.30;

/// @custom:license-url https://github.com/1inch/swap-vm/blob/main/LICENSES/SwapVM-1.1.txt
/// @custom:attribution Powered by SwapVM — © Degensoft Ltd 2025
/// @custom:change 2026-11-05 WalletDesk: new SwapVM instruction (DeskBand). 2026-11-06: direction-aware pricing.

import {Context} from "@1inch/swap-vm/src/libs/VM.sol";

import {DeskBandMath} from "./DeskBandMath.sol";
import {DeskBandProgram} from "./DeskBandProgram.sol";

/// @title DeskBand
/// @notice Custom SwapVM instruction. Replaces stock XYCConcentrate on WalletDeskRouter.
/// @dev The function is non-view so it matches SwapVM's internal function-pointer type.
contract DeskBand {
    error DeskBandExactInOnly();

    /// @notice Price `ctx.swap.amountIn` against Aqua balances already loaded into the registers.
    /// @dev token0 is the lower address, as in Uniswap. `tokenIn < tokenOut` means zeroForOne.
    function _deskBandXD(Context memory ctx, bytes calldata args) internal {
        if (!ctx.query.isExactIn) revert DeskBandExactInOnly();
        DeskBandProgram.Params memory p = DeskBandProgram.decodeArgs(args);
        DeskBandMath.Quote memory q = DeskBandMath.quoteExactIn(
            ctx.swap.balanceIn,
            ctx.swap.balanceOut,
            ctx.swap.amountIn,
            ctx.query.tokenIn < ctx.query.tokenOut,
            p.priceLowX18,
            p.priceHighX18,
            p.feeBps,
            p.start,
            p.halfLife,
            block.timestamp
        );
        ctx.swap.amountOut = q.amountOut;
    }
}
