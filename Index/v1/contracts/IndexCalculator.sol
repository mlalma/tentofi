// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Index.sol";
import "../interfaces/IIndexCalculator.sol";

int8 constant SPOT_DECIMAL_COUNT = 10;
int256 constant SPOT_MULTIPLIER = int256(10**uint8(SPOT_DECIMAL_COUNT));

// Calculates absolute change in index
contract AbsoluteIndexCalculator is IIndexCalculator {
	constructor() {}

	function prepareNewIndex(
		uint256, /*numOfComponents*/
		uint256, /*indexId*/
		int256[] calldata params
	) external {
		// For absolute change we don't need to store any data as the latest spot value is used
	}

	// Calculates absolute difference between spot price and strike of the index
	// Note For multiple underlyings this mignt not make whole lot of sense, use RelativeIndexCalculator instead
	// Note This should be used for tracking single underlying and setting the weights[0] to 100
	// Note function returns the value standardized to 10 decimal points (thus 1 is 10000000000)
	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 /*indexId*/
	) external view returns (int256) {
		int256 spot = 0;
		for (uint256 i = 0; i < indexData.strikes.length; i++) {
			(, int256 price, , , ) = oracleData.oracles[i].latestRoundData();
			int256 diff = price - indexData.strikes[i];
			int8 decimalDiff = int8(oracleData.oracles[i].decimals()) - SPOT_DECIMAL_COUNT;
			if (decimalDiff > 0) {
				diff /= int256(10**uint8(decimalDiff));
			} else if (decimalDiff < 0) {
				diff *= int256(10**uint8(-decimalDiff));
			}
			spot += (diff * int256(indexData.weights[i])) / 100;
		}
		return spot;
	}
}

// Calculates relative change in index
contract RelativeIndexCalculator is IIndexCalculator {
	enum CalculationStyle {
		average,
		min,
		max
	}
	mapping(uint256 => CalculationStyle) private relativeCalculationStyle;

	constructor() {}

	function setRelativeCalculationStyle(CalculationStyle style, uint256 indexId) public {
		relativeCalculationStyle[indexId] = style;
	}

	function prepareNewIndex(
		uint256, /*numOfComponents*/
		uint256 indexId,
		int256[] calldata params
	) external {
		// For relative change we don't need to store any data as the latest spot value is used
		relativeCalculationStyle[indexId] = CalculationStyle(params[0]);
	}

	// Calculates relative difference between spot price and strike of the index
	// Note function returns the value standardized to 10 decimal points (thus 100.0% increase is 10000000000)
	// Note for multiple underlyings, define weights to appropriately calculate the index
	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 indexId
	) external view returns (int256) {
		int256 relativeSpot = 0;

		CalculationStyle style = relativeCalculationStyle[indexId];
		if (style == CalculationStyle.min) {
			relativeSpot = type(int256).max;
		} else if (style == CalculationStyle.max) {
			relativeSpot = type(int256).min;
		}

		for (uint256 i = 0; i < indexData.strikes.length; i++) {
			(, int256 price, , , ) = oracleData.oracles[i].latestRoundData();
			int256 relativePrice = ((price * SPOT_MULTIPLIER) / indexData.strikes[i]) - SPOT_MULTIPLIER;
			if (style == CalculationStyle.average) {
				relativeSpot += (relativePrice * int256(indexData.weights[i])) / 100;
			} else if (style == CalculationStyle.min && relativePrice < relativeSpot) {
				relativeSpot = relativePrice;
			} else if (style == CalculationStyle.max && relativePrice > relativeSpot) {
				relativeSpot = relativePrice;
			}
		}

		return relativeSpot;
	}
}
