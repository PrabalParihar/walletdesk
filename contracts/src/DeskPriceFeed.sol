// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26 <0.8.31;

/// @notice Chainlink CRE consumer interface. The CRE forwarder calls `onReport` with the workflow
///         metadata and the ABI-encoded report the workflow produced.
interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IDeskPriceFeed {
    function referenceOf(bytes32 poolId) external view returns (uint256 priceX18, uint64 updatedAt);
}

/// @title DeskPriceFeed
/// @notice Off-chain reference price per Uniswap v4 pool, written by a Chainlink CRE workflow.
/// @dev `OverflowHook` reads this before it fills from a maker desk. If the desk quote deviates from the
///      reference by more than the maker's limit, or the reference is stale, the hook skips the desk and
///      the pool fills the whole swap. The pool spot alone can be pushed inside one transaction; an
///      off-chain reference cannot.
///
///      Report: `abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)`.
///      `priceX18` is raw token1 per 1 raw token0, scaled by 1e18 (the Uniswap v4 price unit).
///      `observedAt` is the workflow's observation time in seconds. Reports must move forward in time,
///      so a replayed or reordered report cannot roll the price back.
contract DeskPriceFeed is IReceiver, IERC165 {
    error NotOwner();
    error NotForwarder(address caller);
    error ZeroAddress();
    error ZeroPrice();
    error StaleReport(uint64 observedAt, uint64 current);
    error FutureReport(uint64 observedAt, uint256 nowTs);

    event ReferenceUpdated(bytes32 indexed poolId, uint256 priceX18, uint64 observedAt);
    event ForwarderSet(address indexed forwarder);
    event OwnerSet(address indexed owner);

    /// @notice Clock skew allowed between the workflow's observation time and the chain.
    uint256 public constant MAX_FUTURE_SKEW = 300;

    struct Reference {
        uint192 priceX18;
        uint64 updatedAt;
    }

    address public owner;
    /// @notice CRE KeystoneForwarder for the target chain. On a local fork the keeper EOA stands in.
    address public forwarder;

    mapping(bytes32 poolId => Reference) internal _refs;

    constructor(address forwarder_, address owner_) {
        if (forwarder_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        forwarder = forwarder_;
        owner = owner_;
        emit ForwarderSet(forwarder_);
        emit OwnerSet(owner_);
    }

    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);
        (bytes32 poolId, uint256 priceX18, uint64 observedAt) = abi.decode(report, (bytes32, uint256, uint64));
        if (priceX18 == 0 || priceX18 > type(uint192).max) revert ZeroPrice();
        if (observedAt > block.timestamp + MAX_FUTURE_SKEW) revert FutureReport(observedAt, block.timestamp);
        Reference storage ref = _refs[poolId];
        if (observedAt <= ref.updatedAt) revert StaleReport(observedAt, ref.updatedAt);
        ref.priceX18 = uint192(priceX18);
        ref.updatedAt = observedAt;
        emit ReferenceUpdated(poolId, priceX18, observedAt);
    }

    function referenceOf(bytes32 poolId) external view returns (uint256 priceX18, uint64 updatedAt) {
        Reference memory ref = _refs[poolId];
        return (ref.priceX18, ref.updatedAt);
    }

    function setForwarder(address next) external {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert ZeroAddress();
        forwarder = next;
        emit ForwarderSet(next);
    }

    function transferOwner(address next) external {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert ZeroAddress();
        owner = next;
        emit OwnerSet(next);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
