// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

library NordPoolDataLib {
  struct DayAheadData {
    int64 pricesForDay;
    int64 dataFetchingTime;
    int64[24] hourlyPrices;
  }
}