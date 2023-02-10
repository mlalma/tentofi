// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../interfaces/IIndex.sol";
import "../interfaces/IIndexCalculator.sol";
import "../interfaces/IIndexFix.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Contains the logic for calculating index values.
// The value of an index is calculated from prices of one or more sources.
// The sources are Chainlink oracles.
// Before index can be calculated it needs to be "fixed" to a start value.
// There are different kind of ways to fix the start value, see IndexFix.sol and IIndexFix.sol
// Once the fixing has happened, the index value can be calculated.
// There are multiple different ways to calculate an Index value, see IndexCalculator.sol and IIndexCalculator.sol
// Path-dependent products are supported by adding calculators that save the state when calculateIndex() is called
// Adding new calculators by deriving from IIndexCalculator is an easy way to create indices for complex products
contract IndexTracker is IIndex, ReentrancyGuard {
	mapping(bytes32 => OracleStorage) public oracleStorage;
	mapping(uint256 => IndexStorage) public indices;
	uint256 public indexCounter = 1;

	event OracleStorageCreated(bytes32 oracleIndex);
	event SpotIndexCreated(uint256 indexCounter);
	event IndexCreated(uint256 indexCounter);
	event IndexFixed(uint256 indexCounter);

	constructor() {}

	// Returns oracle index mapped to oracleStorage
	function calculateOracleIndex(
		address[] calldata oracleAddresses,
		IndexCalculator calculator,
		IIndexFix fix
	) public pure returns (bytes32) {
		return keccak256(abi.encodePacked(oracleAddresses, calculator, fix));
	}

	// Returns oracle storage element (for testing)
	function getOracleStorage(bytes32 id) public view returns (OracleStorage memory) {
		return oracleStorage[id];
	}

	// Returns index storage element (for testing)
	function getIndexStorage(uint256 id) public view returns (IndexStorage memory) {
		return indices[id];
	}

	// Checks if oracle storage exists and if not then creates new one.
	// Oracle storage element consists of oracle addresses, fixing logic and calculation logic.
	// Oracle addresses should be ordered in array in ascending order
	function createOracleStorage(
		address[] calldata oracleAddresses,
		IndexCalculator calculator,
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

	// Creates spot index. Spot index is a special kind of index where mark-to-market markings can be done on every block
	// Weights can be positive or negative to create long/short positions for individual sources of a basket.
	// For weights, 100% ("full") participation is value 10000 and e.g. 50% weight would be 5000.
	function createSpotIndex(
		bytes32 oracleIndex,
		int16[] calldata weights,
		int256[] calldata calculatorParams,
		address callingContract
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = type(uint32).max;
		index.minDeltaBetweenMarkings = 0;
		index.callingContract = callingContract;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);
		emit SpotIndexCreated(indexCounter);

		indexCounter += 1;
		return indexCounter - 1;
	}

	// Creates a general index. markCount is the maximum number of times index calculation can be performed during the lifetime of the contract
	// minDeltaBetweenMarkings is in seconds and defines what is the minimum delta between two calculations (in seconds).
	// For weights, 100% ("full") participation is value 10000 and e.g. 50% weight would be 5000.
	// "callingContract" is the instrument that is expected (and the only one that can) to call the fixIndex() and calculateIndex()
	function createIndex(
		uint32 markCount,
		uint64 minDeltaBetweenMarkings,
		bytes32 oracleIndex,
		int16[] calldata weights,
		int256[] calldata calculatorParams,
		address callingContract
	) public nonReentrant returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);

		IndexStorage memory index;
		index.oracleIndex = oracleIndex;
		index.weights = weights;
		index.markCount = markCount;
		index.minDeltaBetweenMarkings = minDeltaBetweenMarkings;
		index.callingContract = callingContract;
		indices[indexCounter] = index;

		oracleStorage[oracleIndex].calculator.prepareNewIndex(weights.length, indexCounter, calculatorParams);
		emit IndexCreated(indexCounter);

		indexCounter += 1;
		return indexCounter - 1;
	}

	// Fixes the index so that an index value can be calculated
	function fixIndex(uint256 indexId, int256[] calldata fixStyleParams) public nonReentrant {
		IndexStorage storage index = indices[indexId];

		require(msg.sender == index.callingContract);
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

	// Calculates the index value that can be used for mark-to-market / settlement purposes
	// forceCalculation can be used to force the final settlement value after the contract has run its course
	function calculateIndex(uint256 indexId, bool forceCalculation) public nonReentrant returns (int256 indexValue) {
		IndexStorage storage index = indices[indexId];

		require(msg.sender == index.callingContract);
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
