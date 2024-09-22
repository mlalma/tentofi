// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract NordPoolDayAheadDataSource {
  string marketName;
  uint64 pricesForDay;
  int64[24] hourlyPrices;
  
  constructor(string memory marketNameArg) {        
    marketName = marketNameArg;
  }

  function getData() public view returns (int64[24] memory) {
    return hourlyPrices;
  }

  function name() public view returns (string memory) {
    return marketName;
  }
}