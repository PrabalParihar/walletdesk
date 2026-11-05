// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {Addresses} from "../src/Addresses.sol";

/// @notice Deploy CctpFeeBridge on Unichain Sepolia. Independent of Aqua, so it works even though Aqua is not
///         deployed on that testnet. Nothing broadcasts unless you pass --broadcast yourself.
///
///      forge script script/DeployCctpBridge.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC --slow
contract DeployCctpBridge is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        address usdc = vm.envOr("UNICHAIN_USDC", Addresses.UNICHAIN_SEPOLIA_USDC);
        address messenger = vm.envOr("CCTP_TOKEN_MESSENGER", Addresses.CCTP_V2_TOKEN_MESSENGER_TESTNET);

        require(block.chainid == Addresses.UNICHAIN_SEPOLIA_CHAIN_ID, "this script is for Unichain Sepolia (1301)");
        require(usdc.code.length > 0, "UNICHAIN_USDC has no code");
        require(messenger.code.length > 0, "CCTP messenger has no code");

        vm.startBroadcast(pk);
        bytes memory initcode =
            abi.encodePacked(vm.getCode("CctpFeeBridge.sol:CctpFeeBridge"), abi.encode(usdc, messenger, owner));
        address bridge;
        assembly ("memory-safe") {
            bridge := create(0, add(initcode, 0x20), mload(initcode))
        }
        require(bridge != address(0), "bridge deploy failed");
        vm.stopBroadcast();

        console2.log("CctpFeeBridge", bridge);
        console2.log("USDC", usdc);
        console2.log("CCTP TokenMessengerV2", messenger);
        console2.log("Arc domain", uint256(Addresses.CCTP_DOMAIN_ARC));
    }
}
