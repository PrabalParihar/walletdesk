// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Addresses} from "../src/Addresses.sol";
import {DeskPriceFeed} from "../src/DeskPriceFeed.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";
import {DeskDeployBase} from "./DeskDeployBase.sol";

/// @notice Deploy WalletDesk on Unichain mainnet against the live PoolManager and the live 1inch Aqua registry.
///         The demo pool uses two mock tokens (no real value). Everything is env-driven and nothing
///         broadcasts unless you pass --broadcast yourself.
/// @dev Refuses to run without CONFIRM_MAINNET=true. Gas on Unichain is cheap, but it is real ETH.
///
///      CONFIRM_MAINNET=true forge script script/DeployUnichainMainnet.s.sol --rpc-url $UNICHAIN_RPC --slow
///      Rehearse first against a local fork: anvil --fork-url https://mainnet.unichain.org --chain-id 130
contract DeployUnichainMainnet is DeskDeployBase {
    using PoolIdLibrary for PoolKey;

    function run() external {
        require(vm.envOr("CONFIRM_MAINNET", false), "set CONFIRM_MAINNET=true to deploy to Unichain mainnet");
        require(block.chainid == Addresses.UNICHAIN_CHAIN_ID, "this script is for Unichain mainnet (130)");
        require(Addresses.UNICHAIN_POOL_MANAGER.code.length > 0, "PoolManager missing");
        require(Addresses.AQUA.code.length > 0, "Aqua registry missing");
        require(CREATE2_FACTORY.code.length > 0, "CREATE2 factory missing");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address owner = vm.envOr("OWNER", deployer);
        address forwarder = vm.envOr("CRE_FORWARDER", deployer);
        IPoolManager manager = IPoolManager(Addresses.UNICHAIN_POOL_MANAGER);

        vm.startBroadcast(pk);
        address swapVm = _deployArtifact(
            "WalletDeskRouter.sol:WalletDeskRouter", abi.encode(Addresses.AQUA, Addresses.UNICHAIN_WETH, owner)
        );
        OverflowHook hook = _deployHook(manager, swapVm, Addresses.AQUA);
        OverflowRouter router = new OverflowRouter(manager);
        address builder = _deployArtifact("OrderBuilder.sol:OrderBuilder", "");
        DeskPriceFeed feed = new DeskPriceFeed(forwarder, owner);
        hook.setPriceFeed(address(feed), uint32(vm.envOr("MAX_REFERENCE_AGE", uint256(3600))));
        (MockERC20 token0, MockERC20 token1, PoolKey memory key) =
            _openDemoPool(manager, hook, deployer, vm.envOr("POOL_CAP", uint256(1 ether)));
        address maker = vm.envOr("MAKER", deployer);
        token0.mint(maker, 10_000 ether);
        token1.mint(maker, 10_000 ether);
        if (owner != deployer) hook.transferOwner(owner);
        vm.stopBroadcast();

        string memory k = "deployment";
        vm.serializeString(k, "network", "unichain");
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeString(k, "rpcUrl", vm.envOr("UNICHAIN_RPC", string("https://mainnet.unichain.org")));
        vm.serializeAddress(k, "aqua", Addresses.AQUA);
        vm.serializeAddress(k, "poolManager", address(manager));
        vm.serializeAddress(k, "swapVm", swapVm);
        vm.serializeAddress(k, "hook", address(hook));
        vm.serializeAddress(k, "overflowRouter", address(router));
        vm.serializeAddress(k, "priceFeed", address(feed));
        vm.serializeAddress(k, "orderBuilder", builder);
        vm.serializeAddress(k, "token0", address(token0));
        vm.serializeAddress(k, "token1", address(token1));
        vm.serializeString(k, "symbol0", token0.symbol());
        vm.serializeString(k, "symbol1", token1.symbol());
        vm.serializeUint(k, "decimals0", 18);
        vm.serializeUint(k, "decimals1", 18);
        vm.serializeUint(k, "fee", 3000);
        vm.serializeUint(k, "tickSpacing", 60);
        vm.serializeAddress(k, "maker", maker);
        vm.serializeString(k, "poolId", vm.toString(PoolId.unwrap(key.toId())));
        string memory out = vm.serializeString(k, "settlement", "none");
        vm.createDir("deployments", true);
        vm.writeJson(out, "./deployments/unichain.json");

        console2.log("WalletDeskRouter", swapVm);
        console2.log("OverflowHook", address(hook));
        console2.log("OverflowRouter", address(router));
        console2.log("OrderBuilder", builder);
        console2.log("DeskPriceFeed", address(feed));
        console2.log("poolId");
        console2.logBytes32(PoolId.unwrap(key.toId()));
        console2.log("wrote contracts/deployments/unichain.json");
    }
}
