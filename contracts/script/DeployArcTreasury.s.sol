// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";

import {Addresses} from "../src/Addresses.sol";
import {FeeShareTreasury} from "../src/FeeShareTreasury.sol";

/// @notice Deploy FeeShareTreasury to Arc. Paste the same source into Arc Studio if the bounty requires a Studio project.
/// @dev Arc drops transactions whose maxFeePerGas is below 20 gwei, with no receipt.
///      Pass `--with-gas-price 20000000000` (or higher) on the forge script command.
///      Do not send native value. The constructor takes the 6-decimal ERC-20 USDC interface.
///
///      forge script script/DeployArcTreasury.s.sol --rpc-url $ARC_RPC --with-gas-price 20000000000
///      Add --broadcast only when you are ready to spend the key in PRIVATE_KEY.
contract DeployArcTreasury is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envOr("ARC_USDC", Addresses.ARC_USDC);
        address attestor = vm.envAddress("ATTESTOR");
        address owner = vm.envOr("OWNER", vm.addr(pk));
        address transmitter = vm.envOr("CCTP_MESSAGE_TRANSMITTER", Addresses.CCTP_V2_MESSAGE_TRANSMITTER_TESTNET);

        require(block.chainid == Addresses.ARC_TESTNET_CHAIN_ID, "this script is for Arc testnet (5042002)");
        require(usdc.code.length > 0, "ARC_USDC has no code");
        require(transmitter.code.length > 0, "CCTP MessageTransmitterV2 has no code");
        (bool ok, bytes memory data) = usdc.staticcall(abi.encodeWithSignature("decimals()"));
        require(ok && data.length >= 32, "decimals() failed");
        require(abi.decode(data, (uint8)) == 6, "Arc USDC ERC-20 interface must be 6 decimals, not the 18-decimal native unit");

        console2.log("chainId", block.chainid);
        console2.log("expected Arc testnet", Addresses.ARC_TESTNET_CHAIN_ID);
        console2.log("USDC", usdc);
        console2.log("CCTP MessageTransmitterV2", transmitter);
        console2.log("CCTP domain", uint256(Addresses.CCTP_DOMAIN_ARC));

        vm.startBroadcast(pk);
        FeeShareTreasury treasury = new FeeShareTreasury(usdc, attestor, owner);
        vm.stopBroadcast();

        console2.log("FeeShareTreasury", address(treasury));
    }
}
