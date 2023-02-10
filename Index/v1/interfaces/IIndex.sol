// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IIndexCalculator.sol";
import "./IIndexFix.sol";

interface IIndex {
	struct OracleStorage {
		AggregatorV3Interface[] oracles;
		IndexCalculator calculator;
		IIndexFix fixStyle;
	}

	struct IndexStorage {
		uint32 markCount;
		uint64 markingStartTimestamp;
		uint64 markingPrevTimestamp;
		uint64 minDeltaBetweenMarkings;
		bytes32 oracleIndex;
		int256 currentIndexValue;
		address callingContract;
		int256[] strikes;
		int16[] weights;
	}
}
