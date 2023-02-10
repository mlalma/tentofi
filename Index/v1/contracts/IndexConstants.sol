// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

library IndexConstants {
    int8 constant public SPOT_DECIMAL_COUNT = 10;
	int256 constant public SPOT_MULTIPLIER = int256(10**uint8(SPOT_DECIMAL_COUNT));
	int16 constant public WEIGHT_MULTIPLIER = 10000;

    function getSpotDecimalCount() pure public returns (int8) { return SPOT_DECIMAL_COUNT; }
    function getSpotMultiplier() pure public returns (int256) { return SPOT_MULTIPLIER; }
    function getWeightMultiplier() pure public returns (int16) { return WEIGHT_MULTIPLIER; }
}
