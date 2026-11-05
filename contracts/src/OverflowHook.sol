// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {DeskOrder, IDeskSwapVM} from "./interfaces/IDeskSwapVM.sol";

/// @title OverflowHook
/// @notice When an exact-input swap is larger than the pool cap, the residual is filled in the same
///         transaction from a maker wallet that shipped a DeskBand strategy on Aqua.
/// @dev The swap must enter through `OverflowRouter`, which prefunds the input. A direct pool swap
///      emits `WouldRoute` and leaves the pool to do the whole trade, so this hook cannot `take`
///      reserves it did not just receive.
contract OverflowHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    uint256 private constant _UNLOCKED = 1;
    uint256 private constant _LOCKED = 2;
    /// @dev MakerTraits.USE_AQUA_INSTEAD_OF_SIGNATURE_BIT_FLAG
    uint256 private constant _USE_AQUA = 1 << 254;
    /// @dev TakerTraits for exact-in + transferFrom/Aqua push, no hooks, no threshold.
    ///      Asserted equal to TakerTraitsLib.build in DeskBand.t.sol.
    bytes private constant _TAKER_DATA = hex"00000000000000000000000000000000000000000041";

    struct Desk {
        address maker;
        uint256 traits;
        bytes data;
    }

    struct Fill {
        address maker;
        address tokenIn;
        address tokenOut;
        uint256 residualIn;
        uint256 filledOut;
        uint256 feeOut;
        bytes32 fillId;
    }

    error Reentrancy();
    error NotOwner();
    error NotMaker();
    error StrategyPinMismatch(bytes32 actual, bytes32 pinned);
    error AmountDoesNotFit();
    error QuoteMismatch(uint256 quoted, uint256 filled);
    error ZeroCap();

    event DeskRegistered(PoolId indexed poolId, address indexed maker, bytes32 strategyHash, uint256 inputCap);
    event DeskCleared(PoolId indexed poolId, address indexed maker);
    event OverflowRouted(PoolId indexed poolId, address indexed maker, uint256 residualIn, uint256 filledOut);
    event WouldRoute(PoolId indexed poolId, uint256 residualIn);
    event FeeAccrued(bytes32 indexed fillId, address indexed maker, address token, uint256 feeAmount);
    event OverflowRouterSet(address indexed router);

    IDeskSwapVM public immutable swapVm;
    bytes32 public immutable defaultStrategyHash;
    address public owner;
    address public overflowRouter;
    uint256 public fillNonce;
    uint256 private lockStatus = _UNLOCKED;

    mapping(PoolId => Desk) internal _desks;
    mapping(PoolId => uint256) public poolInputCap;
    mapping(PoolId => Fill) public lastFill;
    mapping(address maker => mapping(address token => uint256 amount)) public accruedFees;

    constructor(IPoolManager manager, address aquaRouter, bytes32 defaultStrategyHash_) BaseHook(manager) {
        swapVm = IDeskSwapVM(aquaRouter);
        defaultStrategyHash = defaultStrategyHash_;
        owner = msg.sender;
    }

    function setOverflowRouter(address router) external {
        if (msg.sender != owner) revert NotOwner();
        overflowRouter = router;
        emit OverflowRouterSet(router);
    }

    function transferOwner(address next) external {
        if (msg.sender != owner) revert NotOwner();
        owner = next;
    }

    /// @notice Maker ships on Aqua first, then registers the same order here.
    /// @param inputCap Maximum input the pool itself may fill. The rest is the overflow. Must be non-zero
    ///        so the pool leg of an overflow swap is a real swap, not a zero-amount swap.
    function registerDesk(PoolKey calldata key, DeskOrder calldata order, uint256 inputCap) external {
        if (address(key.hooks) != address(this)) revert InvalidPool();
        if (order.maker != msg.sender) revert NotMaker();
        if ((order.traits & _USE_AQUA) == 0) revert NotMaker();
        if (inputCap == 0) revert ZeroCap();
        bytes32 hash = keccak256(abi.encode(order));
        if (defaultStrategyHash != bytes32(0) && hash != defaultStrategyHash) {
            revert StrategyPinMismatch(hash, defaultStrategyHash);
        }
        PoolId id = key.toId();
        _desks[id] = Desk({maker: order.maker, traits: order.traits, data: order.data});
        poolInputCap[id] = inputCap;
        emit DeskRegistered(id, order.maker, hash, inputCap);
    }

    function clearDesk(PoolKey calldata key) external {
        PoolId id = key.toId();
        if (_desks[id].maker != msg.sender) revert NotMaker();
        delete _desks[id];
        delete poolInputCap[id];
        emit DeskCleared(id, msg.sender);
    }

    function desks(PoolId id) external view returns (address maker, uint256 traits, bytes memory data) {
        Desk memory d = _desks[id];
        return (d.maker, d.traits, d.data);
    }

    function strategyHash(PoolId id) external view returns (bytes32) {
        Desk memory d = _desks[id];
        if (d.maker == address(0)) return bytes32(0);
        return keccak256(abi.encode(_order(d)));
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (lockStatus != _UNLOCKED) revert Reentrancy();
        lockStatus = _LOCKED;
        (bytes4 selector, BeforeSwapDelta delta, uint24 fee) = _route(sender, key, params);
        lockStatus = _UNLOCKED;
        return (selector, delta, fee);
    }

    function _route(address sender, PoolKey calldata key, SwapParams calldata params)
        internal
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (params.amountSpecified >= 0) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint256 amountIn = uint256(-params.amountSpecified);
        PoolId id = key.toId();
        uint256 cap = poolInputCap[id];
        if (cap == 0 || amountIn <= cap) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        uint256 residual = amountIn - cap;
        Desk memory desk = _desks[id];
        if (desk.maker == address(0) || sender != overflowRouter) {
            emit WouldRoute(id, residual);
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }

        return _fill(key, params.zeroForOne, residual, desk);
    }

    function _fill(PoolKey calldata key, bool zeroForOne, uint256 residual, Desk memory desk)
        internal
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (residual > uint256(uint128(type(int128).max))) revert AmountDoesNotFit();

        Currency input = zeroForOne ? key.currency0 : key.currency1;
        Currency output = zeroForOne ? key.currency1 : key.currency0;
        address tokenIn = Currency.unwrap(input);
        address tokenOut = Currency.unwrap(output);

        DeskOrder memory order = _order(desk);

        (uint256 quotedOut, uint256 feeOut) = swapVm.preview(order, tokenIn, tokenOut, residual);
        if (quotedOut > uint256(uint128(type(int128).max))) revert AmountDoesNotFit();

        // Pull the prefunded residual out of the PoolManager, then pay it to the maker through SwapVM.
        poolManager.take(input, address(this), residual);
        IERC20(tokenIn).forceApprove(address(swapVm), residual);

        (uint256 amountInFilled, uint256 amountOut,) = swapVm.swap(order, tokenIn, tokenOut, residual, _TAKER_DATA);
        if (amountInFilled != residual || amountOut != quotedOut) revert QuoteMismatch(quotedOut, amountOut);

        // Settle the maker's output tokens against the debt this delta will record.
        poolManager.sync(output);
        IERC20(tokenOut).safeTransfer(address(poolManager), amountOut);
        poolManager.settle();

        bytes32 fillId = keccak256(abi.encode(key.toId(), desk.maker, fillNonce++));
        accruedFees[desk.maker][tokenOut] += feeOut;
        lastFill[key.toId()] = Fill({
            maker: desk.maker,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            residualIn: residual,
            filledOut: amountOut,
            feeOut: feeOut,
            fillId: fillId
        });

        emit FeeAccrued(fillId, desk.maker, tokenOut, feeOut);
        emit OverflowRouted(key.toId(), desk.maker, residual, amountOut);

        // Positive specified: this hook is credited `residual` of the input (nets the take above).
        // Negative unspecified: this hook owes `amountOut` of the output (nets the settle above).
        BeforeSwapDelta delta = toBeforeSwapDelta(int128(uint128(residual)), -int128(uint128(amountOut)));
        return (BaseHook.beforeSwap.selector, delta, 0);
    }

    function _order(Desk memory desk) internal pure returns (DeskOrder memory) {
        return DeskOrder({maker: desk.maker, traits: desk.traits, data: desk.data});
    }
}
