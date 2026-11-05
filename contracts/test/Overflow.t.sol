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
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {DeskOrder, IDeskSwapVM} from "../src/interfaces/IDeskSwapVM.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";
import {UniV4OracleAdapter, OracleQuery, OracleRegisters} from "../src/UniV4OracleAdapter.sol";
import {Addresses} from "../src/Addresses.sol";

interface IOrderBuilder {
    function build(address maker, uint16 feeBps, uint32 start, uint32 halfLife)
        external
        pure
        returns (uint256 traits, bytes memory data, bytes memory strategy);
}

contract PlainSwapper is IUnlockCallback {
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function swap(PoolKey calldata key, uint256 amountIn, address recipient) external returns (uint256 amountOut) {
        MockERC20(Currency.unwrap(key.currency0)).transferFrom(msg.sender, address(this), amountIn);
        amountOut = abi.decode(manager.unlock(abi.encode(key, amountIn, recipient)), (uint256));
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

contract ReenteringSwap is IDeskSwapVM {
    IPoolManager public manager;
    PoolKey public key;

    function arm(IPoolManager manager_, PoolKey calldata key_) external {
        manager = manager_;
        key = key_;
    }

    function preview(DeskOrder calldata, address, address, uint256) external pure returns (uint256, uint256) {
        return (1 ether, 0);
    }

    function swap(DeskOrder calldata, address, address, uint256, bytes calldata)
        external
        returns (uint256, uint256, bytes32)
    {
        manager.swap(
            key,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(0.01 ether),
                sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            ""
        );
        return (0, 1 ether, bytes32(0));
    }
}

abstract contract OverflowFixture is Test {
    using PoolIdLibrary for PoolKey;

    uint256 internal constant SHIP = 1_000 ether;
    uint256 internal constant CAP = 1 ether;
    uint256 internal constant LARGE = 5 ether;

    IPoolManager internal manager;
    IAqua internal aqua;
    IDeskSwapVM internal swapVm;
    IOrderBuilder internal builder;
    OverflowRouter internal router;
    OverflowHook internal hook;
    MockERC20 internal token0;
    MockERC20 internal token1;
    PoolKey internal key;
    address internal maker;
    address internal taker;
    DeskOrder internal order;
    bytes internal strategy;

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

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        address hookAddr = address(flags ^ (uint160(0x4444) << 144));
        deployCodeTo(
            "OverflowHook.sol:OverflowHook", abi.encode(address(manager), address(swapVm), bytes32(0)), hookAddr
        );
        hook = OverflowHook(hookAddr);
        router = new OverflowRouter(manager);
        hook.setOverflowRouter(address(router));

        MockERC20 a = new MockERC20("Desk A", "DA", 18);
        MockERC20 b = new MockERC20("Desk B", "DB", 18);
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);

        key = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        manager.initialize(key, TickMath.getSqrtPriceAtTick(0));

        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.mint(address(this), 1_000_000 ether);
        token1.mint(address(this), 1_000_000 ether);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: int256(50e18), salt: bytes32(0)}),
            ""
        );

        maker = makeAddr("maker");
        taker = makeAddr("taker");
        token0.mint(maker, SHIP);
        token1.mint(maker, SHIP);
        token0.mint(taker, 100 ether);
        vm.startPrank(maker);
        token0.approve(address(aqua), type(uint256).max);
        token1.approve(address(aqua), type(uint256).max);
        vm.stopPrank();
        vm.prank(taker);
        token0.approve(address(router), type(uint256).max);

        (uint256 traits, bytes memory data, bytes memory packed) = builder.build(maker, 30, uint32(block.timestamp), 0);
        order = DeskOrder({maker: maker, traits: traits, data: data});
        strategy = packed;
    }

    function _ship() internal returns (bytes32 strategyHash) {
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        tokens[0] = address(token0);
        tokens[1] = address(token1);
        amounts[0] = SHIP;
        amounts[1] = SHIP;
        uint256 bal0 = token0.balanceOf(maker);
        uint256 bal1 = token1.balanceOf(maker);
        vm.prank(maker);
        strategyHash = aqua.ship(address(swapVm), strategy, tokens, amounts);
        assertEq(token0.balanceOf(maker), bal0, "ship moved token0");
        assertEq(token1.balanceOf(maker), bal1, "ship moved token1");
    }

    function _hasTopic(Vm.Log[] memory logs, bytes32 topic) internal pure returns (bool) {
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == topic) return true;
        }
        return false;
    }

    function test_overflowFillPullsMakerWallet() public {
        _ship();
        vm.prank(maker);
        hook.registerDesk(key, order, CAP);

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

        (address fillMaker,,, uint256 residual, uint256 filled, uint256 fee, bytes32 fillId) = hook.lastFill(key.toId());
        assertEq(fillMaker, maker);
        assertEq(residual, 4 ether);
        assertEq(filled, 3.988 ether);
        assertEq(fee, 0.012 ether);
        assertTrue(fillId != bytes32(0));
        assertEq(hook.accruedFees(maker, address(token1)), 0.012 ether);
        assertTrue(_hasTopic(logs, keccak256("OverflowRouted(bytes32,address,uint256,uint256)")));
        assertTrue(_hasTopic(logs, keccak256("Pulled(address,address,bytes32,address,uint256)")));
        assertTrue(_hasTopic(logs, keccak256("Pushed(address,address,bytes32,address,uint256)")));
    }

    function test_zeroResidualDoesNotTouchMaker() public {
        _ship();
        vm.prank(maker);
        hook.registerDesk(key, order, CAP);
        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = router.swapExactInput(key, true, 0.4 ether, 0, taker);
        assertGt(out, 0);
        assertEq(token1.balanceOf(maker), maker1);
        assertFalse(_hasTopic(vm.getRecordedLogs(), keccak256("OverflowRouted(bytes32,address,uint256,uint256)")));
    }

    function test_untrustedCallerEmitsWouldRoute() public {
        _ship();
        vm.prank(maker);
        hook.registerDesk(key, order, CAP);
        PlainSwapper plain = new PlainSwapper(manager);
        token0.mint(taker, LARGE);
        vm.prank(taker);
        token0.approve(address(plain), type(uint256).max);

        uint256 maker1 = token1.balanceOf(maker);
        vm.recordLogs();
        vm.prank(taker);
        uint256 out = plain.swap(key, LARGE, taker);
        assertGt(out, 0);
        assertEq(token1.balanceOf(maker), maker1, "untrusted swap must not pull the maker");
        assertTrue(_hasTopic(vm.getRecordedLogs(), keccak256("WouldRoute(bytes32,uint256)")));
    }

    function test_reentrancyGuard() public {
        ReenteringSwap fake = new ReenteringSwap();
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        address hookAddr = address(flags ^ (uint160(0x5555) << 144));
        deployCodeTo("OverflowHook.sol:OverflowHook", abi.encode(address(manager), address(fake), bytes32(0)), hookAddr);
        OverflowHook guarded = OverflowHook(hookAddr);
        OverflowRouter entry = new OverflowRouter(manager);
        guarded.setOverflowRouter(address(entry));

        PoolKey memory other = key;
        other.hooks = IHooks(address(guarded));
        manager.initialize(other, TickMath.getSqrtPriceAtTick(0));
        fake.arm(manager, other);

        vm.prank(maker);
        guarded.registerDesk(other, order, CAP);
        token0.mint(taker, LARGE);
        vm.prank(taker);
        token0.approve(address(entry), type(uint256).max);

        vm.prank(taker);
        try entry.swapExactInput(other, true, LARGE, 0, taker) returns (uint256) {
            revert("reentrant swap should revert");
        } catch (bytes memory reason) {
            // PoolManager wraps the hook revert. The Reentrancy selector is still in the payload.
            assertTrue(_containsSelector(reason, OverflowHook.Reentrancy.selector));
        }
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
        OracleRegisters memory reg = OracleRegisters({
            balanceIn: 0,
            balanceOut: 0,
            amountIn: 1 ether,
            amountOut: 0,
            amountNetPulled: 0
        });
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
        OracleRegisters memory reg = OracleRegisters({
            balanceIn: 0,
            balanceOut: 0,
            amountIn: 4 ether,
            amountOut: 0,
            amountNetPulled: 0
        });
        (,, OracleRegisters memory spot) = oracle.extruction(true, 0, query, reg, "", "");
        assertEq(spot.amountOut, 4 ether);
        assertTrue(spot.amountOut != deskOut);
    }
}

contract OverflowLocalTest is OverflowFixture {
    function setUp() public {
        _bootstrap(
            IPoolManager(address(new PoolManager(address(this)))),
            IAqua(deployCode("Aqua.sol:Aqua"))
        );
    }
}

contract OverflowForkTest is OverflowFixture {
    function setUp() public {
        vm.createSelectFork("unichain");
        IPoolManager liveManager = IPoolManager(Addresses.UNICHAIN_POOL_MANAGER);
        IAqua liveAqua = IAqua(Addresses.AQUA);
        require(address(liveManager).code.length > 0, "Unichain PoolManager has no code");
        require(address(liveAqua).code.length > 0, "Aqua registry has no code");
        require(Addresses.AQUA_SWAP_VM_ROUTER.code.length > 0, "canonical SwapVM router missing");
        _bootstrap(liveManager, liveAqua);
    }
}
