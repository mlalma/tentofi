import { expect } from "chai";
import { ethers, createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils.js";
import type { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types/index.js";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";

describe("Administration", function () {
  let dtdEngine: DTDEngine;
  let dtdEngineAddress: string;
  let emptyMockContract: EmptyMockContract;
  let emptyMockContractAddress: string;
  let emptyMockContract2: EmptyMockContract;
  let emptyMockContract2Address: string;
  let mockToken: MockToken;
  let mockTokenAddress: string;

  let alice: HardhatEthersSigner, bob: HardhatEthersSigner, charles: HardhatEthersSigner;
  let contractRole: string;
  let contractAdminRole: string;

  beforeEach(async function () {
    [dtdEngine, dtdEngineAddress] = await createDTDEngine();
    [emptyMockContract, emptyMockContractAddress] = await createEmptyMockContract();
    [emptyMockContract2, emptyMockContract2Address] = await createEmptyMockContract();
    [mockToken, mockTokenAddress] = await createMockToken();
    [alice, bob, charles] = await ethers.getSigners();
    contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
    contractAdminRole = await dtdEngine.DTD_CONTRACT_ADMIN_ROLE();
  });

  describe("Registration", function () {
    it("Should register a contract to DTD", async function () {
      await dtdEngine.grantRole(contractRole, emptyMockContractAddress);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContractAddress)).to.eq(true);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContract2Address)).to.eq(false);
    });

    it("Should fail to register contract to DTD", async function () {
      await expect(dtdEngine.connect(bob).grantRole(contractRole, emptyMockContractAddress)).to.be.revert(ethers);
    });

    it("Should add a new contract registror to DTD and then call it", async function () {
      await dtdEngine.grantRole(contractAdminRole, bob.address);
      await dtdEngine.connect(bob).grantRole(contractRole, emptyMockContractAddress);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContractAddress)).to.eq(true);
    });
  });

  describe("Pausing", function () {
    it("Should pause the contract successfully", async function () {
      expect(await dtdEngine.paused()).to.be.equal(false);
      await dtdEngine.modifyPauseStatus(true);
      expect(await dtdEngine.paused()).to.be.equal(true);
    });

    it("Should fail to pause contract", async function () {
      await expect(dtdEngine.connect(bob).modifyPauseStatus(true)).to.be.revert(ethers);
    });

    it("Should not be able to call any methods of DTD when contract is paused", async function () {
      await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
      await dtdEngine.modifyPauseStatus(true);
      await expect(dtdEngine.createVault(mockTokenAddress)).to.be.revert(ethers);
    });
  });

  describe("Emergency", function () {
    it("Should transfer full vault balance to owner during emergency", async function () {
      await mockToken.connect(alice).faucet(1_000_000);
      await dtdEngine.connect(alice).createVault(mockTokenAddress);
      await mockToken.connect(alice).approve(dtdEngineAddress, 1_000_000);
      await dtdEngine.connect(alice).changeDepositBalance(1, 1_000_000);

      expect(await mockToken.balanceOf(alice.address)).to.equal(0);

      await dtdEngine.modifyPauseStatus(true);
      await dtdEngine.enableEmergencyValve();
      await dtdEngine.connect(alice).emergencyVaultTransfer(1);

      expect(await mockToken.balanceOf(alice.address)).to.equal(1_000_000);

      const vault = await dtdEngine.getVault(1);
      expect(vault.depositBalance).to.equal(0);
    });

    it("Should transfer tokens to vault owner", async function () {
      await mockToken.connect(alice).faucet(1_000_000);
      await dtdEngine.connect(alice).createVault(mockTokenAddress);
      await mockToken.connect(alice).approve(dtdEngineAddress, 1_000_000);
      await dtdEngine.connect(alice).changeDepositBalance(1, 1_000_000);

      await dtdEngine.modifyPauseStatus(true);
      await dtdEngine.enableEmergencyValve();
      await dtdEngine.connect(alice).emergencyVaultTransfer(1);

      expect(await mockToken.balanceOf(alice.address)).to.equal(1_000_000);
    });
  });
});
