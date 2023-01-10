// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Index.sol";
import "../interfaces/IIndexCalculator.sol";
import "hardhat/console.sol";

int8 constant SPOT_DECIMAL_COUNT = 10;
int256 constant SPOT_MULTIPLIER = int256(10**uint8(SPOT_DECIMAL_COUNT));
int16 constant WEIGHT_MULTIPLIER = 10000;

// Calculates absolute change in index
contract AbsoluteSpotIndexCalculator is IndexCalculator {
	constructor(address indexContract) IndexCalculator(indexContract) {}

	function prepareNewIndex(
		uint256, /*numOfComponents*/
		uint256, /*indexId*/
		int256[] calldata params
	) public override isIndexContract {
		// For absolute change we don't need to store any data as the latest spot value is used
	}

	// Calculates absolute difference between spot price and strike of the index
	// Note For multiple underlyings this mignt not make whole lot of sense, use RelativeIndexCalculator instead
	// Note This should be used for tracking single underlying and setting the weights[0] to WEIGHT_MULTIPLIER
	// Note function returns the value standardized to 10 decimal points (thus 1 is 10000000000)
	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 /*indexId*/
	) public view override isIndexContract returns (int256) {
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
			spot += (diff * int256(indexData.weights[i])) / WEIGHT_MULTIPLIER;
		}
		return spot;
	}
}

// Calculates relative change in index
contract RelativeSpotIndexCalculator is IndexCalculator {
	enum CalculationStyle {
		average,
		min,
		max
	}
	mapping(uint256 => CalculationStyle) private relativeCalculationStyle;

	constructor(address indexContract) IndexCalculator(indexContract) {}

	function prepareNewIndex(
		uint256, /*numOfComponents*/
		uint256 indexId,
		int256[] calldata params
	) public override isIndexContract {
		// For relative change we don't need to store any data as the latest spot value is used
		relativeCalculationStyle[indexId] = CalculationStyle(params[0]);
	}

	// Calculates relative difference between spot price and strike of the index
	// Note function returns the value standardized to 10 decimal points (thus 100.0% up is 10000000000)
	// Note for multiple underlyings, define weights to appropriately calculate the index
	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 indexId
	) public view override isIndexContract returns (int256) {
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
			relativePrice = (relativePrice * int256(indexData.weights[i])) / WEIGHT_MULTIPLIER;
			if (style == CalculationStyle.average) {
				relativeSpot += relativePrice;
			} else if (style == CalculationStyle.min && relativePrice < relativeSpot) {
				relativeSpot = relativePrice;
			} else if (style == CalculationStyle.max && relativePrice > relativeSpot) {
				relativeSpot = relativePrice;
			}
		}

		return relativeSpot;
	}
}
