// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract NordPoolDayAheadOracle is AccessControl, Pausable {
  // Administrator administers the whole contract and can decide the input sources
	bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
	// Input source can update the data on the oracle contract
	bytes32 public constant ORACLE_INPUT_ROLE = keccak256("ORACLE_INPUT_SOURCE");

  // Market name to define for which Nord Pool market this oracle is for, e.g. FI, AT, BE
  string private marketName = "";

  // UNIX timestamp that can be converted to figure out the exact date for which the electricity prices are meant
  uint64 private pricesForDay;

  // Hourly prices for the electricity are stored in the array in following fashion:
  // 0th index is for the hour 00:00 - 01:00
  // 1st index is for the hour 01:00 - 02:00
  // ..
  // 23rd index is for the hour 23:00 - 24:00
  // The number itself presents price given as EUR/MWh using 10^9 fixed point  
  // e.g. 123.45 EUR/MWh (0.12345 EUR/kWh ~ 12.35 cents per kWH) is presented as 123450000000
  // e.g. 67.89 EUR/MWh (0.06789 EUR/kWh ~ 6.78 cents per kWH) is presented as 67890000000
  // e.g. -10.98 EUR/MWh (-0.1098 EUR/kWH ~ -1.10 cents per kWH) is presented as -10980000000
  // 
  // Given that we are using 64-bit signed integers for the hourly prices, maximum price that
  // the contract can handle is over 9.2 billion EUR/MWh
  int64[24] private hourlyPrices;
  
  constructor(string memory marketNameArg) {        
    marketName = marketNameArg;
		_grantRole(ORACLE_ADMIN_ROLE, tx.origin);
		_grantRole(ORACLE_INPUT_ROLE, tx.origin);
		_setRoleAdmin(ORACLE_INPUT_ROLE, ORACLE_ADMIN_ROLE);
  }

  function setData(int64[24] calldata newPrices, uint64 timeStamp) public onlyRole(ORACLE_INPUT_ROLE) whenNotPaused {
    hourlyPrices = newPrices;
    pricesForDay = timeStamp;
  }

  function getData() public view returns (int64[24] memory) {
    return hourlyPrices;
  }

  function name() public view returns (string memory) {
    return marketName;
  }

  function pauseOracle(bool isPaused) public onlyRole(ORACLE_ADMIN_ROLE) {
    if (isPaused) {
      _pause();
    } else {
      _unpause();
    }    
  }
}