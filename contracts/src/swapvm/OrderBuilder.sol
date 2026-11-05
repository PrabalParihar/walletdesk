// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ISwapVM} from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import {MakerTraits, MakerTraitsLib} from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import {TakerTraitsLib} from "@1inch/swap-vm/src/libs/TakerTraits.sol";

import {DeskBandProgram} from "./DeskBandProgram.sol";

/// @title OrderBuilder
/// @notice Packs a DeskBand Aqua order with the official MakerTraits encoder.
/// @dev Lives in the 0.8.30 SwapVM compilation unit. The 0.8.26 hook calls the router with the
///      same ABI and does not import this file.
contract OrderBuilder {
    function build(address maker, uint16 feeBps, uint32 start, uint32 halfLife)
        external
        pure
        returns (uint256 traits, bytes memory data, bytes memory strategy)
    {
        return buildBand(maker, 0.99 ether, 1.01 ether, feeBps, start, halfLife);
    }

    /// @notice Same packing as `build`, with the maker's price band instead of the 0.99 to 1.01 demo band.
    function buildBand(
        address maker,
        uint256 priceLowX18,
        uint256 priceHighX18,
        uint16 feeBps,
        uint32 start,
        uint32 halfLife
    ) public pure returns (uint256 traits, bytes memory data, bytes memory strategy) {
        ISwapVM.Order memory order = MakerTraitsLib.build(
            MakerTraitsLib.Args({
                maker: maker,
                receiver: address(0),
                shouldUnwrapWeth: false,
                useAquaInsteadOfSignature: true,
                allowZeroAmountIn: false,
                hasPreTransferInHook: false,
                hasPostTransferInHook: false,
                hasPreTransferOutHook: false,
                hasPostTransferOutHook: false,
                preTransferInTarget: address(0),
                preTransferInData: "",
                postTransferInTarget: address(0),
                postTransferInData: "",
                preTransferOutTarget: address(0),
                preTransferOutData: "",
                postTransferOutTarget: address(0),
                postTransferOutData: "",
                program: DeskBandProgram.encode(
                    DeskBandProgram.Params({
                        priceLowX18: priceLowX18,
                        priceHighX18: priceHighX18,
                        feeBps: feeBps,
                        start: start,
                        halfLife: halfLife
                    })
                )
            })
        );
        traits = MakerTraits.unwrap(order.traits);
        data = order.data;
        strategy = abi.encode(order);
    }

    function standardTakerData() external pure returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: address(0),
                isExactIn: true,
                shouldUnwrapWeth: false,
                isStrictThresholdAmount: false,
                isFirstTransferFromTaker: false,
                useTransferFromAndAquaPush: true,
                threshold: "",
                to: address(0),
                deadline: 0,
                hasPreTransferInCallback: false,
                hasPreTransferOutCallback: false,
                preTransferInHookData: "",
                postTransferInHookData: "",
                preTransferOutHookData: "",
                postTransferOutHookData: "",
                preTransferInCallbackData: "",
                preTransferOutCallbackData: "",
                instructionsArgs: "",
                signature: ""
            })
        );
    }
}
