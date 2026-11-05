// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {DeskOrder, IDeskSwapVM} from "../src/interfaces/IDeskSwapVM.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";
import {DeskPriceFeed} from "../src/DeskPriceFeed.sol";
import {UniV4OracleAdapter, OracleQuery, OracleRegisters} from "../src/UniV4OracleAdapter.sol";
import {Addresses} from "../src/Addresses.sol";

interface IOrderBuilder {
    function build(address maker, uint16 feeBps, uint32 start, uint32 halfLife)
        external
        pure
        returns (uint256 traits, bytes memory data, bytes memory strategy);
}

/// @notice A plain v4 caller: swaps first, settles the input it owes afterwards. Not OverflowRouter.
contract PlainSwapper is IUnlockCallback {
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function swap(PoolKey calldata key, uint256 amountIn, address recipient) external returns (uint256 amountOut) {
        MockERC20(Currency.unwrap(key.currency0)).transferFrom(msg.sender, address(this), amountIn);
        amountOut = abi.decode(manager.unlock(abi.encode(key, amountIn, recipient)), (uint256));
        uint256 left = MockERC20(Currency.unwrap(key.currency0)).balanceOf(address(this));
        if (left > 0) MockERC20(Currency.unwrap(key.currency0)).transfer(msg.sender, left);
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        require(msg.sender == address(manager));
        (PoolKey memory key, uint256 amountIn, address recipient) = abi.decode(raw, (PoolKey, uint256, address));
        manager.swap(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            ""
        );
        int256 inDelta = manager.currencyDelta(address(this), key.currency0);
        int256 outDelta = manager.currencyDelta(address(this), key.currency1);
        if (inDelta < 0) {
            manager.sync(key.currency0);
            MockERC20(Currency.unwrap(key.currency0)).transfer(address(manager), uint256(-inDelta));
            manager.settle();
        }
        uint256 out = outDelta > 0 ? uint256(outDelta) : 0;
        if (out > 0) manager.take(key.currency1, recipient, out);
        return abi.encode(out);
    }
}

/// @notice SwapVM stand-in that re-enters the pool during the fill. It records what the re-entry hit,
///         then completes the fill honestly so the outer swap can finish.
contract ReenteringSwap is IDeskSwapVM {
    IPoolManager public manager;
    PoolKey public key;
    bytes public reentryRevert;

    function arm(IPoolManager manager_, PoolKey calldata key_) external {
        manager = manager_;
        key = key_;
    }

    function preview(DeskOrder calldata, address, address, uint256 amountIn) external pure returns (uint256, uint256) {
        return (amountIn * 997 / 1000, amountIn * 3 / 1000);
    }

    function swap(DeskOrder calldata, address tokenIn, address tokenOut, uint256 amount, bytes calldata)
        external
        returns (uint256, uint256, bytes32)
    {
        try manager.swap(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(0.01 ether),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            ""
        ) {} catch (bytes memory reason) {
            reentryRevert = reason;
        }
        MockERC20(tokenIn).transferFrom(msg.sender, address(this), amount);
        uint256 out = amount * 997 / 1000;
        MockERC20(tokenOut).transfer(msg.sender, out);
        return (amount, out, bytes32(0));
    }
}

/// @notice SwapVM stand-in whose fill always reverts after a good-looking preview.
contract RevertingSwap is IDeskSwapVM {
    function preview(DeskOrder calldata, address, address, uint256 amountIn) external pure returns (uint256, uint256) {
        return (amountIn * 997 / 1000, amountIn * 3 / 1000);
    }

    function swap(DeskOrder calldata, address, address, uint256, bytes calldata)
        external
        pure
        returns (uint256, uint256, bytes32)
    {
        revert("fill reverts");
    }
}

abstract contract OverflowFixture is Test {
    using PoolIdLibrary for PoolKey;

    uint256 internal constant SHIP = 1_000 ether;
    uint256 internal constant CAP = 1 ether;
    uint256 internal constant LARGE = 5 ether;
    uint16 internal constant MAX_DEV = 100; // 1%

    IPoolManager internal manager;
    IAqua internal aqua;
    IDeskSwapVM internal swapVm;
    IOrderBuilder internal builder;
    OverflowRouter internal router;
    OverflowHook internal hook;
    MockERC20 internal token0;
    MockERC20 internal token1;
    PoolKey internal key;
    PoolId internal id;
    address internal maker;
    address internal taker;
    DeskOrder internal order;
    bytes internal strategy;

    bytes32 internal constant SKIPPED = keccak256("DeskSkipped(bytes32,address,uint8)");
    bytes32 internal constant ROUTED = keccak256("OverflowRouted(bytes32,address,uint256,uint256)");
    bytes32 internal constant WOULD_ROUTE = keccak256("WouldRoute(bytes32,uint256)");

    function _bootstrap(IPoolManager manager_, IAqua aqua_) internal {
        manager = manager_;
        aqua = aqua_;
        swapVm = IDeskSwapVM(
            deployCode(
                "WalletDeskRouter.sol:WalletDeskRouter",
                abi.encode(address(aqua), Addresses.UNICHAIN_WETH, address(this))
            )
        );
        builder = IOrderBuilder(deployCode("OrderBuilder.sol:OrderBuilder"));
        hook = _deployHook(address(swapVm), 0x4444);
        router = new OverflowRouter(manager);

        MockERC20 a = new MockERC20("Desk A", "DA", 18);
        MockERC20 b = new MockERC20("Desk B", "DB", 18);
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
        key = _initPool(hook);
        id = key.toId();

        maker = makeAddr("maker");
        taker = makeAddr("taker");
        token0.mint(taker, 100 ether);
        vm.prank(taker);
        token0.approve(address(router), type(uint256).max);
        (order, strategy) = _fundMaker(maker, 30, SHIP);
    }

    function _deployHook(address vmAddr, uint160 salt) internal returns (OverflowHook h) {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        address hookAddr = address(flags ^ (salt << 144));
        deployCodeTo("OverflowHook.sol:OverflowHook", abi.encode(address(manager), vmAddr, address(aqua)), hookAddr);
        h = OverflowHook(hookAddr);
    }

    /// @dev Tight position around 1.0 plus a wide one, so the pool alone can absorb a fallback swap.
    function _initPool(OverflowHook h) internal returns (PoolKey memory k) {
        k = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(h))
        });
        manager.initialize(k, TickMath.getSqrtPriceAtTick(0));
        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.mint(address(this), 1_000_000 ether);
        token1.mint(address(this), 1_000_000 ether);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(
            k, ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 50e18, salt: 0}), ""
        );
        liq.modifyLiquidity(
            k, ModifyLiquidityParams({tickLower: -12_000, tickUpper: 12_000, liquidityDelta: 20e18, salt: 0}), ""
        );
        h.setPoolCap(k, CAP);
    }

    function _fundMaker(address who, uint16 feeBps, uint256 amount)
        internal
        returns (DeskOrder memory o, bytes memory packed)
    {
        token0.mint(who, amount);
        token1.mint(who, amount);
        vm.startPrank(who);
        token0.approve(address(aqua), type(uint256).max);
        token1.approve(address(aqua), type(uint256).max);
        vm.stopPrank();
        (uint256 traits, bytes memory data, bytes memory p) = builder.build(who, feeBps, uint32(block.timestamp), 0);
        o = DeskOrder({maker: who, traits: traits, data: data});
        packed = p;
    }

    function _shipAs(address who, address app, bytes memory packed, uint256 amount) internal returns (bytes32 h) {
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        tokens[0] = address(token0);
        tokens[1] = address(token1);
        amounts[0] = amount;
        amounts[1] = amount;
        uint256 bal0 = token0.balanceOf(who);
        uint256 bal1 = token1.balanceOf(who);
        vm.prank(who);
        h = aqua.ship(app, packed, tokens, amounts);
        assertEq(token0.balanceOf(who), bal0, "ship moved token0");
        assertEq(token1.balanceOf(who), bal1, "ship moved token1");
    }

    function _ship() internal returns (bytes32) {
        return _shipAs(maker, address(swapVm), strategy, SHIP);
    }

    function _shipAndRegister() internal {
        _ship();
        vm.prank(maker);
        hook.registerDesk(key, order, MAX_DEV);
    }

    function _has(Vm.Log[] memory logs, bytes32 topic) internal view returns (bool) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(hook) && logs[i].topics.length > 0 && logs[i].topics[0] == topic) {
                return true;
            }
        }
        return false;
    }

    function _skipped(Vm.Log[] memory logs, address who, OverflowHook.SkipReason reason) internal view returns (bool) {
        for (uint256 i = 0; i < logs.length; i++) {
            Vm.Log memory l = logs[i];
            if (l.emitter != address(hook) || l.topics.length < 3 || l.topics[0] != SKIPPED) continue;
            if (address(uint160(uint256(l.topics[2]))) != who) continue;
            if (abi.decode(l.data, (uint8)) == uint8(reason)) return true;
        }
        return false;
    }

    // ------------------------------------------------------------ core fill

    function test_overflowFillPullsMakerWallet() public {
        _shipAndRegister();

        uint256 maker0 = token0.balanceOf(maker);
        uint256 maker1 = token1.balanceOf(maker);
        uint256 taker0 = token0.balanceOf(taker);
        uint256 taker1 = token1.balanceOf(taker);

        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(key, true, LARGE, 0, taker);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        assertEq(token0.balanceOf(maker), maker0 + 4 ether, "maker received residual input");
        assertEq(token1.balanceOf(maker), maker1 - 3.988 ether, "maker paid shelf output");
        assertEq(token0.balanceOf(taker), taker0 - LARGE);
        assertEq(token1.balanceOf(taker), taker1 + out);
        assertGt(out, 3.988 ether, "pool filled a portion on top of the shelf");

        (address fillMaker,,, uint256 residual, uint256 filled, uint256 fee, bytes32 fillId) = hook.lastFill(id);
        assertEq(fillMaker, maker);
        assertEq(residual, 4 ether);
        assertEq(filled, 3.988 ether);
        assertEq(fee, 0.012 ether);
        assertTrue(fillId != bytes32(0));
        assertEq(hook.accruedFees(maker, address(token1)), 0.012 ether);
        assertTrue(_has(logs, ROUTED));
        assertEq(token0.balanceOf(address(hook)), 0, "hook keeps no input");
        assertEq(token1.balanceOf(address(hook)), 0, "hook keeps no output");
    }

    function test_zeroResidualDoesNotTouchMaker() public {
        _shipAndRegister();
        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(key, true, 0.4 ether, 0, taker);
        assertGt(out, 0);
        assertEq(token1.balanceOf(maker), maker1);
        assertFalse(_has(vm.getRecordedLogs(), ROUTED));
    }

    /// @notice Any v4 router works. PlainSwapper settles its input only after the swap returns.
    function test_genericRouterFillsFromDesk() public {
        _shipAndRegister();
        PlainSwapper plain = new PlainSwapper(manager);
        vm.prank(taker);
        token0.approve(address(plain), type(uint256).max);

        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = plain.swap(key, LARGE, taker);
        assertTrue(_has(vm.getRecordedLogs(), ROUTED), "desk filled through a generic router");
        assertEq(token1.balanceOf(maker), maker1 - 3.988 ether);
        assertGt(out, 3.988 ether);
    }

    /// @notice Uniswap's own PoolSwapTest router (settles after the swap) also gets the desk fill.
    function test_stockV4RouterFillsFromDesk() public {
        _shipAndRegister();
        PoolSwapTest swapRouter = new PoolSwapTest(manager);
        vm.prank(taker);
        token0.approve(address(swapRouter), type(uint256).max);
        uint256 maker1 = token1.balanceOf(maker);
        vm.prank(taker);
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(LARGE), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        assertEq(token1.balanceOf(maker), maker1 - 3.988 ether, "stock router swap pulled the shelf");
    }

    /// @notice When PoolManager holds less of the input than the residual, the pool fills everything.
    function test_thinReservesFallBackToPool() public {
        _shipAndRegister();
        PlainSwapper plain = new PlainSwapper(manager);
        token0.mint(taker, 100 ether);
        vm.prank(taker);
        token0.approve(address(plain), type(uint256).max);
        uint256 reserves = token0.balanceOf(address(manager));
        uint256 big = reserves + CAP + 1 ether;

        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        plain.swap(key, big, taker);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertTrue(_has(logs, WOULD_ROUTE));
        assertFalse(_has(logs, ROUTED));
        assertEq(token1.balanceOf(maker), maker1, "maker untouched");
    }

    // ------------------------------------------------------------ guards

    /// @notice The pool spot moves about 3%. The desk's static band would now overpay, so it is skipped.
    function test_stalePriceSkipsDesk() public {
        _shipAndRegister();
        PlainSwapper plain = new PlainSwapper(manager);
        token0.mint(address(this), 10 ether);
        token0.approve(address(plain), type(uint256).max);
        plain.swap(key, 0.8 ether, address(this)); // under the cap: pool only

        (uint256 deskOut,) = swapVm.preview(order, address(token0), address(token1), 4 ether);
        uint256 spotOut = 4 ether * hook.spotPriceX18(id) / 1e18;
        assertGt(deskOut * 10_000, spotOut * (10_000 + MAX_DEV), "band is above spot by more than 1%");

        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(key, true, LARGE, 0, taker);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertTrue(_skipped(logs, maker, OverflowHook.SkipReason.SpotDeviation));
        assertTrue(_has(logs, WOULD_ROUTE));
        assertEq(token1.balanceOf(maker), maker1, "stale desk was not picked off");
        assertGt(out, 0, "pool still filled the taker");
    }

    /// @notice Chainlink CRE reference: fail closed when missing or stale, skip when the desk disagrees.
    ///         Each case starts from the same state, because every fallback swap moves the pool price.
    function test_creReferenceGuard() public {
        _shipAndRegister();
        DeskPriceFeed feed = new DeskPriceFeed(address(this), address(this));
        hook.setPriceFeed(address(feed), 300);
        uint256 snap = vm.snapshotState();

        // Feed set but empty: fail closed.
        vm.recordLogs();
        vm.prank(taker);
        router.swapExactInput(key, true, 2 ether, 0, taker);
        assertTrue(_skipped(vm.getRecordedLogs(), address(0), OverflowHook.SkipReason.ReferenceStale), "empty");
        vm.revertToState(snap);

        // Off-chain market says 0.95: the desk at ~1.0 is more than 1% away.
        feed.onReport("", abi.encode(PoolId.unwrap(id), uint256(0.95e18), uint64(block.timestamp)));
        vm.recordLogs();
        vm.prank(taker);
        router.swapExactInput(key, true, 2 ether, 0, taker);
        assertTrue(_skipped(vm.getRecordedLogs(), maker, OverflowHook.SkipReason.ReferenceDeviation), "deviation");
        vm.revertToState(snap);

        // Market at 1.0: the desk fills.
        feed.onReport("", abi.encode(PoolId.unwrap(id), uint256(1e18), uint64(block.timestamp)));
        vm.recordLogs();
        vm.prank(taker);
        router.swapExactInput(key, true, 2 ether, 0, taker);
        assertTrue(_has(vm.getRecordedLogs(), ROUTED), "fresh and agreeing");

        // Same reference, 301 seconds later: fail closed again.
        vm.warp(block.timestamp + 301);
        vm.recordLogs();
        vm.prank(taker);
        router.swapExactInput(key, true, 2 ether, 0, taker);
        assertTrue(_skipped(vm.getRecordedLogs(), address(0), OverflowHook.SkipReason.ReferenceStale), "stale");
    }

    function test_feedRejectsStrangersAndRollbacks() public {
        DeskPriceFeed feed = new DeskPriceFeed(address(this), address(this));
        bytes memory report = abi.encode(PoolId.unwrap(id), uint256(1e18), uint64(block.timestamp));
        vm.prank(taker);
        vm.expectRevert(abi.encodeWithSelector(DeskPriceFeed.NotForwarder.selector, taker));
        feed.onReport("", report);
        feed.onReport("", report);
        vm.expectRevert();
        feed.onReport("", report); // same observation time cannot be replayed
        assertTrue(feed.supportsInterface(0x805f2132), "IReceiver interface id");
        assertTrue(feed.supportsInterface(0x01ffc9a7), "ERC165 interface id");
    }

    function test_unfundedMakerIsSkipped() public {
        _shipAndRegister();
        address sink = makeAddr("sink");
        uint256 all = token1.balanceOf(maker);
        vm.prank(maker);
        token1.transfer(sink, all); // shelf is virtual: the wallet is now empty

        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(key, true, LARGE, 0, taker);
        assertTrue(_skipped(vm.getRecordedLogs(), maker, OverflowHook.SkipReason.MakerUnfunded));
        assertGt(out, 0, "swap still completed through the pool");
    }

    function test_failedFillRefundsAndFallsBack() public {
        RevertingSwap bad = new RevertingSwap();
        OverflowHook badHook = _deployHook(address(bad), 0x6666);
        PoolKey memory k = key;
        k.hooks = IHooks(address(badHook));
        manager.initialize(k, TickMath.getSqrtPriceAtTick(0));
        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(k, ModifyLiquidityParams({tickLower: -12_000, tickUpper: 12_000, liquidityDelta: 50e18, salt: 0}), "");
        badHook.setPoolCap(k, CAP);
        _shipAs(maker, address(bad), strategy, SHIP);
        vm.prank(maker);
        badHook.registerDesk(k, order, MAX_DEV);

        uint256 managerBefore = token0.balanceOf(address(manager));
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(k, true, LARGE, 0, taker);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertGt(out, 0, "pool filled after the desk failed");
        assertEq(token0.balanceOf(address(manager)), managerBefore + LARGE, "residual went back to the pool");
        assertEq(token0.balanceOf(address(badHook)), 0);
        bool sawSwapFailed;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(badHook) && logs[i].topics[0] == SKIPPED) {
                sawSwapFailed = abi.decode(logs[i].data, (uint8)) == uint8(OverflowHook.SkipReason.SwapFailed);
            }
        }
        assertTrue(sawSwapFailed);
    }

    function test_reentrancyGuard() public {
        ReenteringSwap fake = new ReenteringSwap();
        OverflowHook guarded = _deployHook(address(fake), 0x5555);
        PoolKey memory other = key;
        other.hooks = IHooks(address(guarded));
        manager.initialize(other, TickMath.getSqrtPriceAtTick(0));
        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(other, ModifyLiquidityParams({tickLower: -12_000, tickUpper: 12_000, liquidityDelta: 50e18, salt: 0}), "");
        guarded.setPoolCap(other, CAP);
        fake.arm(manager, other);
        token1.mint(address(fake), 10 ether);

        _shipAs(maker, address(fake), strategy, SHIP);
        vm.prank(maker);
        guarded.registerDesk(other, order, MAX_DEV);

        vm.prank(taker);
        router.swapExactInput(other, true, LARGE, 0, taker);
        assertTrue(_containsSelector(fake.reentryRevert(), OverflowHook.Reentrancy.selector), "re-entry hit the guard");
    }

    // ------------------------------------------------------------ registry

    function test_registrationNeedsAShippedStrategy() public {
        address attacker = makeAddr("attacker");
        (DeskOrder memory bad,) = _fundMaker(attacker, 30, 1 ether);
        vm.prank(attacker);
        vm.expectRevert(OverflowHook.NotShipped.selector);
        hook.registerDesk(key, bad, MAX_DEV);
    }

    /// @notice The old single slot let anyone replace the honest maker. Now each maker has its own desk.
    function test_strangerCannotReplaceAnotherDesk() public {
        _shipAndRegister();
        address attacker = makeAddr("attacker");
        (DeskOrder memory o, bytes memory packed) = _fundMaker(attacker, 5_000, 1 ether);
        _shipAs(attacker, address(swapVm), packed, 1 ether);
        vm.prank(attacker);
        hook.registerDesk(key, o, MAX_DEV);

        assertEq(hook.deskCount(id), 2);
        (address still,,,) = hook.deskOf(id, maker);
        assertEq(still, maker, "honest desk survives");

        uint256 maker1 = token1.balanceOf(maker);
        vm.prank(taker);
        router.swapExactInput(key, true, LARGE, 0, taker);
        assertEq(token1.balanceOf(maker), maker1 - 3.988 ether, "honest desk still fills");
    }

    function test_bestQuoteWins() public {
        _shipAndRegister();
        address cheap = makeAddr("cheap");
        (DeskOrder memory o, bytes memory packed) = _fundMaker(cheap, 10, SHIP);
        _shipAs(cheap, address(swapVm), packed, SHIP);
        vm.prank(cheap);
        hook.registerDesk(key, o, MAX_DEV);

        vm.prank(taker);
        router.swapExactInput(key, true, LARGE, 0, taker);
        (address filledBy,,,, uint256 filled,,) = hook.lastFill(id);
        assertEq(filledBy, cheap, "10 bps desk beats 30 bps desk");
        assertEq(filled, 3.996 ether);
    }

    function test_registerRejectsMakerHooks() public {
        _ship();
        DeskOrder memory hooked = order;
        hooked.traits |= (1 << 252); // HAS_PRE_TRANSFER_IN_HOOK
        vm.prank(maker);
        vm.expectRevert(abi.encodeWithSelector(OverflowHook.InvalidTraits.selector, hooked.traits));
        hook.registerDesk(key, hooked, MAX_DEV);
    }

    function test_registerRejectsBadDeviation() public {
        _ship();
        vm.prank(maker);
        vm.expectRevert(abi.encodeWithSelector(OverflowHook.BadDeviation.selector, uint16(0)));
        hook.registerDesk(key, order, 0);
    }

    function test_evictionNeedsMoreLiveInventory() public {
        for (uint256 i = 0; i < hook.MAX_DESKS(); i++) {
            address m = makeAddr(string.concat("small", vm.toString(i)));
            (DeskOrder memory o, bytes memory packed) = _fundMaker(m, 30, 10 ether + i * 1 ether);
            _shipAs(m, address(swapVm), packed, 10 ether + i * 1 ether);
            vm.prank(m);
            hook.registerDesk(key, o, MAX_DEV);
        }
        assertEq(hook.deskCount(id), hook.MAX_DESKS());

        // Ships a huge virtual shelf but holds almost nothing: cannot evict.
        address bluff = makeAddr("bluff");
        (DeskOrder memory b, bytes memory bp) = _fundMaker(bluff, 30, 1 ether);
        _shipAs(bluff, address(swapVm), bp, 1_000_000 ether);
        vm.prank(bluff);
        vm.expectRevert();
        hook.registerDesk(key, b, MAX_DEV);

        // Real inventory evicts the smallest desk.
        _ship();
        vm.prank(maker);
        hook.registerDesk(key, order, MAX_DEV);
        (address added,,,) = hook.deskOf(id, maker);
        assertEq(added, maker);
        (address gone,,,) = hook.deskOf(id, makeAddr("small0"));
        assertEq(gone, address(0), "smallest desk evicted");
    }

    function test_clearDesk() public {
        _shipAndRegister();
        vm.prank(maker);
        hook.clearDesk(key);
        assertEq(hook.deskCount(id), 0);
        vm.recordLogs();
        vm.prank(taker);
        router.swapExactInput(key, true, LARGE, 0, taker);
        assertTrue(_has(vm.getRecordedLogs(), WOULD_ROUTE));
    }

    // ------------------------------------------------------------ oracle adapter

    function test_oracleAdapterIsStable() public {
        UniV4OracleAdapter oracle = new UniV4OracleAdapter(manager, key);
        OracleQuery memory query = OracleQuery({
            orderHash: bytes32(0),
            maker: maker,
            taker: taker,
            tokenIn: address(token0),
            tokenOut: address(token1),
            isExactIn: true
        });
        OracleRegisters memory reg =
            OracleRegisters({balanceIn: 0, balanceOut: 0, amountIn: 1 ether, amountOut: 0, amountNetPulled: 0});
        (,, OracleRegisters memory quoted) = oracle.extruction(true, 7, query, reg, "", "");
        (,, OracleRegisters memory swapped) = oracle.extruction(false, 7, query, reg, "", "");
        assertEq(quoted.amountOut, swapped.amountOut);
        assertEq(quoted.amountOut, 1 ether);
    }

    /// @dev The pool spot is 1.0 at tick 0, so 4 tokens in quote 4 tokens out.
    ///      DeskBand on equal shelves inside 0.99 to 1.01 at 30 bps quotes 3.988.
    ///      Replacing the program with this adapter would drop the maker's fee and band.
    function test_poolSpotDoesNotReplaceDeskQuote() public {
        _ship();
        (uint256 deskOut,) = swapVm.preview(order, address(token0), address(token1), 4 ether);
        assertEq(deskOut, 3.988 ether);
        UniV4OracleAdapter oracle = new UniV4OracleAdapter(manager, key);
        OracleQuery memory query = OracleQuery({
            orderHash: bytes32(0),
            maker: maker,
            taker: taker,
            tokenIn: address(token0),
            tokenOut: address(token1),
            isExactIn: true
        });
        OracleRegisters memory reg =
            OracleRegisters({balanceIn: 0, balanceOut: 0, amountIn: 4 ether, amountOut: 0, amountNetPulled: 0});
        (,, OracleRegisters memory spot) = oracle.extruction(true, 0, query, reg, "", "");
        assertEq(spot.amountOut, 4 ether);
        assertTrue(spot.amountOut != deskOut);
    }

    function _containsSelector(bytes memory reason, bytes4 selector) internal pure returns (bool) {
        if (reason.length < 4) return false;
        for (uint256 i = 0; i + 4 <= reason.length; i++) {
            bytes4 found;
            assembly {
                found := mload(add(add(reason, 0x20), i))
            }
            if (found == selector) return true;
        }
        return false;
    }
}

contract OverflowLocalTest is OverflowFixture {
    function setUp() public {
        _bootstrap(IPoolManager(address(new PoolManager(address(this)))), IAqua(deployCode("Aqua.sol:Aqua")));
    }
}

/// @notice Same suite against the live Unichain PoolManager and the live Aqua registry.
/// @dev Forks a few blocks behind the head: the public RPC is load balanced, and a node that has not seen
///      the newest block answers "block not found". Set UNICHAIN_FORK_BLOCK to pin a block.
contract OverflowForkTest is OverflowFixture {
    function setUp() public {
        uint256 pinned = vm.envOr("UNICHAIN_FORK_BLOCK", uint256(0));
        if (pinned != 0) {
            vm.createSelectFork("unichain", pinned);
        } else {
            vm.createSelectFork("unichain");
            vm.rollFork(block.number - 10);
        }
        IPoolManager liveManager = IPoolManager(Addresses.UNICHAIN_POOL_MANAGER);
        IAqua liveAqua = IAqua(Addresses.AQUA);
        require(address(liveManager).code.length > 0, "Unichain PoolManager has no code");
        require(address(liveAqua).code.length > 0, "Aqua registry has no code");
        require(Addresses.AQUA_SWAP_VM_ROUTER.code.length > 0, "canonical SwapVM router missing");
        _bootstrap(liveManager, liveAqua);
    }
}
