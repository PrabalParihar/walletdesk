// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26 <0.8.31;

/// @title Addresses
/// @notice Pinned addresses checked with `cast codesize` / `cast call` on 5 Nov 2026.
/// @dev Unichain Sepolia has two PoolManager bytecodes. hookmate (the v4-template helper) returns
///      0x00B036B58a818B1BC34d502D3fE730Db729e62AC. A second deployment, 0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95,
///      also has code and a different codehash. Deploy scripts take POOL_MANAGER from the environment.
library Addresses {
    address internal constant AQUA = 0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a;
    address internal constant AQUA_SWAP_VM_ROUTER = 0x111111338c5091E8440b67B168bAe16a668AC0De;
    address internal constant KYC_NFT = 0x26FFc7D378E8e49Be2c483295A3e3E511F96a468;

    address internal constant UNICHAIN_POOL_MANAGER = 0x1F98400000000000000000000000000000000004;
    address internal constant UNICHAIN_WETH = 0x4200000000000000000000000000000000000006;
    address internal constant UNICHAIN_USDC = 0x078D782b760474a361dDA0AF3839290b0EF57AD6;

    /// @notice Canonical Unichain Sepolia PoolManager (chain 1301).
    ///         Listed on https://developers.uniswap.org/docs/protocols/v4/deployments
    ///         and https://developers.uniswap.org/docs/unichain/technical-information/contract-addresses
    ///         Checked 5 Nov 2026 against https://sepolia.unichain.org: code size 24009, runtime codehash
    ///         0x7c5e10e0bd8580e13b48751e4cd7db6315577488d0f76b20bc6c8bcbe2646dc0.
    ///         hookmate returns this same address. The explorer HTML is behind a bot check; the RPC code read is the check.
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    /// @notice Alias of UNICHAIN_SEPOLIA_POOL_MANAGER. Older notes call this the hookmate address.
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER_HOOKMATE = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    /// @notice Second contract on chain 1301 with PoolManager-shaped bytecode and a different codehash
    ///         (0x2566e42d45723eef05d7253a7b7c140a6da61992594525fc66d06b4a973b5d0b, code size 24009).
    ///         Not listed on the v4 deployments page. The deploy script will not select it unless POOL_MANAGER is set to it.
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER_ALT = 0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95;

    /// @notice Circle USDC on Unichain Sepolia. `decimals()` is 6.
    ///         TokenMinterV2.burnLimitsPerMessage returned 10000000000000 on 5 Nov 2026, so CCTP V2 can burn it.
    ///         circlefin/cctp-go lists 0x5fd84259d66Cd46123540766Be93DFE6D43130D7, which had no code on this RPC.
    address internal constant UNICHAIN_SEPOLIA_USDC = 0x31d0220469e10c4E71834a79b1f276d740d3768F;

    /// @notice CCTP V2 TokenMessenger on testnets, including Unichain Sepolia (domain 10) and Arc testnet (domain 26).
    ///         https://developers.circle.com/cctp/references/contract-addresses
    address internal constant CCTP_V2_TOKEN_MESSENGER_TESTNET = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
    /// @notice CCTP V2 MessageTransmitter on those testnets. `receiveMessage` mints on the destination.
    address internal constant CCTP_V2_MESSAGE_TRANSMITTER_TESTNET = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;
    /// @notice CCTP V2 TokenMessenger on mainnet, including Unichain (domain 10) and Arc (domain 26).
    address internal constant CCTP_V2_TOKEN_MESSENGER = 0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d;
    /// @notice CCTP V2 MessageTransmitter on mainnet.
    address internal constant CCTP_V2_MESSAGE_TRANSMITTER = 0x81D40F21F12A8F0E3252Bccb954D722d4c464B64;
    uint32 internal constant CCTP_DOMAIN_UNICHAIN = 10;
    uint32 internal constant CCTP_DOMAIN_ARC = 26;

    /// @notice Arc ERC-20 USDC interface (6 decimals). Same address on Arc testnet and mainnet. Native gas is 18 decimals.
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    uint256 internal constant UNICHAIN_CHAIN_ID = 130;
    uint256 internal constant UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
}
