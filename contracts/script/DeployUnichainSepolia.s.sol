// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {Addresses} from "../src/Addresses.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";

/// @notice Deploy the desk onto Unichain Sepolia. Keys stay in the environment. This file does not broadcast by itself.
/// @dev Canonical PoolManager is Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER (0x00B036...62AC), the address on
///      https://developers.uniswap.org/docs/protocols/v4/deployments (checked 5 Nov 2026). POOL_MANAGER overrides it.
///      The other live contract, Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT, is logged and not selected.
///
///      forge script script/DeployUnichainSepolia.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC
///      Add --broadcast only when you are ready to spend the key in PRIVATE_KEY.
contract DeployUnichainSepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER);
        address aqua = vm.envOr("AQUA", Addresses.AQUA);
        address weth = vm.envOr("WETH", Addresses.UNICHAIN_WETH);
        address owner = vm.envOr("OWNER", vm.addr(pk));
        address usdc = vm.envOr("UNICHAIN_USDC", Addresses.UNICHAIN_SEPOLIA_USDC);
        address messenger = vm.envOr("CCTP_TOKEN_MESSENGER", Addresses.CCTP_V2_TOKEN_MESSENGER_TESTNET);

        require(block.chainid == Addresses.UNICHAIN_SEPOLIA_CHAIN_ID, "this script is for Unichain Sepolia (1301)");
        require(poolManager.code.length > 0, "POOL_MANAGER has no code on this RPC");
        require(aqua.code.length > 0, "AQUA has no code on this RPC");
        require(usdc.code.length > 0, "UNICHAIN_USDC has no code");
        require(messenger.code.length > 0, "CCTP messenger has no code");

        console2.log("chainId", block.chainid);
        console2.log("PoolManager", poolManager);
        console2.log("canonical", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER);
        console2.log("alt (not selected)", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT);
        if (poolManager == Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT) {
            console2.log("warning: POOL_MANAGER is the non-canonical contract");
        }
        console2.log("Aqua", aqua);
        console2.log("USDC", usdc);
        console2.log("CCTP TokenMessengerV2", messenger);

        vm.startBroadcast(pk);
        address swapVm = _deployRouter(aqua, weth, owner);
        vm.stopBroadcast();

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        bytes memory ctorArgs = abi.encode(poolManager, swapVm, bytes32(0));
        // Call the Arachnid factory directly so simulation and broadcast use the same deployer.
        (address predicted, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(OverflowHook).creationCode, ctorArgs);

        vm.startBroadcast(pk);
        bytes memory hookInit = abi.encodePacked(type(OverflowHook).creationCode, ctorArgs);
        (bool created,) = CREATE2_FACTORY.call(abi.encodePacked(salt, hookInit));
        require(created, "hook create2 failed");
        OverflowHook hook = OverflowHook(predicted);
        require(address(hook).code.length > 0, "hook missing");
        OverflowRouter router = new OverflowRouter(IPoolManager(poolManager));
        hook.setOverflowRouter(address(router));
        address bridge = _deployArtifact("CctpFeeBridge.sol:CctpFeeBridge", abi.encode(usdc, messenger, owner));
        vm.stopBroadcast();

        console2.log("WalletDeskRouter", swapVm);
        console2.log("OverflowHook", address(hook));
        console2.log("OverflowRouter", address(router));
        console2.log("CctpFeeBridge", bridge);
        console2.log("Arc domain", uint256(Addresses.CCTP_DOMAIN_ARC));
    }

    /// @dev The router and the CCTP bridge are compiled as 0.8.30. This script is 0.8.26, so it deploys artifacts.
    function _deployRouter(address aqua, address weth, address owner) internal returns (address deployed) {
        deployed = _deployArtifact("WalletDeskRouter.sol:WalletDeskRouter", abi.encode(aqua, weth, owner));
    }

    function _deployArtifact(string memory artifact, bytes memory args) internal returns (address deployed) {
        bytes memory initcode = abi.encodePacked(vm.getCode(artifact), args);
        assembly {
            deployed := create(0, add(initcode, 0x20), mload(initcode))
        }
        require(deployed != address(0), "artifact deploy failed");
    }
}
