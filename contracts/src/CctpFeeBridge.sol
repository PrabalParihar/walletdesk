// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice CCTP V2 `depositForBurnWithHook`. Selector `0x779b432d` on the Unichain Sepolia and Arc testnet messengers.
///         https://developers.circle.com/cctp/references/contract-addresses
interface ITokenMessengerV2 {
    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes calldata hookData
    ) external;
}

/// @title CctpFeeBridge
/// @notice Burns 6-decimal USDC on Unichain through Circle CCTP V2 so the same amount can mint on Arc.
/// @dev Destination domain is Arc (26). `hookData` is `abi.encode(fillId, maker)` so the burn and the
///      maker stay in one transaction. A local anvil fork cannot finish this path: Iris attests burns
///      that landed on the real source chain, not fork state. See docs/CCTP.md.
contract CctpFeeBridge {
    using SafeERC20 for IERC20;

    uint32 public constant ARC_DOMAIN = 26;
    /// @notice Circle's standard-transfer finality threshold. Fast transfer is 1000. Unichain supports both.
    uint32 public constant STANDARD_FINALITY = 2000;

    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroRecipient();

    event FeeBurned(
        bytes32 indexed fillId,
        address indexed maker,
        uint256 amount,
        bytes32 mintRecipient,
        uint32 destinationDomain
    );
    event OwnerSet(address indexed owner);

    IERC20 public immutable usdc;
    ITokenMessengerV2 public immutable messenger;
    address public owner;

    constructor(address usdc_, address messenger_, address owner_) {
        if (usdc_ == address(0) || messenger_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        messenger = ITokenMessengerV2(messenger_);
        owner = owner_;
    }

    /// @param mintRecipient Left-padded Arc address that should receive the minted USDC. Use the treasury.
    /// @param maxFee CCTP fee ceiling in USDC units. Standard transfers use 0. The keeper can raise it.
    /// @param minFinalityThreshold 2000 for a standard attestation, 1000 for fast. Pass 0 to use 2000.
    function bridgeFee(
        bytes32 fillId,
        address maker,
        uint256 amount,
        bytes32 mintRecipient,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external {
        if (msg.sender != owner) revert NotOwner();
        if (maker == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (mintRecipient == bytes32(0)) revert ZeroRecipient();

        uint32 finality = minFinalityThreshold == 0 ? STANDARD_FINALITY : minFinalityThreshold;
        bytes memory hookData = abi.encode(fillId, maker);

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdc.forceApprove(address(messenger), amount);
        messenger.depositForBurnWithHook(
            amount, ARC_DOMAIN, mintRecipient, address(usdc), bytes32(0), maxFee, finality, hookData
        );

        emit FeeBurned(fillId, maker, amount, mintRecipient, ARC_DOMAIN);
    }

    function setOwner(address next) external {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert ZeroAddress();
        owner = next;
        emit OwnerSet(next);
    }
}
