// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {Addresses} from "../src/Addresses.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";

/// @notice Deploy the desk onto Unichain Sepolia. Keys stay in the environment.
/// @dev Two PoolManager addresses currently have code on chain 1301. This script does not pick one.
///      Set POOL_MANAGER yourself. hookmate's candidate is Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_HOOKMATE.
///      The other documented candidate is Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT.
///
///      forge script script/DeployUnichainSepolia.s.sol \
///        --rpc-url $UNICHAIN_SEPOLIA_RPC --broadcast --slow
contract DeployUnichainSepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address aqua = vm.envOr("AQUA", Addresses.AQUA);
        address weth = vm.envOr("WETH", Addresses.UNICHAIN_WETH);
        address owner = vm.envOr("OWNER", vm.addr(pk));

        require(poolManager.code.length > 0, "POOL_MANAGER has no code on this RPC");
        require(aqua.code.length > 0, "AQUA has no code on this RPC");

        console2.log("chainId", block.chainid);
        console2.log("PoolManager", poolManager);
        console2.log("hookmate candidate", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_HOOKMATE);
        console2.log("alt candidate", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT);
        console2.log("Aqua", aqua);

        vm.startBroadcast(pk);
        address swapVm = _deployRouter(aqua, weth, owner);
        vm.stopBroadcast();

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        bytes memory ctorArgs = abi.encode(poolManager, swapVm, bytes32(0));
        (address predicted, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(OverflowHook).creationCode, ctorArgs);

        vm.startBroadcast(pk);
        OverflowHook hook = new OverflowHook{salt: salt}(IPoolManager(poolManager), swapVm, bytes32(0));
        require(address(hook) == predicted, "CREATE2 address mismatch");
        OverflowRouter router = new OverflowRouter(IPoolManager(poolManager));
        hook.setOverflowRouter(address(router));
        vm.stopBroadcast();

        console2.log("WalletDeskRouter", swapVm);
        console2.log("OverflowHook", address(hook));
        console2.log("OverflowRouter", address(router));
    }

    /// @dev The router is compiled as 0.8.30 with SwapVM. This script is 0.8.26 with v4, so it deploys the artifact.
    function _deployRouter(address aqua, address weth, address owner) internal returns (address deployed) {
        bytes memory initcode =
            abi.encodePacked(vm.getCode("WalletDeskRouter.sol:WalletDeskRouter"), abi.encode(aqua, weth, owner));
        assembly {
            deployed := create(0, add(initcode, 0x20), mload(initcode))
        }
        require(deployed != address(0), "WalletDeskRouter deploy failed");
    }
}
