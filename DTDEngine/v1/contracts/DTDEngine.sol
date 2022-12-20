// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDTDEngineContract.sol";

// import "hardhat/console.sol";

// Decentralized Token Depository (DTD) Engine for managing bilateral contracts
// between counterparties.
contract DTDEngine is AccessControl, ReentrancyGuard, Pausable {
	bytes32 public constant DTD_ADMIN_ROLE = keccak256("DTD_ADMIN_ROLE");
	bytes32 public constant CONTRACT_ADMIN_ROLE = keccak256("CONTRACT_ADMIN_ROLE");
	bytes32 public constant CONTRACT_ROLE = keccak256("CONTRACT_ROLE");

	// Single DTD Vault - Every participant needs to have one or more vaults.
	//
	// Note that unlike standard OTC swaps we don't transfer value from one party to another when
	// we mark to market. We instead raise min margin level to ensure that (at the time) winning
	// party won't have an incentive to run away and losing party has incentive to keep adding
	// balance to Vault to prevent default from happening.
	//
	// This is because in decentralized environment the parties might be anonymous to each other
	// and they don't have something like ISDA in place.
	struct Vault {
		// Owner address
		address owner;
		// Token that is deposited for this vault
		address tokenAddr;
		// The total amount of tokens in this vault
		uint256 depositBalance;
		// Minimum margin level that is reserved to meet obligations
		// Has to always be <= depositBalance, otherwise margin call will occur
		uint256 minMarginLevel;
	}
	mapping(uint256 => Vault) private dtdVaults;
	uint256 private dtdVaultCounter = 1;

	// Penalty margins are used per contract to incentivize counterparties to keep
	// enough deposit balances on their Vault. If default happens then the
	// other party will get the penalty margin in addition to whatever balance there is left
	struct Contract {
		uint256 shortCounterpartyVault;
		uint256 penaltyMarginShortCounterparty;
		uint256 longCounterpartyVault;
		uint256 penaltyMarginLongCounterparty;
		uint256 contractId;
		address contractAddress;
		int256 currentPnL;
	}
	mapping(uint256 => Contract) private dtdContracts;
	uint256 private dtdContractCounter = 1;

	bool private emergencyValve = false;

	// All the events sent by this contract
	event VaultCreated(uint256 vaultCounter, address creator, address tokenAddr);
	event ContractCreated(uint256 contractId, address otcContract, address creator);
	event ContractLocked(uint256 contractId, uint256 vault1, uint256 vault2);
	event ContractSettled(uint256 contractId, int256 finalPnL);
	event ContractMarkedToMarket(uint256 contractId, int256 currentPnL);
	event ContractMarginCall(uint256 contractId, address marginCalledParty);

	// Constructor
	constructor() {
		_grantRole(DEFAULT_ADMIN_ROLE, tx.origin);
		_grantRole(DTD_ADMIN_ROLE, tx.origin);
		_grantRole(CONTRACT_ADMIN_ROLE, tx.origin);
		_grantRole(CONTRACT_ROLE, tx.origin);
		_setRoleAdmin(CONTRACT_ROLE, CONTRACT_ADMIN_ROLE);
	}

	// Admins can pause contract if something is going wrong
	function modifyPauseStatus(bool pauseContract) public onlyRole(DTD_ADMIN_ROLE) {
		if (pauseContract) {
			_pause();
		} else {
			_unpause();
		}
	}

	// Creates new vault for a user
	function createVault(address tokenAddr) public whenNotPaused returns (uint256) {
		Vault memory vault;
		vault.owner = msg.sender;
		vault.tokenAddr = tokenAddr;
		dtdVaults[dtdVaultCounter] = vault;

		emit VaultCreated(dtdVaultCounter, msg.sender, tokenAddr);
		dtdVaultCounter += 1;
		return dtdVaultCounter - 1;
	}

	// Creates contract and posts the initial penalty margin from vault
	function createContract(
		IDTDEngineContract newContract,
		uint256 contractLogicId,
		uint256 shortPartyVaultId,
		uint256 penaltyMarginShortParty,
		uint256 penaltyMarginLongParty
	) public whenNotPaused onlyRole(CONTRACT_ROLE) returns (uint256) {
		require(tx.origin == dtdVaults[shortPartyVaultId].owner);
		require(
			dtdVaults[shortPartyVaultId].depositBalance >=
				(dtdVaults[shortPartyVaultId].minMarginLevel + penaltyMarginShortParty)
		);

		Contract memory dtdContract;
		dtdContract.contractAddress = address(newContract);
		dtdContract.contractId = contractLogicId;
		dtdContract.shortCounterpartyVault = shortPartyVaultId;
		dtdContract.penaltyMarginShortCounterparty = penaltyMarginShortParty;
		dtdContract.penaltyMarginLongCounterparty = penaltyMarginLongParty;
		dtdContracts[dtdContractCounter] = dtdContract;

		// Reserve penalty margin for short party
		dtdVaults[shortPartyVaultId].minMarginLevel += penaltyMarginShortParty;

		emit ContractCreated(dtdContractCounter, address(newContract), tx.origin);

		dtdContractCounter++;
		return dtdContractCounter - 1;
	}

	// Locks the contract
	function lockContract(uint256 contractId, uint64 longPartyVaultId) public whenNotPaused onlyRole(CONTRACT_ROLE) {
		require(dtdContracts[contractId].contractAddress != address(0));
		require(dtdContracts[contractId].longCounterpartyVault != 0);
		require(tx.origin == dtdVaults[longPartyVaultId].owner);
		require(
			dtdVaults[longPartyVaultId].depositBalance >=
				(dtdVaults[longPartyVaultId].minMarginLevel + dtdContracts[contractId].penaltyMarginLongCounterparty)
		);

		require(
			dtdVaults[dtdContracts[contractId].shortCounterpartyVault].tokenAddr ==
				dtdVaults[longPartyVaultId].tokenAddr
		);

		dtdContracts[contractId].longCounterpartyVault = longPartyVaultId;

		// Reserve penalty margin for long party
		dtdVaults[longPartyVaultId].minMarginLevel += dtdContracts[contractId].penaltyMarginLongCounterparty;

		emit ContractLocked(contractId, dtdContracts[contractId].shortCounterpartyVault, longPartyVaultId);
	}

	// Changes deposit balance for a vault
	// If amount > 0 then depositing to the vault
	// If amount < 0 then moving from vault to the user account while making sure that the transfer won't breach required min margin level
	function changeDepositBalance(uint64 vaultId, int256 amount) public whenNotPaused {
		require(msg.sender == dtdVaults[vaultId].owner);

		IERC20 token = IERC20(dtdVaults[vaultId].tokenAddr);

		if (amount > 0) {
			uint256 uMarginDelta = uint256(amount);
			token.transferFrom(msg.sender, address(this), uMarginDelta);
			dtdVaults[vaultId].depositBalance += uMarginDelta;
		} else if (amount < 0) {
			uint256 uMarginDelta = uint256(-amount);
			require(
				uMarginDelta <= dtdVaults[vaultId].depositBalance &&
					dtdVaults[vaultId].depositBalance - uMarginDelta >= dtdVaults[vaultId].minMarginLevel
			);
			token.transfer(msg.sender, uMarginDelta);
			dtdVaults[vaultId].depositBalance -= uMarginDelta;
		}
	}

	// Changes minimum margin level
	function changeMinMargin(uint256 sourceVault, int256 delta)
		internal
		returns (bool defaulted, int256 availableMargin)
	{
		defaulted = false;
		availableMargin = 0;

		if (delta >= 0) {
			if (dtdVaults[sourceVault].minMarginLevel + uint256(delta) > dtdVaults[sourceVault].depositBalance) {
				defaulted = true;
				availableMargin = int256(dtdVaults[sourceVault].depositBalance - dtdVaults[sourceVault].minMarginLevel);
				dtdVaults[sourceVault].minMarginLevel = dtdVaults[sourceVault].depositBalance;
			} else {
				dtdVaults[sourceVault].minMarginLevel += uint256(delta);
			}
		} else {
			uint256 uMarginDelta = uint256(-delta);
			dtdVaults[sourceVault].minMarginLevel = (uMarginDelta >= dtdVaults[sourceVault].minMarginLevel)
				? 0
				: dtdVaults[sourceVault].minMarginLevel - uMarginDelta;
		}
	}

	// Transfers balance between two vaults
	function transferBalance(
		uint256 vault1,
		uint256 vault2,
		int256 delta
	) internal {
		if (delta < 0) {
			// Moving balance from vault2 to vault1
			dtdVaults[vault1].depositBalance += uint256(-delta);
			dtdVaults[vault2].depositBalance -= uint256(-delta);
			dtdVaults[vault2].minMarginLevel -= uint256(-delta);
		} else if (delta > 0) {
			// Moving balance from vault1 to vault2
			dtdVaults[vault1].depositBalance -= uint256(delta);
			dtdVaults[vault1].minMarginLevel -= uint256(delta);
			dtdVaults[vault2].depositBalance += uint256(delta);
		}
	}

	// Marks to market a contract
	function markToMarket(uint256 contractId) public whenNotPaused {
		uint256 shortVault = dtdContracts[contractId].shortCounterpartyVault;
		uint256 longVault = dtdContracts[contractId].longCounterpartyVault;

		require(tx.origin == dtdVaults[shortVault].owner || tx.origin == dtdVaults[longVault].owner);

		IDTDEngineContract marketContract = IDTDEngineContract(dtdContracts[contractId].contractAddress);
		(int256 pAndL, bool settled) = marketContract.markToMarket(dtdContracts[contractId].contractId);

		int256 prevPandL = dtdContracts[contractId].currentPnL;

		uint256 defaultedVault = 0;
		if (prevPandL <= 0 && pAndL <= 0) {
			// Short party was winning and is still winning
			(bool defaulted, int256 availableMargin) = changeMinMargin(longVault, prevPandL - pAndL);
			if (defaulted) {
				defaultedVault = longVault;
				pAndL = prevPandL - availableMargin;
			}
		} else if (prevPandL >= 0 && pAndL >= 0) {
			// Long party was winning and is still winning
			(bool defaulted, int256 availableMargin) = changeMinMargin(shortVault, pAndL - prevPandL);
			if (defaulted) {
				defaultedVault = shortVault;
				pAndL = availableMargin + prevPandL;
			}
		} else if (prevPandL >= 0 && pAndL <= 0) {
			// Long party was winning, but now short party is winning
			changeMinMargin(shortVault, -prevPandL);
			(bool defaulted, int256 availableMargin) = changeMinMargin(longVault, -pAndL);
			if (defaulted) {
				defaultedVault = longVault;
				pAndL = -availableMargin;
			}
		} else if (prevPandL <= 0 && pAndL >= 0) {
			// Short party was winning, but now long party is winning
			changeMinMargin(longVault, prevPandL);
			(bool defaulted, int256 availableMargin) = changeMinMargin(shortVault, pAndL);
			if (defaulted) {
				defaultedVault = shortVault;
				pAndL = availableMargin;
			}
		}

		if (defaultedVault > 0) {
			// A party has defaulted. Move PnL as well as penalty margin to winning counterparty

			// Move as much PandL between the two parties as possible
			transferBalance(shortVault, longVault, pAndL);

			if (defaultedVault == longVault) {
				// Move penalty margins to the winning party
				transferBalance(longVault, shortVault, int256(dtdContracts[contractId].penaltyMarginLongCounterparty));
				changeMinMargin(shortVault, -int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
			} else {
				transferBalance(shortVault, longVault, int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
				changeMinMargin(longVault, -int256(dtdContracts[contractId].penaltyMarginLongCounterparty));
			}

			// Notify contract so that it can also do cleanup
			marketContract.partyHasDefaulted(dtdContracts[contractId].contractId, dtdVaults[defaultedVault].owner);

			// Delete contract
			delete dtdContracts[contractId];

			// Announce margin call
			emit ContractMarginCall(contractId, dtdVaults[defaultedVault].owner);
		} else if (settled) {
			// Contract has finished and no party defaulted

			// Give the penalty margin back to both parties
			changeMinMargin(shortVault, -int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
			changeMinMargin(longVault, -int256(dtdContracts[contractId].penaltyMarginLongCounterparty));

			// Move PandL between the two parties
			transferBalance(shortVault, longVault, pAndL);

			// Delete contract
			delete dtdContracts[contractId];

			// Announce the settlement for reconcilliation on both parties' books
			emit ContractSettled(contractId, pAndL);
		} else {
			// We store the new PnL statement to the structure
			dtdContracts[contractId].currentPnL = pAndL;

			emit ContractMarkedToMarket(contractId, pAndL);
		}
	}

	// Enable emergency valve
	function enableEmergencyValve() public whenPaused onlyRole(DTD_ADMIN_ROLE) {
		emergencyValve = true;
	}

	// This is for emergencies - when emergency valve has been enabled it provides chance for vault owners to
	// withdraw their *full* balance. Only used for extreme situations, the contract cannot be productively used anymore
	function emergencyVaultTransfer(uint256 vaultId) public whenPaused {
		require(emergencyValve);
		require(tx.origin == dtdVaults[vaultId].owner);
		require(dtdVaults[vaultId].depositBalance > 0);

		IERC20 token = IERC20(dtdVaults[vaultId].tokenAddr);
		dtdVaults[vaultId].depositBalance = 0;
		token.transfer(tx.origin, dtdVaults[vaultId].depositBalance);
	}
}
