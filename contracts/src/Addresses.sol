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

    /// @notice hookmate / v4-template choice for chain 1301. Not the only contract with PoolManager code.
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER_HOOKMATE = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    /// @notice The other address cited in Uniswap docs. Different runtime codehash. Do not assume they match.
    address internal constant UNICHAIN_SEPOLIA_POOL_MANAGER_ALT = 0x9cB26A7183B2F4515945Dc52CB4195B0d2D06C95;

    /// @notice Arc ERC-20 USDC interface (6 decimals). Same address on Arc testnet and mainnet. Native gas is 18 decimals.
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    uint256 internal constant UNICHAIN_CHAIN_ID = 130;
    uint256 internal constant UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5_042_002;
}
