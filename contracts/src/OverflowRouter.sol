// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title OverflowRouter
/// @notice Taker entrypoint. Pulls the full input, settles it into the PoolManager before the swap,
///         and lets OverflowHook `take` the residual for the Aqua leg.
contract OverflowRouter is IUnlockCallback {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    using TransientStateLibrary for IPoolManager;

    error OnlyPoolManager();
    error NativeNotSupported();
    error AmountTooLarge();
    error Slippage(uint256 amountOut, uint256 amountOutMin);
    error InputDust(int256 delta);

    IPoolManager public immutable manager;

    struct CallbackData {
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        address recipient;
    }

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function swapExactInput(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external returns (uint256 amountOut) {
        if (amountIn > uint256(type(int256).max)) revert AmountTooLarge();
        Currency input = zeroForOne ? key.currency0 : key.currency1;
        if (input.isAddressZero()) revert NativeNotSupported();

        IERC20(Currency.unwrap(input)).safeTransferFrom(msg.sender, address(this), amountIn);
        bytes memory result = manager.unlock(abi.encode(CallbackData(key, zeroForOne, amountIn, recipient)));
        amountOut = abi.decode(result, (uint256));
        if (amountOut < amountOutMin) revert Slippage(amountOut, amountOutMin);
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(manager)) revert OnlyPoolManager();
        CallbackData memory data = abi.decode(raw, (CallbackData));

        Currency input = data.zeroForOne ? data.key.currency0 : data.key.currency1;
        Currency output = data.zeroForOne ? data.key.currency1 : data.key.currency0;

        manager.sync(input);
        IERC20(Currency.unwrap(input)).safeTransfer(address(manager), data.amountIn);
        manager.settle();

        manager.swap(
            data.key,
            SwapParams({
                zeroForOne: data.zeroForOne,
                amountSpecified: -int256(data.amountIn),
                sqrtPriceLimitX96: data.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int256 inDelta = manager.currencyDelta(address(this), input);
        if (inDelta != 0) revert InputDust(inDelta);

        int256 outDelta = manager.currencyDelta(address(this), output);
        uint256 amountOut = outDelta > 0 ? uint256(outDelta) : 0;
        if (amountOut > 0) manager.take(output, data.recipient, amountOut);
        return abi.encode(amountOut);
    }
}
