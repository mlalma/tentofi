// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Interface that abstracts the oracle data sources used by OTC derivatives
// Since the parameters and the output of oracle data depend on the data and oracle in question,
// they are specific to each oracle and needs to be documented per-case basis
interface IDataSource {
  error NoDataAvailable();
  error StaleData();
  
  // Request to update data on oracle
  //
  // @param input - Per-contract specific input data to use
  // @return bool - Flag indicating if request was successful, does NOT mean that data has been updated
  function update(bytes memory input) external returns (bool);

  // Gets the data from oracle for use in an contract
  //
  // @param input - Per-contract specific input data to use
  // @return bytes - Per-contract specific output that calling contract needs to interpret correctly
  function getData(bytes memory input) external returns (bytes memory);

  // Returns name of the data source
  //
  // @return string - Name of the data source resource
  function name() external view returns (string memory);
}
