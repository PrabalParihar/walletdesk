// SPDX-License-Identifier: MIT
pragma solidity =0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {IAqua} from "@1inch/aqua/src/interfaces/IAqua.sol";

import {Addresses} from "../src/Addresses.sol";
import {DeskOrder} from "../src/interfaces/IDeskSwapVM.sol";
import {OverflowHook} from "../src/OverflowHook.sol";
import {OverflowRouter} from "../src/OverflowRouter.sol";

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

/// @notice Deploy the desk on a local Unichain mainnet fork, ship a maker, run one overflow swap, and credit USDC.
/// @dev Refuses to run unless ALLOW_DEMO_BROADCAST=true. script/demo.sh sets that only for a loopback RPC.
contract DemoSeed is Script {
    using PoolIdLibrary for PoolKey;

    uint256 internal constant SHIP = 1_000 ether;
    uint256 internal constant CAP = 1 ether;
    uint256 internal constant LARGE = 5 ether;

    struct DeskContracts {
        address swapVm;
        OverflowHook hook;
        OverflowRouter router;
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
        console2.log("usdc credit (6 decimals)", credit);
        console2.log("fill");
        console2.logBytes32(fillId);
    }

    function _deploy(uint256 deployerPk, address maker, address taker) internal returns (DeskContracts memory desk) {
        address deployer = vm.addr(deployerPk);
        IPoolManager manager = IPoolManager(Addresses.UNICHAIN_POOL_MANAGER);
        IAqua aqua = IAqua(Addresses.AQUA);

        vm.startBroadcast(deployerPk);
        desk.swapVm = _deployArtifact(
            "WalletDeskRouter.sol:WalletDeskRouter", abi.encode(address(aqua), Addresses.UNICHAIN_WETH, deployer)
        );
        vm.stopBroadcast();

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        bytes memory ctorArgs = abi.encode(address(manager), desk.swapVm, bytes32(0));
        // Call the Arachnid factory directly. forge 1.9 simulates `new {salt:}` from the broadcaster
        // and broadcasts it through 0x4e59..., so those two addresses do not match.
        (address predicted, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(OverflowHook).creationCode, ctorArgs);

        vm.startBroadcast(deployerPk);
        desk.hook = _deployHook(salt, ctorArgs, predicted);
        desk.router = new OverflowRouter(manager);
        desk.hook.setOverflowRouter(address(desk.router));
        (desk.token0, desk.token1, desk.key) = _openPool(manager, desk.hook, deployer);
        desk.token0.mint(maker, SHIP);
        desk.token1.mint(maker, SHIP);
        desk.token0.mint(taker, 100 ether);
        desk.builder = _deployArtifact("OrderBuilder.sol:OrderBuilder", "");
        desk.usdc = new MockERC20("USD Coin", "USDC", 6);
        desk.treasury = _deployArtifact(
            "FeeShareTreasury.sol:FeeShareTreasury", abi.encode(address(desk.usdc), deployer, deployer)
        );
        desk.usdc.mint(deployer, 1_000_000e6);
        vm.stopBroadcast();
    }

    function _openPool(IPoolManager manager, OverflowHook hook, address deployer)
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
        manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        PoolModifyLiquidityTest liq = new PoolModifyLiquidityTest(manager);
        token0.mint(deployer, 1_000_000 ether);
        token1.mint(deployer, 1_000_000 ether);
        token0.approve(address(liq), type(uint256).max);
        token1.approve(address(liq), type(uint256).max);
        liq.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: int256(50e18), salt: bytes32(0)}),
            ""
        );
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
        desk.hook.registerDesk(desk.key, DeskOrder({maker: maker, traits: traits, data: data}), CAP);
        vm.stopBroadcast();

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

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        desk.usdc.approve(desk.treasury, type(uint256).max);
        IFeeTreasury(desk.treasury).deposit(credit);
        IFeeTreasury(desk.treasury).creditFromFill(fillId, maker, credit);
        vm.stopBroadcast();
    }

    function _write(DeskContracts memory desk, address maker, address taker, bytes32 strategyHash, uint256 logFromBlock)
        internal
    {
        string memory rpcUrl = vm.envOr("DEMO_RPC_URL", string("http://127.0.0.1:8545"));
        string memory keeperUrl = vm.envOr("KEEPER_URL", string("http://127.0.0.1:8787"));
        string memory keyName = "deployment";
        vm.serializeString(keyName, "network", "fork");
        vm.serializeUint(keyName, "chainId", block.chainid);
        vm.serializeString(keyName, "rpcUrl", rpcUrl);
        vm.serializeString(keyName, "keeperUrl", keeperUrl);
        vm.serializeAddress(keyName, "aqua", Addresses.AQUA);
        vm.serializeAddress(keyName, "poolManager", Addresses.UNICHAIN_POOL_MANAGER);
        vm.serializeAddress(keyName, "swapVm", desk.swapVm);
        vm.serializeAddress(keyName, "hook", address(desk.hook));
        vm.serializeAddress(keyName, "overflowRouter", address(desk.router));
        vm.serializeAddress(keyName, "orderBuilder", desk.builder);
        vm.serializeAddress(keyName, "token0", address(desk.token0));
        vm.serializeAddress(keyName, "token1", address(desk.token1));
        vm.serializeString(keyName, "symbol0", desk.token0.symbol());
        vm.serializeString(keyName, "symbol1", desk.token1.symbol());
        vm.serializeUint(keyName, "fee", 3000);
        vm.serializeUint(keyName, "tickSpacing", 60);
        vm.serializeAddress(keyName, "treasury", desk.treasury);
        vm.serializeAddress(keyName, "usdc", address(desk.usdc));
        vm.serializeAddress(keyName, "maker", maker);
        vm.serializeAddress(keyName, "taker", taker);
        vm.serializeUint(keyName, "deployBlock", logFromBlock);
        vm.serializeString(keyName, "poolId", vm.toString(PoolId.unwrap(desk.key.toId())));
        vm.serializeString(keyName, "poolCap", vm.toString(CAP));
        vm.serializeString(keyName, "shipAmount", vm.toString(SHIP));
        vm.serializeString(keyName, "exampleSwap", vm.toString(LARGE));
        vm.serializeString(keyName, "strategyHash", vm.toString(strategyHash));
        string memory out = vm.serializeString(keyName, "settlement", "attestor");
        vm.createDir("deployments", true);
        vm.writeJson(out, "./deployments/local.json");
        console2.log("wrote contracts/deployments/local.json");
    }

    function _deployHook(bytes32 salt, bytes memory ctorArgs, address predicted) internal returns (OverflowHook hook) {
        bytes memory initcode = abi.encodePacked(type(OverflowHook).creationCode, ctorArgs);
        (bool ok,) = CREATE2_FACTORY.call(abi.encodePacked(salt, initcode));
        require(ok, "hook create2 failed");
        hook = OverflowHook(predicted);
        require(address(hook).code.length > 0, "hook missing");
    }

    function _deployArtifact(string memory artifact, bytes memory args) internal returns (address deployed) {
        bytes memory initcode = abi.encodePacked(vm.getCode(artifact), args);
        assembly ("memory-safe") {
            deployed := create(0, add(initcode, 0x20), mload(initcode))
        }
        require(deployed != address(0), "artifact deploy failed");
    }
}
