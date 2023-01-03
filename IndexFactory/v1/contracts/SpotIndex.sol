// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IndexFactory.sol";
import "../interfaces/ISpotIndexCalculator.sol";

// Contains the logic for spot indices, i.e. the value of the index is calculated from spot prices
contract SpotIndex {
	struct OracleStorage {
		AggregatorV3Interface[] oracles;
		ISpotIndexCalculator calculator;
	}
	mapping(bytes32 => OracleStorage) private oracleStorage;

	struct SpotIndexStorage {
		bytes32 oracleIndex;
		uint8[] weights;
		IndexFactory.UnderlyingFix fixStyle;
		int256[] fixStyleParams;
	}
	mapping(uint256 => SpotIndexStorage) private indices;
	uint256 private indexCounter = 1;

	constructor() {}

	function createOracleStorage(address[] calldata oracleAddresses, ISpotIndexCalculator calculator)
		public
		returns (bytes32 oracleIndex)
	{
		oracleIndex = keccak256(abi.encodePacked(oracleAddresses, calculator));
		if (oracleStorage[oracleIndex].oracles.length == 0) {
			oracleStorage[oracleIndex].calculator = calculator;
			oracleStorage[oracleIndex].oracles = new AggregatorV3Interface[](oracleAddresses.length);
			for (uint256 i = 0; i < oracleAddresses.length; i++) {
				oracleStorage[oracleIndex].oracles.push(AggregatorV3Interface(oracleAddresses[i]));
			}
		}
	}

	function createSpotIndex(
		bytes32 oracleIndex,
		uint8[] calldata weights,
		IndexFactory.UnderlyingFix fixStyle,
		int256[] calldata fixStyleParams
	) public returns (uint256) {
		require(oracleStorage[oracleIndex].oracles.length == weights.length);
		require(fixStyle != IndexFactory.UnderlyingFix.done);

		SpotIndexStorage memory indexStorage;
		indexStorage.oracleIndex = oracleIndex;
		indexStorage.fixStyle = fixStyle;
		indexStorage.weights = weights;
		indexStorage.fixStyleParams = fixStyleParams;
	}

	function fixSpotIndex() public {}
}
