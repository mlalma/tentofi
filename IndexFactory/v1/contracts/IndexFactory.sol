// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./SpotIndex.sol";

contract IndexFactory is AccessControl {
	bytes32 public constant INDEXFACTORY_ADMIN_ROLE = keccak256("INDEXFACTORY_ADMIN_ROLE");

	enum UnderlyingFix {
		noFix,
		spot,
		spotMulPercentage,
		spotPlusAbsolute,
		spotMulPlusAbsolute,
		done
	}

	SpotIndex private spotIndexContract;
	address private markIndexContract;

	constructor(address _spotIndexContract, address _markIndexContract) AccessControl() {
		_grantRole(DEFAULT_ADMIN_ROLE, tx.origin);
		_grantRole(INDEXFACTORY_ADMIN_ROLE, tx.origin);

		spotIndexContract = SpotIndex(_spotIndexContract);
		markIndexContract = _markIndexContract;
	}

	function setSpotIndexContractAddress(address addr) external onlyRole(INDEXFACTORY_ADMIN_ROLE) {
		spotIndexContract = SpotIndex(addr);
	}

	function setMarkIndexContractAddress(address addr) external onlyRole(INDEXFACTORY_ADMIN_ROLE) {
		markIndexContract = addr;
	}

	// Note that oracles should be given in ascending order based on their addresses to minimize gas costs
	// All oracles must be Chainlink oracles and implement AggregatorV3Interface
	function createSpotIndex(
		address[] calldata oracleAddresses,
		ISpotIndexCalculator calculator,
		uint8[] calldata weights,
		UnderlyingFix fixStyle,
		int256[] calldata fixStyleParams
	) external {
		bytes32 oracleIndex = spotIndexContract.createOracleStorage(oracleAddresses, calculator);
	}
}
