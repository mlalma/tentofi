// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IIndex.sol";

// Interface that any fixing logic needs to implement
interface IIndexFix {
	function fixStrikes(AggregatorV3Interface[] calldata oracles, int256[] calldata fixParams)
		external
		returns (int256[] memory strikes);
}
