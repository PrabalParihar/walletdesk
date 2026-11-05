// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {Addresses} from "../src/Addresses.sol";
import {DeskOrder} from "../src/interfaces/IDeskSwapVM.sol";
import {DeskPriceFeed} from "../src/DeskPriceFeed.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";
import {DeskDeployBase} from "./DeskDeployBase.sol";

interface IOrderBuilder {
    function buildBand(address maker, uint256 priceLow, uint256 priceHigh, uint16 feeBps, uint32 start, uint32 halfLife)
        external
        pure
        returns (uint256 traits, bytes memory data, bytes memory strategy);
}

interface IFeeTreasury {
    function deposit(uint256 amount) external;
    function creditFromFill(bytes32 fillId, address maker, uint256 amount) external;
}

/// @notice Deploy the desk on a local Unichain mainnet fork, ship a maker, run two overflow swaps (WalletDesk's
///         OverflowRouter and Uniswap's stock PoolSwapTest router), and credit a USDC rebate.
/// @dev Refuses to run unless ALLOW_DEMO_BROADCAST=true. script/demo.sh sets that only for a loopback RPC.
contract DemoSeed is DeskDeployBase {
    using PoolIdLibrary for PoolKey;

    uint256 internal constant SHIP = 1_000 ether;
    uint256 internal constant CAP = 1 ether;
    uint256 internal constant LARGE = 5 ether;
    uint16 internal constant MAX_DEV = 100;
    uint32 internal constant MAX_REFERENCE_AGE = 3600;

    struct DeskContracts {
        address swapVm;
        OverflowHook hook;
        OverflowRouter router;
        PoolSwapTest stockRouter;
        DeskPriceFeed feed;
        MockERC20 token0;
        MockERC20 token1;
        address builder;
        MockERC20 usdc;
        address treasury;
        PoolKey key;
    }

    function run() external {
        require(vm.envOr("ALLOW_DEMO_BROADCAST", false), "set ALLOW_DEMO_BROADCAST=true only for local anvil");
        require(block.chainid == Addresses.UNICHAIN_CHAIN_ID, "demo seed expects an Unichain fork (chain id 130)");
        require(CREATE2_FACTORY.code.length > 0, "CREATE2 factory missing on this RPC");
        require(Addresses.UNICHAIN_POOL_MANAGER.code.length > 0, "PoolManager missing");
        require(Addresses.AQUA.code.length > 0, "Aqua registry missing");

        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        uint256 makerPk = vm.envUint("MAKER_KEY");
        uint256 takerPk = vm.envUint("TAKER_KEY");
        address maker = vm.addr(makerPk);
        address taker = vm.addr(takerPk);
        uint256 logFromBlock = block.number;

        DeskContracts memory desk = _deploy(deployerPk, maker, taker);
        (bytes32 strategyHash, bytes32 fillId, uint256 credit, uint256 takerOut) = _trade(desk, makerPk, takerPk, maker);
        _write(desk, maker, taker, strategyHash, logFromBlock);

        console2.log("maker", maker);
        console2.log("taker", taker);
        console2.log("hook", address(desk.hook));
        console2.log("takerOut", takerOut);
        console2.log("usdc rebate (6 decimals)", credit);
        console2.log("fill");
        console2.logBytes32(fillId);
    }

    function _deploy(uint256 deployerPk, address maker, address taker) internal returns (DeskContracts memory desk) {
        _deployCore(desk, deployerPk);
        _deployPool(desk, deployerPk);
        _deployRebates(desk, deployerPk, maker, taker);
    }

    function _deployCore(DeskContracts memory desk, uint256 deployerPk) internal {
        address deployer = vm.addr(deployerPk);
        IPoolManager manager = IPoolManager(Addresses.UNICHAIN_POOL_MANAGER);
        vm.startBroadcast(deployerPk);
        desk.swapVm = _deployArtifact(
            "WalletDeskRouter.sol:WalletDeskRouter", abi.encode(Addresses.AQUA, Addresses.UNICHAIN_WETH, deployer)
        );
        desk.hook = _deployHook(manager, desk.swapVm, Addresses.AQUA);
        desk.router = new OverflowRouter(manager);
        desk.stockRouter = new PoolSwapTest(manager);
        // The keeper key stands in for the CRE forwarder by default. FEED_FORWARDER=0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1
        // hands the feed to the CRE MockKeystoneForwarder instead (see docs/CRE.md); then the keeper stops posting.
        desk.feed = new DeskPriceFeed(deployer, deployer);
        desk.hook.setPriceFeed(address(desk.feed), MAX_REFERENCE_AGE);
        desk.builder = _deployArtifact("OrderBuilder.sol:OrderBuilder", "");
        vm.stopBroadcast();
    }

    function _deployPool(DeskContracts memory desk, uint256 deployerPk) internal {
        vm.startBroadcast(deployerPk);
        (desk.token0, desk.token1, desk.key) =
            _openDemoPool(IPoolManager(Addresses.UNICHAIN_POOL_MANAGER), desk.hook, vm.addr(deployerPk), CAP);
        desk.feed.onReport("", abi.encode(PoolId.unwrap(desk.key.toId()), uint256(1e18), uint64(block.timestamp)));
        address creForwarder = vm.envOr("FEED_FORWARDER", address(0));
        if (creForwarder != address(0)) desk.feed.setForwarder(creForwarder);
        vm.stopBroadcast();
    }

    function _deployRebates(DeskContracts memory desk, uint256 deployerPk, address maker, address taker) internal {
        address deployer = vm.addr(deployerPk);
        vm.startBroadcast(deployerPk);
        desk.token0.mint(maker, SHIP);
        desk.token1.mint(maker, SHIP);
        desk.token0.mint(taker, 100 ether);
        desk.usdc = new MockERC20("USD Coin", "USDC", 6);
        desk.treasury = _deployArtifact(
            "FeeShareTreasury.sol:FeeShareTreasury", abi.encode(address(desk.usdc), deployer, deployer)
        );
        desk.usdc.mint(deployer, 1_000_000e6);
        vm.stopBroadcast();
    }

    function _trade(DeskContracts memory desk, uint256 makerPk, uint256 takerPk, address maker)
        internal
        returns (bytes32 strategyHash, bytes32 fillId, uint256 credit, uint256 takerOut)
    {
        address taker = vm.addr(takerPk);
        (uint256 traits, bytes memory data, bytes memory strategy) =
            IOrderBuilder(desk.builder).buildBand(maker, 0.99 ether, 1.01 ether, 30, uint32(block.timestamp), 0);

        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        tokens[0] = address(desk.token0);
        tokens[1] = address(desk.token1);
        amounts[0] = SHIP;
        amounts[1] = SHIP;

        vm.startBroadcast(makerPk);
        desk.token0.approve(Addresses.AQUA, type(uint256).max);
        desk.token1.approve(Addresses.AQUA, type(uint256).max);
        strategyHash = IAqua(Addresses.AQUA).ship(desk.swapVm, strategy, tokens, amounts);
        desk.hook.registerDesk(desk.key, DeskOrder({maker: maker, traits: traits, data: data}), MAX_DEV);
        vm.stopBroadcast();

        // 1. WalletDesk's router: prefunds, swaps, takes the output.
        vm.startBroadcast(takerPk);
        desk.token0.approve(address(desk.router), type(uint256).max);
        takerOut = desk.router.swapExactInput(desk.key, true, LARGE, 0, taker);
        vm.stopBroadcast();

        (address fillMaker,,, uint256 residual, uint256 filled, uint256 feeOut, bytes32 id) =
            desk.hook.lastFill(desk.key.toId());
        require(fillMaker == maker, "fill maker");
        require(residual == 4 ether, "residual");
        require(filled == 3.988 ether, "filled");
        fillId = id;
        credit = feeOut / 1e12;
        require(credit > 0, "scaled fee is zero");

        // 2. Uniswap's stock v4 test router, which settles input after the swap. The desk fills it too.
        require(_stockRouterSwap(desk, takerPk) != fillId, "stock router swap did not fill from the desk");

        // Rebate for the first fill. The keeper credits the second one when it starts.
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        desk.usdc.approve(desk.treasury, type(uint256).max);
        IFeeTreasury(desk.treasury).deposit(credit);
        IFeeTreasury(desk.treasury).creditFromFill(fillId, maker, credit);
        vm.stopBroadcast();
    }

    function _stockRouterSwap(DeskContracts memory desk, uint256 takerPk) internal returns (bytes32 secondId) {
        vm.startBroadcast(takerPk);
        desk.token0.approve(address(desk.stockRouter), type(uint256).max);
        desk.stockRouter.swap(
            desk.key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(2 ether), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopBroadcast();
        (,,,,,, secondId) = desk.hook.lastFill(desk.key.toId());
    }

    function _write(DeskContracts memory desk, address maker, address taker, bytes32 strategyHash, uint256 logFromBlock)
        internal
    {
        string memory rpcUrl = vm.envOr("DEMO_RPC_URL", string("http://127.0.0.1:8545"));
        string memory keeperUrl = vm.envOr("KEEPER_URL", string("http://127.0.0.1:8787"));
        string memory k = "deployment";
        vm.serializeString(k, "network", "fork");
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeString(k, "rpcUrl", rpcUrl);
        vm.serializeString(k, "keeperUrl", keeperUrl);
        vm.serializeAddress(k, "aqua", Addresses.AQUA);
        vm.serializeAddress(k, "poolManager", Addresses.UNICHAIN_POOL_MANAGER);
        vm.serializeAddress(k, "swapVm", desk.swapVm);
        vm.serializeAddress(k, "hook", address(desk.hook));
        vm.serializeAddress(k, "overflowRouter", address(desk.router));
        vm.serializeAddress(k, "stockRouter", address(desk.stockRouter));
        vm.serializeAddress(k, "priceFeed", address(desk.feed));
        vm.serializeAddress(k, "orderBuilder", desk.builder);
        vm.serializeAddress(k, "token0", address(desk.token0));
        vm.serializeAddress(k, "token1", address(desk.token1));
        vm.serializeString(k, "symbol0", desk.token0.symbol());
        vm.serializeString(k, "symbol1", desk.token1.symbol());
        vm.serializeUint(k, "decimals0", 18);
        vm.serializeUint(k, "decimals1", 18);
        vm.serializeUint(k, "fee", 3000);
        vm.serializeUint(k, "tickSpacing", 60);
        vm.serializeAddress(k, "treasury", desk.treasury);
        vm.serializeAddress(k, "usdc", address(desk.usdc));
        vm.serializeAddress(k, "maker", maker);
        vm.serializeAddress(k, "taker", taker);
        vm.serializeUint(k, "deployBlock", logFromBlock);
        vm.serializeString(k, "poolId", vm.toString(PoolId.unwrap(desk.key.toId())));
        vm.serializeString(k, "poolCap", vm.toString(CAP));
        vm.serializeUint(k, "maxDeviationBps", MAX_DEV);
        vm.serializeUint(k, "maxReferenceAge", MAX_REFERENCE_AGE);
        vm.serializeString(k, "shipAmount", vm.toString(SHIP));
        vm.serializeString(k, "exampleSwap", vm.toString(LARGE));
        vm.serializeString(k, "strategyHash", vm.toString(strategyHash));
        string memory out = vm.serializeString(k, "settlement", "attestor");
        vm.createDir("deployments", true);
        vm.writeJson(out, "./deployments/local.json");
        console2.log("wrote contracts/deployments/local.json");
    }
}
