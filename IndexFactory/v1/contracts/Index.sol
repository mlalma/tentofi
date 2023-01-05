// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IIndex.sol";
import "../interfaces/IIndexCalculator.sol";
import "../interfaces/IIndexFix.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Contains the logic for ndices, i.e. the value of the index is calculated from spot prices
contract Index is IIndex, ReentrancyGuard {
	mapping(bytes32 => OracleStorage) private oracleStorage;
	mapping(uint256 => IndexStorage) private indices;
	uint256 private indexCounter = 1;

	constructor() {}

	function createOracleStorage(
		address[] calldata oracleAddresses,
		IIndexCalculator calculator,
		IIndexFix fix
	) public returns (bytes32 oracleIndex) {
		oracleIndex = keccak256(abi.encodePacked(oracleAddresses, calculator, fix));
		if (oracleStorage[oracleIndex].oracles.length == 0) {
			oracleStorage[oracleIndex].calculator = calculator;
			oracleStorage[oracleIndex].fixStyle = fix;
			for (uint256 i = 0; i < oracleAddresses.length; i++) {
				oracleStorage[oracleIndex].oracles.push(AggregatorV3Interface(oracleAddresses[i]));
			}
		}
	}

	function createSpotIndex(
		bytes32 oracleIndex,
		int8[] calldata weights,
		int256[] calldata calculatorParams
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = type(uint32).max;
		index.minDeltaBetweenMarkings = 0;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);

		indexCounter += 1;
		return indexCounter - 1;
	}

	function createIndex(
		uint32 markCount,
		uint64 minDeltaBetweenMarkings,
		bytes32 oracleIndex,
		int8[] calldata weights,
		int256[] calldata calculatorParams
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = markCount;
		index.minDeltaBetweenMarkings = minDeltaBetweenMarkings;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);

		indexCounter += 1;
		return indexCounter - 1;
	}

	function fixIndex(uint256 indexId, int256[] calldata fixStyleParams) public nonReentrant {
		IndexStorage storage index = indices[indexId];

		require(index.markingStartTimestamp == 0);
		require(index.markCount > 0);
		require(index.oracleIndex != bytes32(0));

		index.strikes = oracleStorage[index.oracleIndex].fixStyle.fixStrikes(
			oracleStorage[index.oracleIndex].oracles,
			fixStyleParams
		);

		index.markingStartTimestamp = uint64(block.timestamp);
		index.currentIndexValue = oracleStorage[index.oracleIndex].calculator.calculateIndex(
			oracleStorage[index.oracleIndex],
			index,
			indexId
		);
		index.markingPrevTimestamp = uint64(block.timestamp);
	}

	function calculateIndex(uint256 indexId) public nonReentrant returns (int256 indexValue) {
		IndexStorage storage index = indices[indexId];

		require(index.markingStartTimestamp >= 0);

		if (
			index.markCount == 0 ||
			(index.minDeltaBetweenMarkings > 0 &&
				(index.markingPrevTimestamp + index.minDeltaBetweenMarkings < block.timestamp))
		) {
			return index.currentIndexValue;
		}

		indexValue = oracleStorage[index.oracleIndex].calculator.calculateIndex(
			oracleStorage[index.oracleIndex],
			index,
			indexId
		);

		index.currentIndexValue = indexValue;
		index.markCount -= 1;
		index.markingPrevTimestamp = uint64(block.timestamp);
	}
}
