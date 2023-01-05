// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Index.sol";
import "../interfaces/IIndexCalculator.sol";
import "../interfaces/IIndexFix.sol";

contract IndexFactory is AccessControl {
	bytes32 public constant INDEXFACTORY_ADMIN_ROLE = keccak256("INDEXFACTORY_ADMIN_ROLE");

	Index private indexContract;

	constructor(address _indexContract) AccessControl() {
		_grantRole(DEFAULT_ADMIN_ROLE, tx.origin);
		_grantRole(INDEXFACTORY_ADMIN_ROLE, tx.origin);

		indexContract = Index(_indexContract);
	}

	function setIndexContractAddress(address addr) external onlyRole(INDEXFACTORY_ADMIN_ROLE) {
		indexContract = Index(addr);
	}

	// Note that oracles should be given in ascending order based on their addresses to minimize gas costs
	// All oracles must be Chainlink oracles and implement AggregatorV3Interface
	function createSpotIndex(
		address[] calldata oracleAddresses,
		IIndexCalculator calculator,
		IIndexFix fix,
		uint8[] calldata weights
	) external {
		bytes32 oracleIndex = indexContract.createOracleStorage(oracleAddresses, calculator, fix);
		indexContract.createSpotIndex(oracleIndex, weights);
	}
}
