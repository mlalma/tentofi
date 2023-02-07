// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "tento-dtd/v1/contracts/DTDEngine.sol";
import "tento-index/v1/contracts/Index.sol";
import "tento-index/v1/contracts/IndexConstants.sol";
import "tento-otccontractbase/v1/contracts/OTCContractBase.sol";
import "tento-otccontractbase/v1/contracts/CollateralCalculators.sol";

contract NonDeliverableSwap is OTCContractBase, ReentrancyGuard {
	struct NDSData {
		BaseContractData baseData;
		ContractState state;
		uint256 notionalAmount;
	}
	mapping(uint256 => NDSData) public NDSLedger;
	uint256 public NDSLedgerCounter = 1;

	event NonDeliverableSwapCreated(uint256 ndsID);
	event NonDeliverableSwapLocked(uint256 ndsID);

	constructor(address indexTrackerAddr, address dtdEngineAddr) OTCContractBase(indexTrackerAddr, dtdEngineAddr) {}

	function getNDSData(uint256 contractId) public view returns (NDSData memory) {
		return NDSLedger[contractId];
	}

	// Creates swap contract
	function createSwapContract(
		NDSData memory swapData,
		uint256 shortPartyVaultId,
		uint256 penaltyMarginShortParty,
		uint256 penaltyMarginLongParty
	) public returns (uint256) {
		require(swapData.baseData.offerEndTime > block.timestamp);
		require(swapData.baseData.offerEndTime < swapData.baseData.contractEndTime);
		require(swapData.notionalAmount > 0);

		uint256 dtdContractId = dtdEngine.createContract(
			this,
			NDSLedgerCounter,
			shortPartyVaultId,
			penaltyMarginShortParty,
			penaltyMarginLongParty
		);

		swapData.baseData.dtdContractId = dtdContractId;
		swapData.state = ContractState.open;

		(address vaultOwner, ) = dtdEngine.getVaultOwners(dtdContractId);
		require(vaultOwner == tx.origin);

		NDSLedger[NDSLedgerCounter] = swapData;
		NDSLedgerCounter += 1;

		emit NonDeliverableSwapCreated(NDSLedgerCounter - 1);

		return NDSLedgerCounter - 1;
	}

	// Locks contract when counterparty calls to take the other side
	function lockContract(uint256 contractId, uint256 longPartyVaultId) public {
		NDSData storage data = NDSLedger[contractId];
		require(data.notionalAmount > 0);
		require(data.state == ContractState.open);

		dtdEngine.lockContract(contractId, longPartyVaultId);
		data.state = ContractState.active;
		data.baseData.contractLockTime = uint64(block.timestamp);

		//indexTracker.fixIndex(data.baseData.indexId, data.baseData.);

		emit NonDeliverableSwapLocked(contractId);
	}

	// Marks the contract to market
	function markToMarket(uint256 contractId) public returns (int256, bool) {
		require(address(dtdEngine) == msg.sender);
		require(NDSLedger[contractId].notionalAmount > 0);

		NDSData storage swapData = NDSLedger[contractId];

		bool contractEnded = block.timestamp >= swapData.baseData.contractEndTime;
		int256 currentVal = indexTracker.calculateIndex(swapData.baseData.indexId, contractEnded);

		currentVal = (currentVal * int256(swapData.notionalAmount)) / IndexConstants.SPOT_MULTIPLIER;

		int256 lifetimePercentage = ((int256(block.timestamp) - int256(int64(swapData.baseData.contractLockTime))) *
			PERCENTAGE_MULTIPLIER) /
			(int256(int64(swapData.baseData.contractEndTime)) - int256(int64(swapData.baseData.contractLockTime)));
		lifetimePercentage = lifetimePercentage < int256(0)
			? int256(0)
			: (lifetimePercentage > PERCENTAGE_MULTIPLIER ? PERCENTAGE_MULTIPLIER : lifetimePercentage);
		swapData.baseData.collateralCalculatorParams[0] = lifetimePercentage;

		currentVal = swapData.baseData.collateralCalculator.calculateCollateral(
			currentVal,
			swapData.baseData.collateralCalculatorParams
		);

		if (contractEnded) {
			NDSLedger[contractId].state = ContractState.settled;
		}

		return (currentVal, contractEnded);
	}

	// Function to notify the contract logic that a party has defaulted and the contract logic
	// should perform clean up as the contract is now void
	function partyHasDefaulted(
		uint256 contractId,
		address /*defaultedParty*/
	) public {
		NDSLedger[contractId].state = ContractState.terminated;
	}
}
