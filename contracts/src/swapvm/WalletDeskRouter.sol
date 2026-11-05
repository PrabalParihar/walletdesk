// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SwapVM} from "@1inch/swap-vm/src/SwapVM.sol";
import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {Context} from "@1inch/swap-vm/src/libs/VM.sol";
import {MakerTraits, MakerTraitsLib} from "@1inch/swap-vm/src/libs/MakerTraits.sol";

import {DeskBand} from "./DeskBand.sol";
import {DeskBandMath} from "./DeskBandMath.sol";
import {DeskBandProgram} from "./DeskBandProgram.sol";

/// @title WalletDeskRouter
/// @notice Modified SwapVM router. The base `SwapVM` (1inch/swap-vm v1.0.2) is unmodified and still
///         performs Aqua `pull` / `push`, order hashing, and taker validation. The opcode table is not
///         the stock Aqua set: index 0 is DeskBand, and XYCConcentrate is not registered.
/// @dev See docs/SWAPVM_DIFF.md. Redeployed because the canonical AquaSwapVMRouter at
///      0x111111338c5091E8440b67B168bAe16a668AC0De cannot grow a new opcode in place.
contract WalletDeskRouter is SwapVM, DeskBand {
    using MakerTraitsLib for MakerTraits;

    constructor(address aqua, address weth, address owner)
        SwapVM(aqua, weth, owner, "WalletDesk SwapVM", "1")
    {}

    /// @notice Same amounts `swap` will produce for an Aqua order, plus the fee kept on the shelf.
    /// @dev Does not run the VM. It calls the same `DeskBandMath` the opcode calls, so quote and swap match.
    function preview(ISwapVM.Order calldata order, address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 feeOut)
    {
        if (!order.traits.useAquaInsteadOfSignature()) revert DeskBandExactInOnly();
        bytes32 orderHash = keccak256(abi.encode(order));
        (uint256 balanceIn, uint256 balanceOut) =
            AQUA.safeBalances(order.maker, address(this), orderHash, tokenIn, tokenOut);
        DeskBandProgram.Params memory p = DeskBandProgram.decodeProgram(order.traits.program(order.data));
        DeskBandMath.Quote memory q = DeskBandMath.quoteExactIn(
            balanceIn,
            balanceOut,
            amountIn,
            p.priceLowX18,
            p.priceHighX18,
            p.feeBps,
            p.start,
            p.halfLife,
            block.timestamp
        );
        return (q.amountOut, q.feeOut);
    }

    function _instructions()
        internal
        pure
        override
        returns (function(Context memory, bytes calldata) internal[] memory result)
    {
        result = new function(Context memory, bytes calldata) internal[](1);
        result[0] = _deskBandXD;
    }

    function instructionCount() external pure returns (uint256) {
        return _instructions().length;
    }
}
