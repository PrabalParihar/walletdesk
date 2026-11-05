// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {OverflowHook} from "../src/OverflowHook.sol";

/// @notice Shared deploy steps for the desk: SwapVM router artifact, mined hook, demo pool.
/// @dev The SwapVM router, OrderBuilder, Aqua and CctpFeeBridge compile with solc 0.8.30. Scripts compile
///      with 0.8.26 (v4-core), so those are deployed from their artifacts.
abstract contract DeskDeployBase is Script {
    /// @dev sqrt(1) * 2^96. Same as TickMath.getSqrtPriceAtTick(0), without inlining TickMath into scripts.
    uint160 internal constant SQRT_PRICE_1_1 = uint160(1 << 96);
    uint160 internal constant HOOK_FLAGS = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);

    function _deployArtifact(string memory artifact, bytes memory args) internal returns (address deployed) {
        bytes memory initcode = abi.encodePacked(vm.getCode(artifact), args);
        assembly ("memory-safe") {
            deployed := create(0, add(initcode, 0x20), mload(initcode))
        }
        require(deployed != address(0), "artifact deploy failed");
    }

    /// @dev Mines a salt for the Arachnid CREATE2 factory and calls the factory directly, so simulation and
    ///      broadcast agree on the deployer. Must be called inside a broadcast.
    function _deployHook(IPoolManager manager, address swapVm, address aqua) internal returns (OverflowHook hook) {
        bytes memory ctorArgs = abi.encode(address(manager), swapVm, aqua);
        (address predicted, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, HOOK_FLAGS, type(OverflowHook).creationCode, ctorArgs);
        (bool ok,) = CREATE2_FACTORY.call(abi.encodePacked(salt, type(OverflowHook).creationCode, ctorArgs));
        require(ok, "hook create2 failed");
        hook = OverflowHook(predicted);
        require(address(hook).code.length > 0, "hook missing");
    }

    /// @dev Two 18-decimal mock tokens at 1:1, a deep position around the price and a wide backstop.
    ///      Must be called inside a broadcast by `lp`.
    function _openDemoPool(IPoolManager manager, OverflowHook hook, address lp, uint256 cap)
        internal
        returns (MockERC20 token0, MockERC20 token1, PoolKey memory key)
    {
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
        manager.initialize(key, SQRT_PRICE_1_1); // tick 0, price 1.0
        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.mint(lp, 1_000_000 ether);
        token1.mint(lp, 1_000_000 ether);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(
            key, ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 500e18, salt: 0}), ""
        );
        liq.modifyLiquidity(
            key, ModifyLiquidityParams({tickLower: -12_000, tickUpper: 12_000, liquidityDelta: 100e18, salt: 0}), ""
        );
        hook.setPoolCap(key, cap);
        console2.log("pool cap", cap);
    }
}
