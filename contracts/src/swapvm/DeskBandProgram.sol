// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title DeskBandProgram
/// @notice SwapVM bytecode for the WalletDesk opcode.
/// @dev Layout matches the SwapVM run loop: `[opcode:1][argsLen:1][args]`.
///      Opcode 10 is DeskBand on WalletDeskRouter. Arguments are packed, not ABI-encoded:
///      priceLowX18 (32) | priceHighX18 (32) | feeBps (2) | start (4) | halfLife (4).
library DeskBandProgram {
    /// @dev WalletDeskRouter registers DeskBand at index 0. The stock router reserves 0-9;
    ///      this modified router does not.
    uint8 internal constant OPCODE = 0;
    uint256 internal constant ARGS_LEN = 74;

    error DeskBandProgramLength(uint256 length);
    error DeskBandProgramOpcode(uint8 opcode);

    struct Params {
        uint256 priceLowX18;
        uint256 priceHighX18;
        uint16 feeBps;
        uint32 start;
        uint32 halfLife;
    }

    function encode(Params memory p) internal pure returns (bytes memory program) {
        bytes memory args = abi.encodePacked(p.priceLowX18, p.priceHighX18, p.feeBps, p.start, p.halfLife);
        if (args.length != ARGS_LEN) revert DeskBandProgramLength(args.length);
        program = abi.encodePacked(OPCODE, uint8(ARGS_LEN), args);
    }

    function decodeArgs(bytes calldata args) internal pure returns (Params memory p) {
        if (args.length != ARGS_LEN) revert DeskBandProgramLength(args.length);
        p.priceLowX18 = uint256(bytes32(args[0:32]));
        p.priceHighX18 = uint256(bytes32(args[32:64]));
        p.feeBps = uint16(bytes2(args[64:66]));
        p.start = uint32(bytes4(args[66:70]));
        p.halfLife = uint32(bytes4(args[70:74]));
    }

    function decodeProgram(bytes calldata program) internal pure returns (Params memory p) {
        if (program.length != 2 + ARGS_LEN) revert DeskBandProgramLength(program.length);
        if (uint8(program[0]) != OPCODE) revert DeskBandProgramOpcode(uint8(program[0]));
        if (uint8(program[1]) != ARGS_LEN) revert DeskBandProgramLength(uint8(program[1]));
        p = decodeArgs(program[2:]);
    }
}
