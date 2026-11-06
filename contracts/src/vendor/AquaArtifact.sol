// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

// Builds the unmodified 1inch Aqua registry artifact ("Aqua.sol:Aqua") with every `forge build`, so
// DeployUnichainSepolia can deploy it with DEPLOY_AQUA=true. Aqua has no code on Unichain Sepolia.
// Nothing here modifies Aqua; it is imported, not changed.
import {Aqua} from "@1inch/aqua/contracts/Aqua.sol";
