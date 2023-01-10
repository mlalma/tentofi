// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IIndex.sol";
import "../interfaces/IIndexCalculator.sol";
import "../interfaces/IIndexFix.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Contains the logic for indices, i.e. the value of the index is calculated from spot prices
contract IndexTracker is IIndex, ReentrancyGuard {
	mapping(bytes32 => OracleStorage) public oracleStorage;
	mapping(uint256 => IndexStorage) public indices;
	uint256 public indexCounter = 1;

	event OracleStorageCreated(bytes32 oracleIndex);
	event SpotIndexCreated(uint256 indexCounter);
	event IndexCreated(uint256 indexCounter);
	event IndexFixed(uint256 indexCounter);

	constructor() {}

	function calculateOracleIndex(
		address[] calldata oracleAddresses,
		IIndexCalculator calculator,
		IIndexFix fix
	) public pure returns (bytes32) {
		return keccak256(abi.encodePacked(oracleAddresses, calculator, fix));
	}

	function getOracleStorage(bytes32 id) public view returns (OracleStorage memory) {
		return oracleStorage[id];
	}

	function getIndexStorage(uint256 id) public view returns (IndexStorage memory) {
		return indices[id];
	}

	function createOracleStorage(
		address[] calldata oracleAddresses,
		IIndexCalculator calculator,
		IIndexFix fix
	) public returns (bytes32 oracleIndex) {
		oracleIndex = calculateOracleIndex(oracleAddresses, calculator, fix);
		if (oracleStorage[oracleIndex].oracles.length == 0) {
			oracleStorage[oracleIndex].calculator = calculator;
			oracleStorage[oracleIndex].fixStyle = fix;
			for (uint256 i = 0; i < oracleAddresses.length; i++) {
				oracleStorage[oracleIndex].oracles.push(AggregatorV3Interface(oracleAddresses[i]));
			}
			emit OracleStorageCreated(oracleIndex);
		}
	}

	function createSpotIndex(
		bytes32 oracleIndex,
		int16[] calldata weights,
		int256[] calldata calculatorParams
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = type(uint32).max;
		index.minDeltaBetweenMarkings = 0;
		index.owner = msg.sender;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);
		emit SpotIndexCreated(indexCounter);

		indexCounter += 1;
		return indexCounter - 1;
	}

	// minDeltaBetweenMarkings is in seconds
	function createIndex(
		uint32 markCount,
		uint64 minDeltaBetweenMarkings,
		bytes32 oracleIndex,
		int16[] calldata weights,
		int256[] calldata calculatorParams
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = markCount;
		index.minDeltaBetweenMarkings = minDeltaBetweenMarkings;
		index.owner = msg.sender;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);
		emit IndexCreated(indexCounter);

		indexCounter += 1;
		return indexCounter - 1;
	}

	function fixIndex(uint256 indexId, int256[] calldata fixStyleParams) public nonReentrant {
		IndexStorage storage index = indices[indexId];

		require(msg.sender == index.owner);
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
		emit IndexFixed(indexId);
	}

	// forceCalculation can be used to force the final settlement value after the contract has run its course
	function calculateIndex(uint256 indexId, bool forceCalculation) public nonReentrant returns (int256 indexValue) {
		IndexStorage storage index = indices[indexId];

		require(msg.sender == index.owner);
		require(index.markingStartTimestamp > 0);
		require(
			forceCalculation ||
				(index.markCount > 0 && (index.markingPrevTimestamp + index.minDeltaBetweenMarkings < block.timestamp)),
			"All the marks used or delta between calls too short"
		);

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
