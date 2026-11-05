// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {CctpFeeBridge} from "../src/CctpFeeBridge.sol";

contract MockMessenger {
    uint256 public amount;
    uint32 public domain;
    bytes32 public recipient;
    address public burnToken;
    uint256 public maxFee;
    uint32 public finality;
    bytes public hookData;

    function depositForBurnWithHook(
        uint256 amount_,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken_,
        bytes32,
        uint256 maxFee_,
        uint32 minFinalityThreshold,
        bytes calldata hookData_
    ) external {
        amount = amount_;
        domain = destinationDomain;
        recipient = mintRecipient;
        burnToken = burnToken_;
        maxFee = maxFee_;
        finality = minFinalityThreshold;
        hookData = hookData_;
        MockERC20(burnToken_).burn(msg.sender, amount_);
    }
}

contract CctpFeeBridgeTest is Test {
    MockERC20 internal usdc;
    MockMessenger internal messenger;
    CctpFeeBridge internal bridge;
    address internal owner = makeAddr("owner");
    address internal maker = makeAddr("maker");
    bytes32 internal fillId = keccak256("fill");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        messenger = new MockMessenger();
        bridge = new CctpFeeBridge(address(usdc), address(messenger), owner);
        usdc.mint(owner, 1_000_000e6);
        vm.prank(owner);
        usdc.approve(address(bridge), type(uint256).max);
    }

    function test_bridgeBurnsToArcDomainWithFillHookData() public {
        bytes32 recipient = bytes32(uint256(uint160(makeAddr("treasury"))));
        vm.prank(owner);
        bridge.bridgeFee(fillId, maker, 12_000, recipient, 0, 0);

        assertEq(messenger.amount(), 12_000);
        assertEq(messenger.domain(), 26);
        assertEq(messenger.recipient(), recipient);
        assertEq(messenger.burnToken(), address(usdc));
        assertEq(messenger.finality(), 2000);
        assertEq(usdc.balanceOf(address(bridge)), 0);
        assertEq(usdc.balanceOf(owner), 1_000_000e6 - 12_000);

        (bytes32 decodedFill, address decodedMaker) = abi.decode(messenger.hookData(), (bytes32, address));
        assertEq(decodedFill, fillId);
        assertEq(decodedMaker, maker);
    }

    function test_strangerCannotBridge() public {
        vm.expectRevert(CctpFeeBridge.NotOwner.selector);
        bridge.bridgeFee(fillId, maker, 1, bytes32(uint256(1)), 0, 1000);
    }
}
