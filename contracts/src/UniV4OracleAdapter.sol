// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev ABI twins of SwapVM's SwapQuery and SwapRegisters. Field order is the external ABI.
struct OracleQuery {
    bytes32 orderHash;
    address maker;
    address taker;
    address tokenIn;
    address tokenOut;
    bool isExactIn;
}

struct OracleRegisters {
    uint256 balanceIn;
    uint256 balanceOut;
    uint256 amountIn;
    uint256 amountOut;
    uint256 amountNetPulled;
}

/// @title UniV4OracleAdapter
/// @notice Non-upgradeable Extruction target. Spot-prices a swap from the v4 pool's sqrtPriceX96.
/// @dev `extruction` does not write storage, so a static `quote` and a state-changing `swap` that
///      both call it return the same amounts. It is not part of the default DeskBand program.
///      See docs/ORACLE.md. The adapter overwrites `amountOut` with the pool spot and would ignore
///      the maker's band, decay, and fee. WalletDeskRouter does not register an Extruction opcode.
contract UniV4OracleAdapter {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using CurrencyLibrary for Currency;

    error PairMismatch();
    error ZeroPrice();

    IPoolManager public immutable manager;
    PoolKey public key;

    constructor(IPoolManager manager_, PoolKey memory key_) {
        manager = manager_;
        key = key_;
    }

    /// @notice Extruction entry. The body is view, so a static quote and a swap call return the same amounts.
    function extruction(
        bool,
        uint256 nextPC,
        OracleQuery calldata query,
        OracleRegisters calldata swap,
        bytes calldata,
        bytes calldata
    ) external view returns (uint256 updatedNextPC, uint256 choppedLength, OracleRegisters memory updatedSwap) {
        updatedNextPC = nextPC;
        choppedLength = 0;
        updatedSwap = swap;

        (address token0, address token1) = (Currency.unwrap(key.currency0), Currency.unwrap(key.currency1));
        bool zeroForOne = query.tokenIn == token0 && query.tokenOut == token1;
        bool oneForZero = query.tokenIn == token1 && query.tokenOut == token0;
        if (!zeroForOne && !oneForZero) revert PairMismatch();

        (uint160 sqrtPriceX96,,,) = manager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) revert ZeroPrice();

        if (query.isExactIn) {
            updatedSwap.amountOut = zeroForOne
                ? _mulPrice(swap.amountIn, sqrtPriceX96)
                : _divPrice(swap.amountIn, sqrtPriceX96);
        } else {
            updatedSwap.amountIn = zeroForOne
                ? _divPrice(swap.amountOut, sqrtPriceX96)
                : _mulPrice(swap.amountOut, sqrtPriceX96);
        }
    }

    /// @dev amount1 = amount0 * sqrtPrice^2 / 2^192, split so the square does not overflow.
    function _mulPrice(uint256 amount, uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 step = Math.mulDiv(amount, sqrtPriceX96, 1 << 96);
        return Math.mulDiv(step, sqrtPriceX96, 1 << 96);
    }

    function _divPrice(uint256 amount, uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 step = Math.mulDiv(amount, 1 << 96, sqrtPriceX96);
        return Math.mulDiv(step, 1 << 96, sqrtPriceX96);
    }
}
