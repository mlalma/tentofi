// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./IIndex.sol";

interface IIndexCalculator {
	function prepareNewIndex(
		uint256 numOfComponents,
		uint256 indexId,
		int256[] calldata params
	) external;

	function calculateIndex(
		IIndex.OracleStorage memory oracleData,
		IIndex.IndexStorage memory indexData,
		uint256 indexId
	) external returns (int256);
}
