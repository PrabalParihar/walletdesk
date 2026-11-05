// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Aqua} from "@1inch/aqua/contracts/Aqua.sol";
import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";
import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {MakerTraits} from "@1inch/swap-vm/src/libs/MakerTraits.sol";

import {DeskBandMath} from "../src/swapvm/DeskBandMath.sol";
import {WalletDeskRouter} from "../src/swapvm/WalletDeskRouter.sol";
import {OrderBuilder} from "../src/swapvm/OrderBuilder.sol";
import {Addresses} from "../src/Addresses.sol";

contract DeskBandTest is Test {
    uint256 internal constant SHIP = 1_000 ether;

    Aqua internal aqua;
    WalletDeskRouter internal router;
    OrderBuilder internal builder;
    MockERC20 internal token0;
    MockERC20 internal token1;
    address internal maker = makeAddr("maker");
    address internal taker = makeAddr("taker");

    function setUp() public {
        aqua = new Aqua();
        router = new WalletDeskRouter(address(aqua), Addresses.UNICHAIN_WETH, address(this));
        builder = new OrderBuilder();
        MockERC20 a = new MockERC20("Desk A", "DA", 18);
        MockERC20 b = new MockERC20("Desk B", "DB", 18);
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
        token0.mint(maker, SHIP);
        token1.mint(maker, SHIP);
        token0.mint(taker, 20 ether);
        vm.startPrank(maker);
        token0.approve(address(aqua), type(uint256).max);
        token1.approve(address(aqua), type(uint256).max);
        vm.stopPrank();
        vm.prank(taker);
        token0.approve(address(router), type(uint256).max);
    }

    function test_takerDataMatchesHookConstant() public view {
        bytes memory built = builder.standardTakerData();
        assertEq(built, hex"00000000000000000000000000000000000000000041");
        assertEq(built.length, 22);
        assertEq(router.instructionCount(), 1);
    }

    function test_buildBandUsesTheCallerPrices() public view {
        (uint256 traits, bytes memory data, bytes memory strategy) =
            builder.buildBand(maker, 0.5 ether, 1.5 ether, 30, uint32(block.timestamp), 0);
        (uint256 sameTraits,, bytes memory sameStrategy) = builder.build(maker, 30, uint32(block.timestamp), 0);
        assertTrue(traits != 0 && data.length > 0);
        assertTrue(keccak256(strategy) != keccak256(sameStrategy));
    }

    function test_math() public view {
        DeskBandMath.Quote memory q = DeskBandMath.quoteExactIn(
            SHIP, SHIP, 4 ether, true, 0.99 ether, 1.01 ether, 30, uint32(block.timestamp), 0, block.timestamp
        );
        assertEq(q.priceX18, 1 ether);
        assertEq(q.feeOut, 0.012 ether);
        assertEq(q.amountOut, 3.988 ether);
    }

    /// @notice WETH (18 decimals) as token0, USDC (6 decimals) as token1, band 2990 to 3010 USDC per WETH.
    ///         Price unit is raw token1 per raw token0 * 1e18, so 3000 USDC/WETH is 3000e6.
    ///         Before the fix the same band priced both directions with `amountIn * price`, which paid
    ///         9 wei of WETH for 3000 USDC. Both directions must now clear near 3000.
    function test_bothDirectionsWithMixedDecimals() public view {
        uint256 low = 2990e6;
        uint256 high = 3010e6;
        uint256 shelfWeth = 10 ether;
        uint256 shelfUsdc = 30_000e6;

        // Sell 1 WETH (token0 -> token1).
        DeskBandMath.Quote memory sellWeth = DeskBandMath.quoteExactIn(
            shelfWeth, shelfUsdc, 1 ether, true, low, high, 0, uint32(block.timestamp), 0, block.timestamp
        );
        assertEq(sellWeth.priceX18, 3000e6, "balanced shelf quotes the band mid");
        assertEq(sellWeth.amountOut, 3000e6, "1 WETH -> 3000 USDC");

        // Sell 3000 USDC (token1 -> token0). balanceIn is USDC, balanceOut is WETH.
        DeskBandMath.Quote memory sellUsdc = DeskBandMath.quoteExactIn(
            shelfUsdc, shelfWeth, 3000e6, false, low, high, 0, uint32(block.timestamp), 0, block.timestamp
        );
        assertEq(sellUsdc.amountOut, 1 ether, "3000 USDC -> 1 WETH");
    }

    /// @notice Inventory weight is by value, not raw units. A shelf with 1,000,000 USDC and 0.01 WETH is
    ///         almost all USDC by value, so selling USDC for WETH must quote near the band's high price
    ///         (least WETH per USDC). Raw-unit weighting pinned it to the wrong edge.
    function test_weightIsByValueNotRawUnits() public view {
        uint256 price = DeskBandMath.bandPrice(0.01 ether, 1_000_000e6, 2990e6, 3010e6);
        assertGt(price, 3009e6, "token1-heavy shelf sits near priceHigh");
        uint256 priceWethHeavy = DeskBandMath.bandPrice(1_000 ether, 1e6, 2990e6, 3010e6);
        assertLt(priceWethHeavy, 2991e6, "token0-heavy shelf sits near priceLow");
    }

    /// @notice As a side drains the quote gets worse for the taker, in both directions.
    function test_quoteWorsensAsShelfDrains() public view {
        DeskBandMath.Quote memory full = DeskBandMath.quoteExactIn(
            SHIP, SHIP, 1 ether, true, 0.9 ether, 1.1 ether, 0, 0, 0, block.timestamp
        );
        DeskBandMath.Quote memory drained = DeskBandMath.quoteExactIn(
            SHIP, 100 ether, 1 ether, true, 0.9 ether, 1.1 ether, 0, 0, 0, block.timestamp
        );
        assertLt(drained.amountOut, full.amountOut, "less token1 left: less token1 per token0");

        DeskBandMath.Quote memory fullRev = DeskBandMath.quoteExactIn(
            SHIP, SHIP, 1 ether, false, 0.9 ether, 1.1 ether, 0, 0, 0, block.timestamp
        );
        DeskBandMath.Quote memory drainedRev = DeskBandMath.quoteExactIn(
            SHIP, 100 ether, 1 ether, false, 0.9 ether, 1.1 ether, 0, 0, 0, block.timestamp
        );
        assertLt(drainedRev.amountOut, fullRev.amountOut, "less token0 left: less token0 per token1");
    }

    function test_reverseDirectionQuoteMatchesSwap() public {
        (ISwapVM.Order memory order, bytes memory strategy) = _order(30, uint32(block.timestamp), 0);
        vm.prank(maker);
        aqua.ship(address(router), strategy, _tokens(), _amounts());
        token1.mint(taker, 10 ether);
        vm.prank(taker);
        token1.approve(address(router), type(uint256).max);
        bytes memory takerData = builder.standardTakerData();
        (, uint256 quotedOut,) = router.quote(order, address(token1), address(token0), 4 ether, takerData);
        (uint256 previewOut,) = router.preview(order, address(token1), address(token0), 4 ether);
        assertEq(quotedOut, previewOut, "preview and VM agree in the token1 -> token0 direction");
        assertEq(previewOut, 3.988 ether);
        vm.prank(taker);
        (, uint256 gotOut,) = router.swap(order, address(token1), address(token0), 4 ether, takerData);
        assertEq(gotOut, quotedOut);
    }

    function test_shipDoesNotMoveWallet_quoteMatchesSwap() public {
        (ISwapVM.Order memory order, bytes memory strategy) = _order(30, uint32(block.timestamp), 0);
        uint256 before0 = token0.balanceOf(maker);
        uint256 before1 = token1.balanceOf(maker);

        vm.prank(maker);
        bytes32 strategyHash = aqua.ship(address(router), strategy, _tokens(), _amounts());
        assertEq(strategyHash, keccak256(strategy));
        assertEq(token0.balanceOf(maker), before0);
        assertEq(token1.balanceOf(maker), before1);

        bytes memory takerData = builder.standardTakerData();
        (uint256 quotedIn, uint256 quotedOut,) =
            router.quote(order, address(token0), address(token1), 4 ether, takerData);
        assertEq(quotedIn, 4 ether);
        assertEq(quotedOut, 3.988 ether);

        uint256 maker1 = token1.balanceOf(maker);
        uint256 maker0 = token0.balanceOf(maker);
        vm.prank(taker);
        (uint256 gotIn, uint256 gotOut,) = router.swap(order, address(token0), address(token1), 4 ether, takerData);
        assertEq(gotOut, quotedOut);
        assertEq(gotIn, quotedIn);
        assertEq(token1.balanceOf(maker), maker1 - gotOut);
        assertEq(token0.balanceOf(maker), maker0 + gotIn);
    }

    function test_decay() public {
        (ISwapVM.Order memory order, bytes memory strategy) = _order(30, uint32(block.timestamp), 100);
        vm.prank(maker);
        aqua.ship(address(router), strategy, _tokens(), _amounts());
        vm.warp(block.timestamp + 100);
        (uint256 amountOut, uint256 feeOut) = router.preview(order, address(token0), address(token1), 4 ether);
        assertEq(amountOut, 1.994 ether);
        assertEq(feeOut, 0.006 ether);
    }

    function _order(uint16 feeBps, uint32 start, uint32 halfLife)
        internal
        view
        returns (ISwapVM.Order memory order, bytes memory strategy)
    {
        (uint256 traits, bytes memory data, bytes memory packed) = builder.build(maker, feeBps, start, halfLife);
        order = ISwapVM.Order({maker: maker, traits: MakerTraits.wrap(traits), data: data});
        strategy = packed;
        assertEq(strategy, abi.encode(order));
    }

    function _tokens() internal view returns (address[] memory tokens) {
        tokens = new address[](2);
        tokens[0] = address(token0);
        tokens[1] = address(token1);
    }

    function _amounts() internal pure returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = SHIP;
        amounts[1] = SHIP;
    }
}
