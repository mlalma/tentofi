// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Interface that any contract logic wanting to use DTDEngine needs to implement
interface IDTDEngineContract {
	// Request to calculate PnL for contract with given contract logic id.
	//
	// Returns:
	// int256	-	PnL. If < 0 then short party is in profit, otherwise long is in profit
	// bool		-	False if contract is still running, True if contract is settled
	function markToMarket(uint256 contractId) external returns (int256, bool);

	// Function to notify the contract logic that a party has defaulted and the contract logic
	// should perform clean up as the contract is now void
	function partyHasDefaulted(uint256 contractId, address defaultedParty) external;
}
