// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IIndexCalculator {
	function prepareNewIndex(uint256 numOfComponents, uint256 indexId) external;
}
