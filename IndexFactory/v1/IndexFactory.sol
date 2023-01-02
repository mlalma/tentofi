// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract IndexFactory is AccessControl {
    bytes32 public constant INDEXFACTORY_ADMIN_ROLE = keccak256("INDEXFACTORY_ADMIN_ROLE");

    address private spotIndexContract;
    address private markIndexContract;

    constructor(address _spotIndexContract, address _markIndexContract) AccessControl() {
        _grantRole(DEFAULT_ADMIN_ROLE, tx.origin);
        _grantRole(INDEXFACTORY_ADMIN_ROLE, tx.origin);

        spotIndexContract = _spotIndexContract;
        markIndexContract = _markIndexContract;
    }

    function setSpotIndexContractAddress(address addr) onlyRole(INDEXFACTORY_ADMIN_ROLE) external { 
        spotIndexContract = addr; 
    }

    function setMarkIndexContractAddress(address addr) onlyRole(INDEXFACTORY_ADMIN_ROLE) external { 
        markIndexContract = addr;
    }

    function createSpotIndex() external {

    }
}