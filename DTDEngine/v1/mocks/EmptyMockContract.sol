// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../interfaces/IDTDEngineContract.sol";
import "hardhat/console.sol";

contract EmptyMockContract is IDTDEngineContract {
	int256[] private payoffProfile;
	uint256 private curPayoffPosition = 0;
	bool private dunzo = false;
	bool private defaultHappened = false;

	constructor() {
		payoffProfile = new int256[](1);
		payoffProfile.push(0);
	}

	function setPayoff(int256[] calldata payoffs) external {
		payoffProfile = payoffs;
		curPayoffPosition = 0;
		dunzo = false;
	}

	function increasePayoffPosition() external {
		if (dunzo) {
			return;
		}
		dunzo = curPayoffPosition + 1 >= payoffProfile.length - 1;
		curPayoffPosition = (curPayoffPosition + 1) % payoffProfile.length;
	}

	function setPayoffPosition(uint256 newPosition) external {
		curPayoffPosition = newPosition % payoffProfile.length;
		dunzo = false;
	}

	function _getPayoff() internal view returns (int256) {
		return payoffProfile[curPayoffPosition];
	}

	function getPayoff() external view returns (int256) {
		return _getPayoff();
	}

	function markToMarket(
		uint256 /*contractId*/
	) external view returns (int256, bool) {
		return (_getPayoff(), dunzo);
	}

	function partyHasDefaulted(
		uint256, /*contractId*/
		address /*defaultedParty*/
	) external {
		defaultHappened = true;
	}

	function hasDefaulted() external view returns (bool) {
		return defaultHappened;
	}

	function setDunzo(bool dunzod) external {
		dunzo = dunzod;
	}
}
