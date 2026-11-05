// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {DeskOrder, IDeskSwapVM} from "./interfaces/IDeskSwapVM.sol";
import {IDeskPriceFeed} from "./DeskPriceFeed.sol";

/// @notice The two Aqua reads the hook needs. ABI twin of `IAqua` (0.8.30 sources).
interface IAquaBalances {
    function safeBalances(address maker, address app, bytes32 strategyHash, address token0, address token1)
        external
        view
        returns (uint256 balance0, uint256 balance1);
}

/// @title OverflowHook
/// @notice When an exact-input swap is larger than the pool cap, the pool fills the cap and the residual is
///         filled in the same transaction from the best maker desk: a wallet that shipped a DeskBand strategy
///         on 1inch Aqua. Tokens stay in the maker wallet until the fill pulls them.
/// @dev Works with any v4 router, including ones that settle input after the swap. The hook `take`s the
///      residual input from PoolManager reserves inside flash accounting. The `BeforeSwapDelta` it returns
///      charges that residual to the swap caller, so the unlock reverts unless the caller settles it.
///
///      The hook never blocks a swap because of a desk. Every desk problem (no quote, unfunded wallet,
///      price outside the maker's band of the pool spot or of the Chainlink CRE reference, stale reference,
///      failed SwapVM call) is a skip. With no desk left, the pool fills the whole swap and `WouldRoute` is
///      emitted.
contract OverflowHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;
    using SafeERC20 for IERC20;

    enum SkipReason {
        None,
        QuoteFailed,
        MakerUnfunded,
        SpotDeviation,
        ReferenceStale,
        ReferenceDeviation,
        SwapFailed
    }

    uint256 public constant MAX_DESKS = 8;
    uint256 public constant BPS = 10_000;
    /// @notice Gas forwarded to `preview` per desk and to the SwapVM fill. Caps what one desk can burn.
    uint256 public constant PREVIEW_GAS = 200_000;
    uint256 public constant SWAP_GAS = 600_000;

    uint256 private constant _PRICE_SCALE = 1e18;
    uint256 private constant _Q96 = 1 << 96;
    uint256 private constant _UNLOCKED = 1;
    uint256 private constant _LOCKED = 2;
    /// @dev MakerTraits.USE_AQUA_INSTEAD_OF_SIGNATURE_BIT_FLAG
    uint256 private constant _USE_AQUA = 1 << 254;
    /// @dev MakerTraits bits a desk may not set: unwrap WETH (255), allow zero amount in (253), and every
    ///      maker hook flag and hook target flag (252..245). Hooks would let a maker run code inside our fill.
    uint256 private constant _FORBIDDEN_TRAITS = (1 << 255) | (1 << 253) | ((1 << 253) - (1 << 245));
    /// @dev TakerTraits for exact-in + transferFrom/Aqua push, no hooks, no threshold.
    ///      Asserted equal to TakerTraitsLib.build in DeskBand.t.sol.
    bytes private constant _TAKER_DATA = hex"00000000000000000000000000000000000000000041";
    /// @dev Arachnid's deterministic deployer. A hook mined for that factory has `msg.sender` equal to the
    ///      factory, so the broadcasting EOA (`tx.origin`) is the owner. Direct deploys keep `msg.sender`.
    address private constant _CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    struct Desk {
        address maker;
        uint16 maxDeviationBps;
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

    struct Route {
        PoolId id;
        Currency input;
        Currency output;
        address tokenIn;
        address tokenOut;
        bool zeroForOne;
        uint256 residual;
    }

    error Reentrancy();
    error NotOwner();
    error NotMaker();
    error InvalidTraits(uint256 traits);
    error BadDeviation(uint16 maxDeviationBps);
    error NoPoolCap();
    error ZeroCap();
    error NotShipped();
    error DeskSlotsFull(uint256 newValue, uint256 minValue);
    error QuoteMismatch(uint256 quoted, uint256 filled);

    event PoolCapSet(PoolId indexed poolId, uint256 inputCap);
    event PriceFeedSet(address indexed feed, uint32 maxAge);
    event DeskRegistered(PoolId indexed poolId, address indexed maker, bytes32 strategyHash, uint16 maxDeviationBps);
    event DeskCleared(PoolId indexed poolId, address indexed maker);
    event DeskEvicted(PoolId indexed poolId, address indexed evicted, address indexed by);
    event DeskSkipped(PoolId indexed poolId, address indexed maker, SkipReason reason);
    event OverflowRouted(PoolId indexed poolId, address indexed maker, uint256 residualIn, uint256 filledOut);
    event WouldRoute(PoolId indexed poolId, uint256 residualIn);
    event FeeAccrued(bytes32 indexed fillId, address indexed maker, address token, uint256 feeAmount);
    event OwnerSet(address indexed owner);

    IDeskSwapVM public immutable swapVm;
    IAquaBalances public immutable aqua;

    address public owner;
    IDeskPriceFeed public priceFeed;
    uint32 public maxReferenceAge;
    uint256 public fillNonce;
    uint256 private lockStatus = _UNLOCKED;

    mapping(PoolId => Desk[]) internal _desks;
    mapping(PoolId => uint256) public poolInputCap;
    mapping(PoolId => Fill) public lastFill;
    mapping(address maker => mapping(address token => uint256 amount)) public accruedFees;

    constructor(IPoolManager manager, address swapVm_, address aqua_) BaseHook(manager) {
        swapVm = IDeskSwapVM(swapVm_);
        aqua = IAquaBalances(aqua_);
        owner = msg.sender == _CREATE2_FACTORY ? tx.origin : msg.sender;
        emit OwnerSet(owner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------- admin

    /// @notice Maximum input the pool itself fills before desks take the residual.
    function setPoolCap(PoolKey calldata key, uint256 inputCap) external onlyOwner {
        if (address(key.hooks) != address(this)) revert InvalidPool();
        if (inputCap == 0) revert ZeroCap();
        poolInputCap[key.toId()] = inputCap;
        emit PoolCapSet(key.toId(), inputCap);
    }

    /// @notice Chainlink CRE reference. `feed == address(0)` disables the reference check (spot check stays).
    function setPriceFeed(address feed, uint32 maxAge) external onlyOwner {
        priceFeed = IDeskPriceFeed(feed);
        maxReferenceAge = maxAge;
        emit PriceFeedSet(feed, maxAge);
    }

    function transferOwner(address next) external onlyOwner {
        owner = next;
        emit OwnerSet(next);
    }

    // ---------------------------------------------------------------- makers

    /// @notice Ship the order on Aqua first, then register it here. One desk per maker per pool.
    /// @param maxDeviationBps Largest allowed gap between this desk's quote and the pool spot (and the CRE
    ///        reference when one is configured). Outside it the desk is skipped, so a stale band cannot be
    ///        picked off.
    function registerDesk(PoolKey calldata key, DeskOrder calldata order, uint16 maxDeviationBps) external {
        if (address(key.hooks) != address(this)) revert InvalidPool();
        if (order.maker != msg.sender) revert NotMaker();
        if ((order.traits & _USE_AQUA) == 0 || (order.traits & _FORBIDDEN_TRAITS) != 0) {
            revert InvalidTraits(order.traits);
        }
        if (maxDeviationBps == 0 || maxDeviationBps > BPS) revert BadDeviation(maxDeviationBps);
        PoolId id = key.toId();
        if (poolInputCap[id] == 0) revert NoPoolCap();

        Desk memory desk = Desk({maker: order.maker, maxDeviationBps: maxDeviationBps, traits: order.traits, data: order.data});
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);
        (bool shipped,,) = _shippedBalances(desk, token0, token1);
        if (!shipped) revert NotShipped();

        Desk[] storage list = _desks[id];
        uint256 slot = type(uint256).max;
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].maker == msg.sender) {
                slot = i;
                break;
            }
        }
        if (slot == type(uint256).max) {
            if (list.length < MAX_DESKS) {
                list.push();
                slot = list.length - 1;
            } else {
                slot = _evictionSlot(id, desk, token0, token1);
            }
        }
        _write(list[slot], desk);
        emit DeskRegistered(id, msg.sender, keccak256(abi.encode(order)), maxDeviationBps);
    }

    function clearDesk(PoolKey calldata key) external {
        PoolId id = key.toId();
        Desk[] storage list = _desks[id];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].maker == msg.sender) {
                uint256 last = list.length - 1;
                if (i != last) _write(list[i], list[last]);
                list.pop();
                emit DeskCleared(id, msg.sender);
                return;
            }
        }
        revert NotMaker();
    }

    // ---------------------------------------------------------------- views

    function deskCount(PoolId id) external view returns (uint256) {
        return _desks[id].length;
    }

    function deskAt(PoolId id, uint256 index)
        external
        view
        returns (address maker, uint16 maxDeviationBps, uint256 traits, bytes memory data)
    {
        Desk memory d = _desks[id][index];
        return (d.maker, d.maxDeviationBps, d.traits, d.data);
    }

    /// @notice The maker's desk on a pool, or `maker == address(0)` when there is none.
    function deskOf(PoolId id, address maker)
        external
        view
        returns (address deskMaker, uint16 maxDeviationBps, uint256 traits, bytes memory data)
    {
        Desk[] storage list = _desks[id];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].maker == maker) {
                Desk memory d = list[i];
                return (d.maker, d.maxDeviationBps, d.traits, d.data);
            }
        }
    }

    /// @notice Pool spot as raw token1 per 1 raw token0, scaled by 1e18.
    function spotPriceX18(PoolId id) public view returns (uint256) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(id);
        return Math.mulDiv(Math.mulDiv(sqrtPriceX96, sqrtPriceX96, _Q96), _PRICE_SCALE, _Q96);
    }

    // ---------------------------------------------------------------- hook

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

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (lockStatus != _UNLOCKED) revert Reentrancy();
        lockStatus = _LOCKED;
        BeforeSwapDelta delta = _route(key, params);
        lockStatus = _UNLOCKED;
        return (BaseHook.beforeSwap.selector, delta, 0);
    }

    function _route(PoolKey calldata key, SwapParams calldata params) internal returns (BeforeSwapDelta) {
        if (params.amountSpecified >= 0) return BeforeSwapDeltaLibrary.ZERO_DELTA;

        Route memory r;
        r.id = key.toId();
        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 cap = poolInputCap[r.id];
        if (cap == 0 || amountIn <= cap) return BeforeSwapDeltaLibrary.ZERO_DELTA;

        r.residual = amountIn - cap;
        r.zeroForOne = params.zeroForOne;
        r.input = r.zeroForOne ? key.currency0 : key.currency1;
        r.output = r.zeroForOne ? key.currency1 : key.currency0;
        r.tokenIn = Currency.unwrap(r.input);
        r.tokenOut = Currency.unwrap(r.output);

        // Native currency, an amount that does not fit the delta, or PoolManager reserves too thin to
        // advance the residual: the pool takes the whole swap.
        if (
            r.input.isAddressZero() || r.output.isAddressZero() || _desks[r.id].length == 0
                || r.residual > uint256(uint128(type(int128).max))
                || IERC20(r.tokenIn).balanceOf(address(poolManager)) < r.residual
        ) {
            emit WouldRoute(r.id, r.residual);
            return BeforeSwapDeltaLibrary.ZERO_DELTA;
        }

        (bool referenceOk, uint256 referenceX18) = _reference(r.id);
        if (!referenceOk) {
            emit DeskSkipped(r.id, address(0), SkipReason.ReferenceStale);
            emit WouldRoute(r.id, r.residual);
            return BeforeSwapDeltaLibrary.ZERO_DELTA;
        }

        (bool found, Desk memory best, uint256 quotedOut, uint256 feeOut) = _best(r, referenceX18);
        if (!found) {
            emit WouldRoute(r.id, r.residual);
            return BeforeSwapDeltaLibrary.ZERO_DELTA;
        }
        return _fill(r, best, quotedOut, feeOut);
    }

    /// @dev Best quote among desks that pass every guard. Ties keep the earlier desk.
    function _best(Route memory r, uint256 referenceX18)
        internal
        returns (bool found, Desk memory best, uint256 bestOut, uint256 bestFee)
    {
        uint256 spotOut = _fairOut(r.residual, spotPriceX18(r.id), r.zeroForOne);
        uint256 refOut = referenceX18 == 0 ? 0 : _fairOut(r.residual, referenceX18, r.zeroForOne);
        Desk[] storage list = _desks[r.id];
        for (uint256 i = 0; i < list.length; i++) {
            Desk memory d = list[i];
            (SkipReason reason, uint256 out, uint256 fee) = _check(r, d, spotOut, refOut);
            if (reason != SkipReason.None) {
                emit DeskSkipped(r.id, d.maker, reason);
                continue;
            }
            if (out > bestOut) {
                (found, best, bestOut, bestFee) = (true, d, out, fee);
            }
        }
    }

    function _check(Route memory r, Desk memory d, uint256 spotOut, uint256 refOut)
        internal
        view
        returns (SkipReason, uint256 out, uint256 fee)
    {
        bool ok;
        (ok, out, fee) = _quote(d, r.tokenIn, r.tokenOut, r.residual);
        if (!ok || out == 0 || out > uint256(uint128(type(int128).max))) return (SkipReason.QuoteFailed, 0, 0);
        if (_outside(out, spotOut, d.maxDeviationBps)) return (SkipReason.SpotDeviation, 0, 0);
        if (refOut != 0 && _outside(out, refOut, d.maxDeviationBps)) return (SkipReason.ReferenceDeviation, 0, 0);
        if (
            IERC20(r.tokenOut).balanceOf(d.maker) < out
                || IERC20(r.tokenOut).allowance(d.maker, address(aqua)) < out
        ) return (SkipReason.MakerUnfunded, 0, 0);
        return (SkipReason.None, out, fee);
    }

    function _fill(Route memory r, Desk memory desk, uint256 quotedOut, uint256 feeOut)
        internal
        returns (BeforeSwapDelta)
    {
        DeskOrder memory order = DeskOrder({maker: desk.maker, traits: desk.traits, data: desk.data});

        // Advance the residual input out of PoolManager reserves and pay it to the maker through SwapVM.
        poolManager.take(r.input, address(this), r.residual);
        IERC20(r.tokenIn).forceApprove(address(swapVm), r.residual);
        (bool ok, uint256 amountInFilled, uint256 amountOut) = _swap(order, r.tokenIn, r.tokenOut, r.residual);
        IERC20(r.tokenIn).forceApprove(address(swapVm), 0);

        if (!ok) {
            // The SwapVM call reverted, so nothing moved. Hand the residual back and let the pool fill.
            poolManager.sync(r.input);
            IERC20(r.tokenIn).safeTransfer(address(poolManager), r.residual);
            poolManager.settle();
            emit DeskSkipped(r.id, desk.maker, SkipReason.SwapFailed);
            emit WouldRoute(r.id, r.residual);
            return BeforeSwapDeltaLibrary.ZERO_DELTA;
        }
        // Same block, same math as `preview`. A mismatch means the router is not what we think it is.
        if (amountInFilled != r.residual || amountOut != quotedOut) revert QuoteMismatch(quotedOut, amountOut);

        // Settle the maker's output tokens against the debt this delta will record.
        poolManager.sync(r.output);
        IERC20(r.tokenOut).safeTransfer(address(poolManager), amountOut);
        poolManager.settle();

        bytes32 fillId = keccak256(abi.encode(r.id, desk.maker, fillNonce++));
        accruedFees[desk.maker][r.tokenOut] += feeOut;
        lastFill[r.id] = Fill({
            maker: desk.maker,
            tokenIn: r.tokenIn,
            tokenOut: r.tokenOut,
            residualIn: r.residual,
            filledOut: amountOut,
            feeOut: feeOut,
            fillId: fillId
        });

        emit FeeAccrued(fillId, desk.maker, r.tokenOut, feeOut);
        emit OverflowRouted(r.id, desk.maker, r.residual, amountOut);

        // Positive specified: this hook is credited `residual` of the input (nets the take above), and the
        // swap caller is charged it. Negative unspecified: this hook owes `amountOut` of the output (nets the
        // settle above), and the swap caller receives it.
        return toBeforeSwapDelta(int128(uint128(r.residual)), -int128(uint128(amountOut)));
    }

    // ---------------------------------------------------------------- internals

    function _quote(Desk memory d, address tokenIn, address tokenOut, uint256 amountIn)
        internal
        view
        returns (bool ok, uint256 out, uint256 fee)
    {
        DeskOrder memory order = DeskOrder({maker: d.maker, traits: d.traits, data: d.data});
        try swapVm.preview{gas: PREVIEW_GAS}(order, tokenIn, tokenOut, amountIn) returns (uint256 o, uint256 f) {
            return (true, o, f);
        } catch {
            return (false, 0, 0);
        }
    }

    function _swap(DeskOrder memory order, address tokenIn, address tokenOut, uint256 amount)
        internal
        returns (bool ok, uint256 amountIn, uint256 amountOut)
    {
        try swapVm.swap{gas: SWAP_GAS}(order, tokenIn, tokenOut, amount, _TAKER_DATA) returns (
            uint256 a, uint256 b, bytes32
        ) {
            return (true, a, b);
        } catch {
            return (false, 0, 0);
        }
    }

    /// @dev `(true, 0)` when no feed is set. `(false, 0)` when a feed is set and its reference is missing,
    ///      stale, or the read fails: desks are skipped rather than trusted without a reference.
    function _reference(PoolId id) internal view returns (bool ok, uint256 priceX18) {
        IDeskPriceFeed feed = priceFeed;
        if (address(feed) == address(0)) return (true, 0);
        try feed.referenceOf(PoolId.unwrap(id)) returns (uint256 p, uint64 updatedAt) {
            if (p == 0 || updatedAt == 0 || block.timestamp > uint256(updatedAt) + maxReferenceAge) return (false, 0);
            return (true, p);
        } catch {
            return (false, 0);
        }
    }

    function _fairOut(uint256 amountIn, uint256 priceX18, bool zeroForOne) internal pure returns (uint256) {
        if (priceX18 == 0) return 0;
        return zeroForOne
            ? Math.mulDiv(amountIn, priceX18, _PRICE_SCALE)
            : Math.mulDiv(amountIn, _PRICE_SCALE, priceX18);
    }

    function _outside(uint256 out, uint256 fair, uint16 maxDeviationBps) internal pure returns (bool) {
        if (fair == 0) return true;
        uint256 gap = out > fair ? out - fair : fair - out;
        return gap * BPS > fair * maxDeviationBps;
    }

    /// @dev Shipped balances must exist (Aqua reverts for a strategy that was never shipped or was docked).
    function _shippedBalances(Desk memory d, address token0, address token1)
        internal
        view
        returns (bool shipped, uint256 balance0, uint256 balance1)
    {
        bytes32 hash = keccak256(abi.encode(DeskOrder({maker: d.maker, traits: d.traits, data: d.data})));
        try aqua.safeBalances(d.maker, address(swapVm), hash, token0, token1) returns (uint256 b0, uint256 b1) {
            return (b0 != 0 || b1 != 0, b0, b1);
        } catch {
            return (false, 0, 0);
        }
    }

    /// @notice Inventory a desk can actually deliver, valued in token1 at the pool spot.
    /// @dev Shipped Aqua balances are virtual, so each side is capped by the wallet balance and the Aqua
    ///      allowance. Nobody can evict a funded desk with balances they do not hold.
    function liveValue(PoolKey calldata key, address maker) external view returns (uint256) {
        PoolId id = key.toId();
        Desk[] storage list = _desks[id];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].maker == maker) {
                return _liveValue(
                    list[i], Currency.unwrap(key.currency0), Currency.unwrap(key.currency1), spotPriceX18(id)
                );
            }
        }
        return 0;
    }

    function _liveValue(Desk memory d, address token0, address token1, uint256 spotX18)
        internal
        view
        returns (uint256)
    {
        (bool shipped, uint256 b0, uint256 b1) = _shippedBalances(d, token0, token1);
        if (!shipped) return 0;
        uint256 e0 = _deliverable(token0, d.maker, b0);
        uint256 e1 = _deliverable(token1, d.maker, b1);
        return e1 + Math.mulDiv(e0, spotX18, _PRICE_SCALE);
    }

    function _deliverable(address token, address maker, uint256 shipped) internal view returns (uint256) {
        uint256 held = IERC20(token).balanceOf(maker);
        uint256 allowed = IERC20(token).allowance(maker, address(aqua));
        return Math.min(shipped, Math.min(held, allowed));
    }

    /// @dev With every slot taken, the newcomer replaces the desk with the least live inventory, and only if
    ///      it brings strictly more.
    function _evictionSlot(PoolId id, Desk memory incoming, address token0, address token1)
        internal
        returns (uint256 slot)
    {
        uint256 spotX18 = spotPriceX18(id);
        Desk[] storage list = _desks[id];
        uint256 minValue = type(uint256).max;
        for (uint256 i = 0; i < list.length; i++) {
            uint256 v = _liveValue(list[i], token0, token1, spotX18);
            if (v < minValue) (minValue, slot) = (v, i);
        }
        uint256 newValue = _liveValue(incoming, token0, token1, spotX18);
        if (newValue <= minValue) revert DeskSlotsFull(newValue, minValue);
        emit DeskEvicted(id, list[slot].maker, incoming.maker);
    }

    function _write(Desk storage slot, Desk memory d) internal {
        slot.maker = d.maker;
        slot.maxDeviationBps = d.maxDeviationBps;
        slot.traits = d.traits;
        slot.data = d.data;
    }
}
