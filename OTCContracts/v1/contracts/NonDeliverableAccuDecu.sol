// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "tento-dtd/v1/contracts/DTDEngine.sol";
import "tento-index/v1/contracts/Index.sol";
import "tento-index/v1/contracts/IndexConstants.sol";
import "tento-otccontractbase/v1/contracts/OTCContractBase.sol";
import "tento-otccontractbase/v1/contracts/CollateralCalculators.sol";

// Accumulators aka Knock-Out Forwards - Decumulators aka Reverse Knock-Out Forwards
// Cash-settled contracts where the underlying index is used to periodically settle a forward.
//
// Contracts can have leverage factor in case index is above / below strike (accu/decu) thus
// magnifying losses for the long party on accu and short party on deccu.
//
// Contracts can have guaranteed amount of fixings, which is a "honeymoon" period where
// knock-out barrier is not observed.
//
// Two ways of settling the contract:
// 1) The fixings run out i.e. contract runs out or
// 2) When index price goes over (under) knock-out barrier, contract is called.
//
// Note that this contract needs to be paired with index that has max marking count and delta between
// markings set for being a proper Accu/Deccu contract. This contract handles only periodic settlement
// and knock-outs.
contract NonDeliverableAccuDecu is OTCContractBase {
	enum AccuDeccuType {
		Accumulator,
		Decumulator
	}

	struct NDACDEData {
		BaseContractData baseData;
		ContractState state;
		uint256 notionalAmount;
		AccuDeccuType AccuDeccuType;
		int256 strike;
		int256 knockOutBarrier;
		// Leverage factor is downside leverage factor for buyer (accu) or seller (decu). 10000 is 1.0
		uint256 leverageFactor;
		uint256 guaranteedFixings;
	}
	mapping(uint256 => NDACDEData) public NDACDELedger;
	uint256 public NDACDELedgerCounter = 1;

	event NonDeliverableAccuDecuCreated(uint256 ndacdecID);

	constructor(address indexTrackerAddr, address dtdEngineAddr) OTCContractBase(indexTrackerAddr, dtdEngineAddr) {}

	function createAccuDecuContract(
		NDACDEData memory acdeData,
		uint256 shortPartyVaultId,
		uint256 penaltyMarginShortParty,
		uint256 penaltyMarginLongParty
	) public returns (uint256) {
		require(acdeData.baseData.offerEndTime > block.timestamp);
		require(acdeData.baseData.offerEndTime < acdeData.baseData.contractEndTime);
		require(acdeData.notionalAmount > 0);

		uint256 dtdContractId = dtdEngine.createContract(
			this,
			NDACDELedgerCounter,
			shortPartyVaultId,
			penaltyMarginShortParty,
			penaltyMarginLongParty
		);

		acdeData.baseData.dtdContractId = dtdContractId;
		acdeData.state = ContractState.open;

		(address vaultOwner, ) = dtdEngine.getVaultOwners(dtdContractId);
		require(vaultOwner == tx.origin);

		NDACDELedger[NDACDELedgerCounter] = acdeData;
		NDACDELedgerCounter += 1;

		emit NonDeliverableAccuDecuCreated(NDACDELedgerCounter - 1);

		return NDACDELedgerCounter - 1;
	}

	function markToMarket(uint256 contractId) public returns (int256, bool) {
		require(address(dtdEngine) == msg.sender);
		return (0, false);
	}

	// Function to notify the contract logic that a party has defaulted and the contract logic
	// should perform clean up as the contract is now void
	function partyHasDefaulted(uint256 contractId, address defaultedParty) public {
		require(address(dtdEngine) == msg.sender);
	}
}
