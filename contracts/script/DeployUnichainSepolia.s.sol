// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {Addresses} from "../src/Addresses.sol";
import {DeskPriceFeed} from "../src/DeskPriceFeed.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";
import {DeskDeployBase} from "./DeskDeployBase.sol";

/// @notice Deploy the desk onto Unichain Sepolia. Keys stay in the environment. Nothing broadcasts unless you
///         pass --broadcast yourself.
/// @dev Aqua is NOT deployed on Unichain Sepolia (code size 0 at 0x1111113C...6a90a, checked 6 Nov 2026).
///      Set DEPLOY_AQUA=true to deploy the unmodified 1inch Aqua registry from contracts/lib/aqua (the Aqua
///      Source License allows deploying unmodified code; hackathon use is non-commercial), or set AQUA to a
///      registry you already deployed. The CCTP bridge is a separate script: DeployCctpBridge.s.sol.
///
///      Canonical PoolManager is Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER (0x00B036...62AC). POOL_MANAGER overrides it.
///
///      DEPLOY_AQUA=true forge script script/DeployUnichainSepolia.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC --slow
contract DeployUnichainSepolia is DeskDeployBase {
    struct Config {
        uint256 pk;
        address deployer;
        address poolManager;
        address weth;
        address owner;
        address forwarder;
        address aqua;
        bool deployAqua;
        bool demoPool;
    }

    function run() external {
        Config memory c = _config();
        require(block.chainid == Addresses.UNICHAIN_SEPOLIA_CHAIN_ID, "this script is for Unichain Sepolia (1301)");
        require(c.poolManager.code.length > 0, "POOL_MANAGER has no code on this RPC");
        if (c.poolManager == Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER_ALT) {
            console2.log("warning: POOL_MANAGER is the non-canonical contract");
        }

        vm.startBroadcast(c.pk);
        if (c.aqua.code.length == 0) {
            require(c.deployAqua, "Aqua has no code on Unichain Sepolia. Set DEPLOY_AQUA=true or AQUA=<your registry>");
            c.aqua = _deployArtifact("Aqua.sol:Aqua", "");
            console2.log("deployed unmodified Aqua", c.aqua);
        }
        address swapVm = _deployArtifact("WalletDeskRouter.sol:WalletDeskRouter", abi.encode(c.aqua, c.weth, c.owner));
        _deployDesk(c, swapVm);
        vm.stopBroadcast();

        console2.log("PoolManager", c.poolManager);
        console2.log("Aqua", c.aqua);
        console2.log("WalletDeskRouter", swapVm);
    }

    function _deployDesk(Config memory c, address swapVm) internal {
        OverflowHook hook = _deployHook(IPoolManager(c.poolManager), swapVm, c.aqua);
        OverflowRouter router = new OverflowRouter(IPoolManager(c.poolManager));
        address builder = _deployArtifact("OrderBuilder.sol:OrderBuilder", "");
        DeskPriceFeed feed = new DeskPriceFeed(c.forwarder, c.owner);
        hook.setPriceFeed(address(feed), uint32(vm.envOr("MAX_REFERENCE_AGE", uint256(3600))));
        if (c.demoPool) _openDemoPool(IPoolManager(c.poolManager), hook, c.deployer, vm.envOr("POOL_CAP", uint256(1 ether)));
        if (c.owner != c.deployer) hook.transferOwner(c.owner);
        console2.log("OverflowHook", address(hook));
        console2.log("OverflowRouter", address(router));
        console2.log("OrderBuilder", builder);
        console2.log("DeskPriceFeed", address(feed));
    }

    function _config() internal view returns (Config memory c) {
        c.pk = vm.envUint("PRIVATE_KEY");
        c.deployer = vm.addr(c.pk);
        c.poolManager = vm.envOr("POOL_MANAGER", Addresses.UNICHAIN_SEPOLIA_POOL_MANAGER);
        c.weth = vm.envOr("WETH", Addresses.UNICHAIN_WETH);
        c.owner = vm.envOr("OWNER", c.deployer);
        c.forwarder = vm.envOr("CRE_FORWARDER", c.deployer);
        c.aqua = vm.envOr("AQUA", Addresses.AQUA);
        c.deployAqua = vm.envOr("DEPLOY_AQUA", false);
        c.demoPool = vm.envOr("DEMO_POOL", true);
    }
}
