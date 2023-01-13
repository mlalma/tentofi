// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/ICollateralCalculator.sol";

int256 constant PERCENTAGE_MULTIPLIER = 10000;

// Helper methods for different kinds of collateralization strategies
abstract contract BaseCollateralCalculator is ICollateralCalculator {
    constructor() {}

    function max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }

    function min(int256 a, int256 b) internal pure returns (int256) {
        return a <= b ? a : b;
    }
}

// Flat-percentage collateralization strategy from the PnL
contract FlatCollateralCalculator is BaseCollateralCalculator {
    constructor() {}

    // First parameter is percentage of time used from start (0% - 100%) shown as 0 - 10000 (not needed)
    // Second parameter is the base level percentage between 0 - 10000 (0% - 100%)
    // If it is 10000 then fully collaterized to mark-to-market values
    // If is is 0 then there are pre-2008 vibes and no collateral is required before settlement
    function calculateCollateral(int256 totalPnL, int256[] calldata parameters)
        public
        pure
        returns (int256)
    {
        int256 collaterizationPercentage = max(
            0,
            min(PERCENTAGE_MULTIPLIER, parameters[1])
        );
        return (totalPnL * collaterizationPercentage) / PERCENTAGE_MULTIPLIER;
    }
}

// Linearly increasing collateralization requirement
contract LinearCollateralCalculator is BaseCollateralCalculator {
    constructor() {}

    // First parameter is percentage of time used from start (0% - 100%) shown as 0 - 10000
    // Second parameter is the base level between 0 - 10000 (0% - 100%)
    function calculateCollateral(int256 totalPnL, int256[] calldata parameters)
        public
        pure
        returns (int256)
    {
        int256 totalPnLCollaterizationPercentage = max(
            0,
            min(PERCENTAGE_MULTIPLIER, parameters[0] + parameters[1])
        );
        return
            (totalPnL * totalPnLCollaterizationPercentage) /
            PERCENTAGE_MULTIPLIER;
    }
}
