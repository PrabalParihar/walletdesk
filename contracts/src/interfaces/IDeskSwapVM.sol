// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26 <0.8.31;

/// @notice ABI twin of `ISwapVM.Order`. `traits` is the MakerTraits word.
/// @dev Kept free of the 0.8.30 SwapVM sources so the 0.8.26 hook can call the router.
struct DeskOrder {
    address maker;
    uint256 traits;
    bytes data;
}

interface IDeskSwapVM {
    function preview(DeskOrder calldata order, address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut, uint256 feeOut);

    function swap(
        DeskOrder calldata order,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        bytes calldata takerData
    ) external returns (uint256 amountIn, uint256 amountOut, bytes32 orderHash);
}
