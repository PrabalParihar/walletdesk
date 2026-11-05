// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Context} from "@1inch/swap-vm/src/libs/VM.sol";

import {DeskBandMath} from "./DeskBandMath.sol";
import {DeskBandProgram} from "./DeskBandProgram.sol";

/// @title DeskBand
/// @notice Custom SwapVM instruction. Replaces stock XYCConcentrate on WalletDeskRouter.
/// @dev The function is non-view so it matches SwapVM's internal function-pointer type.
contract DeskBand {
    error DeskBandExactInOnly();

    /// @notice Price `ctx.swap.amountIn` against Aqua balances already loaded into the registers.
    /// @dev Not marked `view`: SwapVM's opcode table is a non-view internal function pointer.
    function _deskBandXD(Context memory ctx, bytes calldata args) internal {
        if (!ctx.query.isExactIn) revert DeskBandExactInOnly();
        DeskBandProgram.Params memory p = DeskBandProgram.decodeArgs(args);
        DeskBandMath.Quote memory q = DeskBandMath.quoteExactIn(
            ctx.swap.balanceIn,
            ctx.swap.balanceOut,
            ctx.swap.amountIn,
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
