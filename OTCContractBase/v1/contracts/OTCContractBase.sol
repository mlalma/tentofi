// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "tento-dtd/v1/contracts/DTDEngine.sol";
import "tento-dtd/v1/interfaces/IDTDEngineContract.sol";
import "tento-index/v1/contracts/Index.sol";
import "../interfaces/ICollateralCalculator.sol";

abstract contract OTCContractBase is IDTDEngineContract {
    struct BaseContractData {
        // Data on DTDEngine
        // We can derive short & long party addresses etc from dtdContractId struct
        uint256 dtdContractId;
        // Underlying index
        uint256 indexId;
        // Collateral calculation logic when OTC instrument is active
        ICollateralCalculator collateralCalculator;
        // offer end time, contract lock time and contract end time
        uint64 offerEndTime;
        uint64 contractLockTime;
        uint64 contractEndTime;
    }
}
