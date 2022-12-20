// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/IDTDEngineContract.sol";

contract EmptyMockContract is IDTDEngineContract {
	constructor() {}

	function markToMarket(
		uint256 /*contractId*/
	) external pure returns (int256, bool) {
		return (0, false);
	}

	function partyHasDefaulted(
		uint256, /*contractId*/
		address /*defaultedParty*/
	) external {}
}
