// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// When a contract is active and it is marked-to-market there are different ways
// to request collateral from the counterparty who is losing. One way is to request
// for full amount, but depending on how long contract is going to be running and
// on other parameters it might be better to prioritize capital efficiency with an
// understanding on the increased counterparty risk
interface ICollateralCalculator {
    // When contracts are marked to market during the activation there can be diffe
    function calculateCollateral(int256 totalPnL, int256[] calldata parameters) external returns (int256 revisedPnL);
}
