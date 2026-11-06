// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {DeskOrder} from "../src/interfaces/IDeskSwapVM.sol";
import {DeskPriceFeed} from "../src/DeskPriceFeed.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";

interface IOrderBuilderLive {
    function buildBand(address maker, uint256 priceLow, uint256 priceHigh, uint16 feeBps, uint32 start, uint32 halfLife)
        external
        pure
        returns (uint256 traits, bytes memory data, bytes memory strategy);
}

/// @notice After DeployUnichainMainnet (or DeployUnichainSepolia), make the live desk do real work with one key:
///         post a reference price, ship a DeskBand on Aqua, register it, and run two overflow swaps, one through
///         OverflowRouter and one through Uniswap's stock PoolSwapTest router. Nothing broadcasts without --broadcast.
/// @dev The broadcasting key is the hook owner, the feed forwarder, the maker and the taker. On Unichain mainnet CRE is
///      not supported, so the reference comes from REFERENCE_PRICE_X18, which you set from the keeper's public-API
///      median (services/keeper/reference.mjs). If the feed's forwarder is someone else (the CRE forwarder on
///      Sepolia), the reference step is skipped and the CRE workflow must write first.
///
///      DEPLOYMENTS=./deployments/unichain.json REFERENCE_PRICE_X18=998300000000000000 \
///        forge script script/SeedLive.s.sol --rpc-url $UNICHAIN_RPC --slow
contract SeedLive is Script {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant MIN_SQRT_PRICE_PLUS_ONE = 4_295_128_740;

    struct Live {
        address aqua;
        address swapVm;
        OverflowHook hook;
        OverflowRouter router;
        DeskPriceFeed feed;
        address builder;
        MockERC20 token0;
        MockERC20 token1;
        PoolKey key;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        Live memory l = _load(vm.envOr("DEPLOYMENTS", string("./deployments/unichain.json")));
        require(address(l.hook).code.length > 0, "hook not deployed on this RPC");

        _reference(l, pk, me);
        bytes32 strategyHash = _shipAndRegister(l, pk, me);
        _swaps(l, pk, me);

        (address fillMaker,,, uint256 residual, uint256 filled, uint256 feeOut, bytes32 fillId) =
            l.hook.lastFill(l.key.toId());
        console2.log("strategyHash");
        console2.logBytes32(strategyHash);
        console2.log("last fill maker", fillMaker);
        console2.log("last fill residualIn", residual);
        console2.log("last fill filledOut", filled);
        console2.log("last fill maker spread", feeOut);
        console2.logBytes32(fillId);
        require(fillMaker == me, "no desk fill: check the reference price and the guard");
    }

    function _load(string memory path) internal view returns (Live memory l) {
        string memory json = vm.readFile(path);
        l.aqua = vm.parseJsonAddress(json, ".aqua");
        l.swapVm = vm.parseJsonAddress(json, ".swapVm");
        l.hook = OverflowHook(vm.parseJsonAddress(json, ".hook"));
        l.router = OverflowRouter(vm.parseJsonAddress(json, ".overflowRouter"));
        l.feed = DeskPriceFeed(vm.parseJsonAddress(json, ".priceFeed"));
        l.builder = vm.parseJsonAddress(json, ".orderBuilder");
        l.token0 = MockERC20(vm.parseJsonAddress(json, ".token0"));
        l.token1 = MockERC20(vm.parseJsonAddress(json, ".token1"));
        l.key = PoolKey({
            currency0: Currency.wrap(address(l.token0)),
            currency1: Currency.wrap(address(l.token1)),
            fee: uint24(vm.parseJsonUint(json, ".fee")),
            tickSpacing: int24(int256(vm.parseJsonUint(json, ".tickSpacing"))),
            hooks: IHooks(address(l.hook))
        });
    }

    function _reference(Live memory l, uint256 pk, address me) internal {
        if (l.feed.forwarder() != me) {
            console2.log("feed forwarder is not this key: skipping the reference; the CRE workflow must write it");
            return;
        }
        uint256 priceX18 = vm.envUint("REFERENCE_PRICE_X18");
        require(priceX18 > 0.9e18 && priceX18 < 1.1e18, "demo pair is a stable pair; reference must be near 1.0");
        bytes32 poolId = PoolId.unwrap(l.key.toId());
        uint64 last = l.feed.lastObservedAt(poolId);
        uint64 observedAt = uint64(block.timestamp) > last ? uint64(block.timestamp) : last + 1;
        vm.startBroadcast(pk);
        l.feed.onReport("", abi.encode(poolId, priceX18, observedAt));
        vm.stopBroadcast();
        console2.log("reference posted (X18)", priceX18);
    }

    function _shipAndRegister(Live memory l, uint256 pk, address me) internal returns (bytes32 strategyHash) {
        uint256 ship = vm.envOr("SHIP", uint256(1_000 ether));
        (uint256 traits, bytes memory data, bytes memory strategy) =
            IOrderBuilderLive(l.builder).buildBand(me, 0.99 ether, 1.01 ether, 30, uint32(block.timestamp), 0);
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        tokens[0] = address(l.token0);
        tokens[1] = address(l.token1);
        amounts[0] = ship;
        amounts[1] = ship;
        vm.startBroadcast(pk);
        l.token0.approve(l.aqua, type(uint256).max);
        l.token1.approve(l.aqua, type(uint256).max);
        strategyHash = IAqua(l.aqua).ship(l.swapVm, strategy, tokens, amounts);
        l.hook.registerDesk(l.key, DeskOrder({maker: me, traits: traits, data: data}), 100);
        vm.stopBroadcast();
    }

    function _swaps(Live memory l, uint256 pk, address me) internal {
        vm.startBroadcast(pk);
        l.token0.approve(address(l.router), type(uint256).max);
        uint256 out = l.router.swapExactInput(l.key, true, 5 ether, 0, me);
        PoolSwapTest stock = new PoolSwapTest(IPoolManager(address(l.hook.poolManager())));
        l.token0.approve(address(stock), type(uint256).max);
        stock.swap(
            l.key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(2 ether), sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_ONE}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopBroadcast();
        console2.log("OverflowRouter swap out", out);
        console2.log("PoolSwapTest router", address(stock));
    }
}
