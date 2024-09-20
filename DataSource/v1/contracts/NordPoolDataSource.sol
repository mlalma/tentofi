// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./NordPoolDataLib.sol";
import "../interfaces/IDataSource.sol";

contract NordPoolDataSource is IDataSource {
  string marketName;
  NordPoolDataLib.DayAheadData data;

  constructor(string memory marketNameArg) {        
    marketName = marketNameArg;
  }

  function update(bytes memory input) external returns (bool) {
  }

  function getData(bytes memory input) external returns (bytes memory) {
    // Check that fetched data is recent enough
    require(data.pricesForDay + 36 * 24 * 3600 > block.timestamp, StaleData())
  }

  function name() external view returns (string memory) {
    return marketName;
  }
}