// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Index.sol";
import "../interfaces/IIndexCalculator.sol";

// Calculates absolute change in index ("L1 distance")
contract AbsoluteIndexCalculator is IIndexCalculator {
	constructor() {}

	function prepareNewIndex(uint256 numOfComponents, uint256 indexId) external {
		// For absolute change we don't need to store any data as the latest spot value is used
	}
}
