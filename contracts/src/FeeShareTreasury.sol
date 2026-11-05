// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title FeeShareTreasury
/// @notice USDC fee claims for WalletDesk. Paste this file into an Arc Studio project and deploy it there.
///
/// Arc differences this contract is written around (https://docs.arc.io/arc/references/evm-differences):
/// - USDC is the native gas token. The native balance uses 18 decimals. The ERC-20 interface at the same
///   asset uses 6 decimals. One native unit equals 1e12 ERC-20 units. This contract accounts only in the
///   6-decimal ERC-20 interface. It never reads `msg.value` and it never sends native value.
/// - `receive` and `fallback` revert so a native transfer cannot be mistaken for a 6-decimal deposit.
/// - Transfers of native value to address(0) revert on Arc. This contract rejects address(0) recipients.
/// - `PREVRANDAO` is always 0 on Arc. Nothing here uses it.
/// - Block timestamps are not strictly increasing. Claims are ordered by balance, not by timestamp.
/// - The mempool drops transactions with maxFeePerGas below 20 gwei. The deploy script documents that floor.
/// - `balanceOf` truncates sub-micro amounts. Do not credit from a native balance; credit the 6-decimal amount
///   the attestor measured.
///
/// Cross-chain note: Aqua is not deployed on Arc. A fill is proven on Unichain (or a fork). An attestor then
/// calls `creditFromFill` here. CCTP is intentionally not in this contract.
contract FeeShareTreasury {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    /// @notice Multiply a 6-decimal USDC amount to express it in Arc's 18-decimal native units.
    uint256 public constant NATIVE_PER_ERC20 = 1e12;

    error NotOwner();
    error NotAttestor();
    error ZeroAddress();
    error ZeroAmount();
    error AlreadyCredited(bytes32 fillId);
    error SplitTooHigh(uint16 bps);
    error NothingToClaim();
    error Insolvent(uint256 need, uint256 have);
    error NativeValueDisabled();

    event Deposited(address indexed from, uint256 amount);
    event Credited(bytes32 indexed fillId, address indexed maker, uint256 makerAmount, uint256 protocolAmount);
    event Claimed(address indexed maker, uint256 amount);
    event SplitSet(address indexed protocol, uint16 protocolBps);
    event AttestorSet(address indexed attestor);

    IERC20 public immutable usdc;
    address public owner;
    address public attestor;
    address public protocol;
    uint16 public protocolBps;
    uint256 public totalClaimable;

    mapping(address => uint256) public claimable;
    mapping(bytes32 => bool) public fillCredited;

    constructor(address usdc_, address attestor_, address owner_) {
        if (usdc_ == address(0) || attestor_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        attestor = attestor_;
        owner = owner_;
    }

    receive() external payable {
        revert NativeValueDisabled();
    }

    fallback() external payable {
        revert NativeValueDisabled();
    }

    /// @notice Pull 6-decimal ERC-20 USDC into the treasury. Ignores native value on purpose.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Demo attestor credits a maker for a fill id proven on the Unichain desk.
    /// @param amount 6-decimal USDC. Not the fee token's raw amount unless that token is this USDC.
    function creditFromFill(bytes32 fillId, address maker, uint256 amount) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (maker == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (fillCredited[fillId]) revert AlreadyCredited(fillId);

        uint256 protocolCut = uint256(protocolBps) == 0 || protocol == address(0)
            ? 0
            : (amount * protocolBps) / BPS;
        uint256 makerCut = amount - protocolCut;

        uint256 need = totalClaimable + amount;
        uint256 have = usdc.balanceOf(address(this));
        if (have < need) revert Insolvent(need, have);

        fillCredited[fillId] = true;
        totalClaimable = need;
        claimable[maker] += makerCut;
        if (protocolCut > 0) claimable[protocol] += protocolCut;
        emit Credited(fillId, maker, makerCut, protocolCut);
    }

    function claim() external {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        totalClaimable -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Optional protocol split for the stablecoin-logic track. `protocolBps` is out of 10_000.
    function setSplit(address protocol_, uint16 protocolBps_) external {
        if (msg.sender != owner) revert NotOwner();
        if (protocolBps_ > BPS) revert SplitTooHigh(protocolBps_);
        if (protocolBps_ > 0 && protocol_ == address(0)) revert ZeroAddress();
        protocol = protocol_;
        protocolBps = protocolBps_;
        emit SplitSet(protocol_, protocolBps_);
    }

    function setAttestor(address next) external {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert ZeroAddress();
        attestor = next;
        emit AttestorSet(next);
    }

    function transferOwner(address next) external {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert ZeroAddress();
        owner = next;
    }

    /// @notice Claimable balance expressed in Arc native (18 decimal) units. Display only.
    function claimableNativeUnits(address maker) external view returns (uint256) {
        return claimable[maker] * NATIVE_PER_ERC20;
    }
}
