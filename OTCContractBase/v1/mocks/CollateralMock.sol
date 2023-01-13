// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../contracts/CollateralCalculators.sol";

// This is helper contract for the unit testing
contract CollateralMock {
    FlatCollateralCalculator public immutable flat;
    LinearCollateralCalculator public immutable linear;

    int256 val;

    function getVal() public view returns (int256) {
        return val;
    }

    constructor(address flatCollateral, address linearCollateral) {
        flat = FlatCollateralCalculator(flatCollateral);
        linear = LinearCollateralCalculator(linearCollateral);
    }

    function calculateFlat(int256 PnL, int256[] calldata params) public {
        val = flat.calculateCollateral(PnL, params);
    }

    function calculateLinear(int256 PnL, int256[] calldata params) public {
        val = linear.calculateCollateral(PnL, params);
    }
}
