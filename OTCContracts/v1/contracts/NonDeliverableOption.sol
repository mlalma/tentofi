// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "tento-dtd/v1/contracts/DTDEngine.sol";
import "tento-index/v1/contracts/Index.sol";
import "tento-index/v1/contracts/IndexConstants.sol";
import "tento-otccontractbase/v1/contracts/OTCContractBase.sol";
import "tento-otccontractbase/v1/contracts/CollateralCalculators.sol";

import "hardhat/console.sol";

contract NonDeliverableOption is OTCContractBase, ReentrancyGuard {
	enum OptionType {
		Call,
		Put
	}

	struct NDOData {
		BaseContractData baseData;
		ContractState state;
		uint256 notionalAmount;
		OptionType optionType;
		// 0th index is option premium
		// 1st index is strike
		// 2nd.. index are for passing parameters for (exotic) options
		int256[] optionParams;
		bool active;
	}
	mapping(uint256 => NDOData) public NDOLedger;
	uint256 public NDOLedgerCounter = 1;

	event NonDeliverableOptionCreated(uint256 ndoID);
	event NonDeliverableOptionLocked(uint256 ndoID);

	constructor(address indexTrackerAddr, address dtdEngineAddr) OTCContractBase(indexTrackerAddr, dtdEngineAddr) {}

	function getNDOData(uint256 contractId) public view returns (NDOData memory) {
		return NDOLedger[contractId];
	}

	// Creates swap contract
	function createOptionContract(
		NDOData memory optionData,
		uint256 shortPartyVaultId,
		uint256 penaltyMarginShortParty
	) public returns (uint256) {
		require(optionData.baseData.offerEndTime > block.timestamp);
		require(optionData.baseData.offerEndTime < optionData.baseData.contractEndTime);
		require(optionData.notionalAmount > 0);
		require(optionData.optionParams[0] >= 0);

		uint256 dtdContractId = dtdEngine.createContract(
			this,
			NDOLedgerCounter,
			shortPartyVaultId,
			penaltyMarginShortParty,
			0
		);

		optionData.baseData.dtdContractId = dtdContractId;
		optionData.state = ContractState.open;

		(address vaultOwner, ) = dtdEngine.getVaultOwners(dtdContractId);
		require(vaultOwner == tx.origin);

		NDOLedger[NDOLedgerCounter] = optionData;
		NDOLedgerCounter += 1;

		emit NonDeliverableOptionCreated(NDOLedgerCounter - 1);

		return NDOLedgerCounter - 1;
	}

	// Locks contract when counterparty calls to take the other side
	function lockContract(uint256 contractId, uint256 longPartyVaultId) public {
		NDOData storage data = NDOLedger[contractId];
		require(data.notionalAmount > 0);
		require(data.state == ContractState.open);

		dtdEngine.transferBetweenVaults(
			dtdEngine.getContract(data.baseData.dtdContractId).shortCounterpartyVault,
			longPartyVaultId,
			uint256(data.optionParams[0])
		);

		dtdEngine.lockContract(contractId, longPartyVaultId);
		data.state = ContractState.active;
		data.baseData.contractLockTime = uint64(block.timestamp);

		indexTracker.fixIndex(data.baseData.indexId, data.baseData.fixParameters);

		emit NonDeliverableOptionLocked(contractId);
	}

	// Marks the contract to market
	function markToMarket(uint256 contractId) public returns (int256, bool) {
		require(address(dtdEngine) == msg.sender);
		require(NDOLedger[contractId].notionalAmount > 0);

		NDOData storage optionData = NDOLedger[contractId];

		bool contractEnded = block.timestamp >= optionData.baseData.contractEndTime;

		if (!optionData.active) {
			return (0, contractEnded);
		}

		int256 currentVal = indexTracker.calculateIndex(optionData.baseData.indexId, contractEnded);

		if (optionData.optionType == OptionType.Call) {
			currentVal = currentVal - optionData.optionParams[1];
			currentVal = currentVal < 0 ? int256(0) : currentVal;
		} else if (optionData.optionType == OptionType.Put) {
			currentVal = optionData.optionParams[1] - currentVal;
			currentVal = currentVal < 0 ? int256(0) : currentVal;
		} else {
			revert();
		}

		currentVal = (currentVal * int256(optionData.notionalAmount)) / IndexConstants.SPOT_MULTIPLIER;

		int256 lifetimePercentage = ((int256(block.timestamp) - int256(int64(optionData.baseData.contractLockTime))) *
			PERCENTAGE_MULTIPLIER) /
			(int256(int64(optionData.baseData.contractEndTime)) - int256(int64(optionData.baseData.contractLockTime)));
		lifetimePercentage = lifetimePercentage < int256(0)
			? int256(0)
			: (lifetimePercentage > PERCENTAGE_MULTIPLIER ? PERCENTAGE_MULTIPLIER : lifetimePercentage);
		optionData.baseData.collateralCalculatorParams[0] = lifetimePercentage;

		currentVal = optionData.baseData.collateralCalculator.calculateCollateral(
			currentVal,
			optionData.baseData.collateralCalculatorParams
		);

		if (contractEnded) {
			NDOLedger[contractId].state = ContractState.settled;
		}

		return (currentVal, contractEnded);
	}

	// Function to notify the contract logic that a party has defaulted and the contract logic
	// should perform clean up as the contract is now void
	function partyHasDefaulted(
		uint256 contractId,
		address /*defaultedParty*/
	) public {
		NDOLedger[contractId].state = ContractState.terminated;
	}
}
