// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IDTDEngineContract.sol";

// Decentralized Token Depository (DTD) Engine for managing bilateral contracts between counterparties.
contract DTDEngine is AccessControl, ReentrancyGuardTransient, Pausable {
	// DTD Administrator administers the whole contract and can influence on everything
	bytes32 public constant DTD_ADMIN_ROLE = keccak256("DTD_ADMIN_ROLE");
	// DTD Contract Administrator can define which OTC Contracts can interact with DTD Engine
	bytes32 public constant DTD_CONTRACT_ADMIN_ROLE = keccak256("DTD_CONTRACT_ADMIN_ROLE");
	// DTD Contracts are OTC (Smart) Contracts that interact with DTD Engine
	bytes32 public constant DTD_CONTRACT_ROLE = keccak256("DTD_CONTRACT_ROLE");

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
	mapping(uint256 => Vault) public dtdVaults;
	uint256 public dtdVaultCounter = 1;

	// Penalty margins are used per contract to incentivize counterparties to keep
	// enough deposit balances on their Vault. If default happens then the
	// other party will get the penalty margin in addition to whatever balance there is left
	struct Contract {
		uint256 shortCounterpartyVault;
		uint256 penaltyMarginShortCounterparty;
		uint256 longCounterpartyVault;
		uint256 penaltyMarginLongCounterparty;
		uint256 contractId;
		IDTDEngineContract contractLogic;
		int256 currentPnL;
	}
	mapping(uint256 => Contract) public dtdContracts;
	uint256 public dtdContractCounter = 1;

	// Toggle for contract admin to shut down the contract in case something is really wrong
	bool private emergencyValve = false;

	// All the events sent by this contract
	event VaultCreated(uint256 vaultCounter, address creator, address tokenAddr);
	event ContractCreated(uint256 contractId, address otcContract, address creator);
	event ContractLocked(uint256 contractId, uint256 vault1, uint256 vault2);
	event ContractSettled(uint256 contractId, int256 finalPnL);
	event ContractMarkedToMarket(uint256 contractId, int256 currentPnL);
	event ContractMarginCall(uint256 contractId, address marginCalledParty);

	// Constructor
	constructor() ReentrancyGuardTransient() AccessControl() Pausable() {
		_grantRole(DEFAULT_ADMIN_ROLE, tx.origin);
		_grantRole(DTD_ADMIN_ROLE, tx.origin);
		_grantRole(DTD_CONTRACT_ADMIN_ROLE, tx.origin);
		_grantRole(DTD_CONTRACT_ROLE, tx.origin);
		_setRoleAdmin(DTD_CONTRACT_ROLE, DTD_CONTRACT_ADMIN_ROLE);
	}

	// Admins can pause contract if something is going wrong
	function modifyPauseStatus(bool pauseContract) public onlyRole(DTD_ADMIN_ROLE) {
		if (pauseContract) {
			_pause();
		} else {
			_unpause();
		}
	}

	// Returns a contract
	function getContract(uint256 contractId) public view returns (Contract memory) {
		return dtdContracts[contractId];
	}

	// Returns vault
	function getVault(uint256 vaultId) public view returns (Vault memory) {
		return dtdVaults[vaultId];
	}

	// Returns vault owners
	function getVaultOwners(uint256 dtdContractId) public view returns (address shortParty, address longParty) {
		shortParty = dtdVaults[dtdContracts[dtdContractId].shortCounterpartyVault].owner;
		longParty = dtdVaults[dtdContracts[dtdContractId].longCounterpartyVault].owner;
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
	) public whenNotPaused onlyRole(DTD_CONTRACT_ROLE) returns (uint256) {
		require(tx.origin == dtdVaults[shortPartyVaultId].owner);
		require(
			dtdVaults[shortPartyVaultId].depositBalance >=
				(dtdVaults[shortPartyVaultId].minMarginLevel + penaltyMarginShortParty)
		);

		Contract memory dtdContract;
		dtdContract.contractLogic = newContract;
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
	function lockContract(uint256 contractId, uint256 longPartyVaultId) public whenNotPaused onlyRole(DTD_CONTRACT_ROLE) {
		require(address(dtdContracts[contractId].contractLogic) != address(0));
		require(dtdContracts[contractId].shortCounterpartyVault != 0);
		require(tx.origin == dtdVaults[longPartyVaultId].owner);
		require(
			dtdVaults[longPartyVaultId].depositBalance >=
				(dtdVaults[longPartyVaultId].minMarginLevel + dtdContracts[contractId].penaltyMarginLongCounterparty)
		);

		require(
			dtdVaults[dtdContracts[contractId].shortCounterpartyVault].tokenAddr ==
				dtdVaults[longPartyVaultId].tokenAddr
		);

		require(tx.origin != dtdVaults[dtdContracts[contractId].shortCounterpartyVault].owner);

		dtdContracts[contractId].longCounterpartyVault = longPartyVaultId;

		// Reserve penalty margin for long party
		dtdVaults[longPartyVaultId].minMarginLevel += dtdContracts[contractId].penaltyMarginLongCounterparty;

		emit ContractLocked(contractId, dtdContracts[contractId].shortCounterpartyVault, longPartyVaultId);
	}

	// Changes deposit balance for a vault
	// If amount > 0 then depositing to the vault
	// If amount < 0 then moving from vault to the user account while making sure that the transfer won't breach required min margin level
	function changeDepositBalance(uint64 vaultId, int256 amount) public whenNotPaused nonReentrant {
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

	// Transfers value between vaults
	// The originator of the call must be from same address than the vault where value is taken from
	function transferBetweenVaults(
		uint256 vaultTo,
		uint256 vaultFrom,
		uint256 valueToTransfer
	) public whenNotPaused onlyRole(DTD_CONTRACT_ROLE) {
		require(tx.origin == dtdVaults[vaultFrom].owner);
		require(dtdVaults[vaultFrom].tokenAddr == dtdVaults[vaultTo].tokenAddr);
		require(dtdVaults[vaultFrom].depositBalance - dtdVaults[vaultFrom].minMarginLevel >= valueToTransfer);

		dtdVaults[vaultTo].depositBalance += valueToTransfer;
		dtdVaults[vaultFrom].depositBalance -= valueToTransfer;
	}

	// Changes minimum margin level
	function _changeMinMargin(uint256 sourceVault, int256 delta)
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
	function _transferBalance(
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
	function markToMarket(uint256 contractId) public whenNotPaused returns (int256) {
		uint256 shortVault = dtdContracts[contractId].shortCounterpartyVault;
		uint256 longVault = dtdContracts[contractId].longCounterpartyVault;
		IDTDEngineContract contractLogic = dtdContracts[contractId].contractLogic;

		require(tx.origin == dtdVaults[shortVault].owner || tx.origin == dtdVaults[longVault].owner);
		(int256 pAndL, bool settled) = contractLogic.markToMarket(dtdContracts[contractId].contractId);

		if (longVault == 0) {
			if (settled) {
				// This happens when counterparty was not found and contract is deemed to be closed
				_changeMinMargin(shortVault, -int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
				delete dtdContracts[contractId];
				emit ContractSettled(contractId, 0);
			} else {
				return 0;
			}
		}

		int256 prevPandL = dtdContracts[contractId].currentPnL;

		uint256 defaultedVault = 0;
		if (prevPandL <= 0 && pAndL <= 0) {
			// Short party was winning and is still winning
			(bool defaulted, int256 availableMargin) = _changeMinMargin(longVault, prevPandL - pAndL);
			if (defaulted) {
				defaultedVault = longVault;
				pAndL = prevPandL - availableMargin;
			}
		} else if (prevPandL >= 0 && pAndL >= 0) {
			// Long party was winning and is still winning
			(bool defaulted, int256 availableMargin) = _changeMinMargin(shortVault, pAndL - prevPandL);
			if (defaulted) {
				defaultedVault = shortVault;
				pAndL = availableMargin + prevPandL;
			}
		} else if (prevPandL >= 0 && pAndL <= 0) {
			// Long party was winning, but now short party is winning
			_changeMinMargin(shortVault, -prevPandL);
			(bool defaulted, int256 availableMargin) = _changeMinMargin(longVault, -pAndL);
			if (defaulted) {
				defaultedVault = longVault;
				pAndL = -availableMargin;
			}
		} else if (prevPandL <= 0 && pAndL >= 0) {
			// Short party was winning, but now long party is winning
			_changeMinMargin(longVault, prevPandL);
			(bool defaulted, int256 availableMargin) = _changeMinMargin(shortVault, pAndL);
			if (defaulted) {
				defaultedVault = shortVault;
				pAndL = availableMargin;
			}
		}

		if (defaultedVault > 0) {
			// A party has defaulted. Move PnL as well as penalty margin to winning counterparty

			// Move as much PandL between the two parties as possible
			_transferBalance(shortVault, longVault, pAndL);

			if (defaultedVault == longVault) {
				// Move penalty margins to the winning party
				_transferBalance(longVault, shortVault, int256(dtdContracts[contractId].penaltyMarginLongCounterparty));
				_changeMinMargin(shortVault, -int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
			} else {
				_transferBalance(shortVault, longVault, int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
				_changeMinMargin(longVault, -int256(dtdContracts[contractId].penaltyMarginLongCounterparty));
			}

			// Notify contract so that it can also do cleanup
			contractLogic.partyHasDefaulted(dtdContracts[contractId].contractId, dtdVaults[defaultedVault].owner);

			// Delete contract
			delete dtdContracts[contractId];

			// Announce margin call
			emit ContractMarginCall(contractId, dtdVaults[defaultedVault].owner);
		} else if (settled) {
			// Contract has finished and no party defaulted

			// Give the penalty margin back to both parties
			_changeMinMargin(shortVault, -int256(dtdContracts[contractId].penaltyMarginShortCounterparty));
			_changeMinMargin(longVault, -int256(dtdContracts[contractId].penaltyMarginLongCounterparty));

			// Move PandL between the two parties
			_transferBalance(shortVault, longVault, pAndL);

			// Delete contract
			delete dtdContracts[contractId];

			// Announce the settlement for reconcilliation on both parties' books
			emit ContractSettled(contractId, pAndL);
		} else {
			// We store the new PnL statement to the structure
			dtdContracts[contractId].currentPnL = pAndL;

			emit ContractMarkedToMarket(contractId, pAndL);
		}

		return pAndL;
	}

	// Enable emergency valve, after this the contract is basically done and only thing left is to move money away
	function enableEmergencyValve() public whenPaused onlyRole(DTD_ADMIN_ROLE) {
		emergencyValve = true;
	}

	// This is for emergencies - when the emergency valve is activated, it allows vault owners to
	// withdraw their *full* balance. Should only be used in extreme situations, the contract can no longer be used productively.
	function emergencyVaultTransfer(uint256 vaultId) public whenPaused nonReentrant {
		require(emergencyValve);
		require(tx.origin == dtdVaults[vaultId].owner);
		require(dtdVaults[vaultId].depositBalance > 0);

		IERC20 token = IERC20(dtdVaults[vaultId].tokenAddr);
		dtdVaults[vaultId].depositBalance = 0;
		token.transfer(tx.origin, dtdVaults[vaultId].depositBalance);
	}
}
