import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("Administration", function () {
  let dtdEngine: DTDEngine;
  let dtdEngineAddress: string;
  let emptyMockContract: EmptyMockContract;
  let emptyMockContractAddress: string;
  let emptyMockContract2: EmptyMockContract;
  let emptyMockContract2Address: string;
  let mockToken: MockToken;
  let mockTokenAddress: string;

  let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
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
      await expect(dtdEngine.connect(bob).grantRole(contractRole, emptyMockContractAddress)).to.be.reverted;
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
      await expect(dtdEngine.connect(bob).modifyPauseStatus(true)).to.be.reverted;
    });

    it("Should not be able to call any methods of DTD when contract is paused", async function () {
      await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
      await dtdEngine.modifyPauseStatus(true);
      await expect(dtdEngine.createVault(mockTokenAddress)).to.be.rejectedWith("EnforcedPause");
    });
  });
});
