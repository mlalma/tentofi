// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockOracle is AggregatorV3Interface {
	uint256 pos = 0;

	int256[] vals;
	uint256 decimalCount = 6;

	string descriptionStr = "Mock";
	uint256 versionNum = 1;

	bool crash = false;
	int256 crashValue = 0;

	constructor() {}

	function setDecimalCount(uint8 newDecimalCount) public {
		decimalCount = newDecimalCount;
	}

	function setVals(int256[] calldata newVals) public {
		require(newVals.length > 0);

		vals = new int256[](newVals.length);
		for (uint256 i = 0; i < newVals.length; i++) {
			vals[i] = newVals[i];
		}
		pos = 0;
	}

	function increasePos() public {
		pos = (pos + 1) % vals.length;
	}

	function modifyPos(uint256 newPos) external {
		pos = newPos % vals.length;
	}

	function decimals() external view returns (uint8) {
		return uint8(decimalCount);
	}

	function description() external view returns (string memory) {
		return descriptionStr;
	}

	function version() external view returns (uint256) {
		return versionNum;
	}

	function doCrash() public {
		crash = true;
	}

	function getRoundData(
		uint80 /*_roundId*/
	)
		external
		view
		returns (
			uint80 roundId,
			int256 answer,
			uint256 startedAt,
			uint256 updatedAt,
			uint80 answeredInRound
		)
	{
		int256 val = vals[pos];
		if (crash) {
			val = crashValue;
		}

		return (0, val, 0, 0, 0);
	}

	function latestRoundData()
		external
		view
		returns (
			uint80 roundId,
			int256 answer,
			uint256 startedAt,
			uint256 updatedAt,
			uint80 answeredInRound
		)
	{
		int256 val = vals[pos];
		if (crash) {
			val = crashValue;
		}

		return (0, val, 0, 0, 0);
	}
}
