// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IIndex.sol";

// Base contract for index calculators
abstract contract IndexCalculator {
	address private immutable _indexContract;

	int8 constant public SPOT_DECIMAL_COUNT = 10;
	int256 constant public SPOT_MULTIPLIER = int256(10**uint8(SPOT_DECIMAL_COUNT));
	int16 constant public WEIGHT_MULTIPLIER = 10000;

	constructor(address indexContract) {
		_indexContract = indexContract;
	}

	// Any deriving class must add this modifier to its prepareNewIndex() and calculateIndex() calls
	modifier isIndexContract() {
		require(msg.sender == _indexContract, "No access rights");
		_;
	}

	// Prepares a new index - implementing contract can reserve storage space etc
	function prepareNewIndex(
		uint256 numOfComponents,
		uint256 indexId,
		int256[] calldata params
	) public virtual;

	// Calculates the index value
	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 indexId
	) public virtual returns (int256);
}
