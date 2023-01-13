// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/ICollateralCalculator.sol";

int256 constant PERCENTAGE_MULTIPLIER = 10000;

// Always full collaterization
contract FullCollateralStrategy is ICollateralCalculator {

    constructor() {}

    function calculateCollateral(int256 totalPnL, int256[] calldata /*parameters*/) external pure returns (int256 revisedPnL) {
        return totalPnL; 
    }
}

// Pre-2008 vibes, no collateral required before settlement
contract ZeroCollateralStrategy is ICollateralCalculator {

    constructor() {}

    function calculateCollateral(int256 /*totalPnL*/, int256[] calldata /*parameters*/) external pure returns (int256 revisedPnL) {
        return 0;
    }
}

// Linearly increasing collaterization requirement
contract LinearCollateralStrategy is ICollateralCalculator {

    constructor() {}

    function max(int256 a, int256 b) internal pure returns (int256) {
        return a <= b ? a : b;
    }

    function min(int256 a, int256 b) internal pure returns (int256) {
        return a <= b ? a : b;
    }

    // First parameter is percentage of time used from start (0% - 100%) shown as 0 - 10000
    // Second parameter is the base level between 0 - 10000 (0% - 100%)
    function calculateCollateral(int256 totalPnL, int256[] calldata parameters) external pure returns (int256 revisedPnL) {
        int256 totalPnLCollaterizationPercentage = max(0, min(PERCENTAGE_MULTIPLIER, parameters[0] + parameters[1]));
        return (totalPnL * totalPnLCollaterizationPercentage) / PERCENTAGE_MULTIPLIER; 
    }
}