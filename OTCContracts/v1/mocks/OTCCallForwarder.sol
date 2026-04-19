// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract OTCCallForwarder {
	function forward(address target, bytes calldata callData) external returns (bytes memory) {
		(bool success, bytes memory result) = target.call(callData);
		require(success, "Forwarded call failed");
		return result;
	}
}
