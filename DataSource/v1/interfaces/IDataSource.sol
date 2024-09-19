// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Interface that any contract logic wanting to use DTDEngine needs to implement
interface IDataSource {
    function update(bytes memory input) external returns (bool);

    function getData(bytes memory input) external returns (bytes memory);

    // Use abi encode() for encoding the data back from
}
