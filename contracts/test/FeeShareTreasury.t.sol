// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {FeeShareTreasury} from "../src/FeeShareTreasury.sol";

contract FeeShareTreasuryTest is Test {
    FeeShareTreasury internal treasury;
    MockERC20 internal usdc;
    address internal attestor = makeAddr("attestor");
    address internal maker = makeAddr("maker");
    address internal protocol = makeAddr("protocol");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        treasury = new FeeShareTreasury(address(usdc), attestor, address(this));
        usdc.mint(address(this), 1_000_000e6);
        usdc.approve(address(treasury), type(uint256).max);
    }

    function test_depositAndClaim() public {
        treasury.deposit(1_000e6);
        bytes32 fillId = keccak256("fill-1");
        vm.prank(attestor);
        treasury.creditFromFill(fillId, maker, 1_000e6);

        assertEq(treasury.claimable(maker), 1_000e6);
        assertEq(treasury.claimableNativeUnits(maker), 1_000e6 * 1e12);

        uint256 beforeBal = usdc.balanceOf(maker);
        vm.prank(maker);
        treasury.claim();
        assertEq(usdc.balanceOf(maker), beforeBal + 1_000e6);
        assertEq(treasury.claimable(maker), 0);
    }

    function test_splitPaysProtocol() public {
        treasury.setSplit(protocol, 1_000);
        treasury.deposit(10_000e6);
        vm.prank(attestor);
        treasury.creditFromFill(keccak256("fill-2"), maker, 10_000e6);
        assertEq(treasury.claimable(maker), 9_000e6);
        assertEq(treasury.claimable(protocol), 1_000e6);

        vm.prank(protocol);
        treasury.claim();
        assertEq(usdc.balanceOf(protocol), 1_000e6);
    }

    function test_rejectsDoubleCreditAndStrangers() public {
        treasury.deposit(100e6);
        bytes32 fillId = keccak256("fill-3");
        vm.prank(attestor);
        treasury.creditFromFill(fillId, maker, 50e6);

        vm.prank(attestor);
        vm.expectRevert(abi.encodeWithSelector(FeeShareTreasury.AlreadyCredited.selector, fillId));
        treasury.creditFromFill(fillId, maker, 50e6);

        vm.expectRevert(FeeShareTreasury.NotAttestor.selector);
        treasury.creditFromFill(keccak256("other"), maker, 10e6);
    }

    function test_rejectsNativeValueAndZeroAddress() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(treasury).call{value: 1}("");
        assertFalse(ok);

        treasury.deposit(10e6);
        vm.prank(attestor);
        vm.expectRevert(FeeShareTreasury.ZeroAddress.selector);
        treasury.creditFromFill(keccak256("zero"), address(0), 10e6);

        vm.expectRevert(FeeShareTreasury.ZeroAddress.selector);
        treasury.setSplit(address(0), 100);
    }

    function test_insolventCreditReverts() public {
        vm.prank(attestor);
        vm.expectRevert();
        treasury.creditFromFill(keccak256("dry"), maker, 1);
    }

    function test_claimWithoutCreditReverts() public {
        vm.prank(maker);
        vm.expectRevert(FeeShareTreasury.NothingToClaim.selector);
        treasury.claim();
    }
}
