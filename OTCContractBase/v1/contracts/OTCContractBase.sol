// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "tento-dtd/v1/contracts/DTDEngine.sol";
import "tento-dtd/v1/interfaces/IDTDEngineContract.sol";
import "tento-index/v1/contracts/Index.sol";
import "../interfaces/ICollateralCalculator.sol";

abstract contract OTCContractBase is IDTDEngineContract {
    // Different contract states:
    // open               - Contract has not been locked, i.e. there are no two counterparties
    // active             - Contract is active, counterparties have agreed on the contract
    // inactive           - Contract is running, but it is inactive and requires e.g. a knock-in event before P/L will be calculated
    // terminated         - There has been a default event (or similar) that has closed the contract before settlement date
    //                      NOTE! Termination means that margin levels were breached and penalty margin gets moved to
    //                      another party. If there has been e.g. a knock-out event, then contract moves to "settled" state
    // settled            - Settlement date has passed and contract has been closed or then contract is closed early
    //                      without a margin event
    enum ContractState {
        open,
        active,
        inactive,
        terminated,
        settled
    }

    struct BaseContractData {
        // Data on DTDEngine
        // We can derive short & long party addresses etc from dtdContractId struct
        uint256 dtdContractId;
        // Underlying index
        uint256 indexId;
        // Collateral calculation logic when OTC instrument is active
        ICollateralCalculator collateralCalculator;
        int256[] collateralCalculatorParams;
        // offer end time, contract lock time and contract end time
        uint64 offerEndTime;
        uint64 contractLockTime;
        uint64 contractEndTime;
    }

    constructor() {}
}
