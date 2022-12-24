import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("Administration", function () {
  let dtdEngine: DTDEngine;
  let emptyMockContract: EmptyMockContract;
  let emptyMockContract2: EmptyMockContract;
  let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
  let contractRole: string;
  let contractAdminRole: string;
  let mockToken: MockToken;

  beforeEach(async function () {
    dtdEngine = await createDTDEngine();
    emptyMockContract = await createEmptyMockContract();
    emptyMockContract2 = await createEmptyMockContract();
    mockToken = await createMockToken();
    [alice, bob, charles] = await ethers.getSigners();
    contractRole = await dtdEngine.CONTRACT_ROLE();
    contractAdminRole = await dtdEngine.CONTRACT_ADMIN_ROLE();
  });

  describe("Registration", function () {
    it("Should register a contract to DTD", async function () {
      await dtdEngine.grantRole(contractRole, emptyMockContract.address);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContract.address)).to.eq(true);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContract2.address)).to.eq(false);
    });

    it("Should fail to register contract to DTD", async function () {
      await expect(dtdEngine.connect(bob).grantRole(contractRole, emptyMockContract.address)).to.be.reverted;
    });

    it("Should add a new contract registror to DTD and then call it", async function () {
      await dtdEngine.grantRole(contractAdminRole, bob.address);
      await dtdEngine.connect(bob).grantRole(contractRole, emptyMockContract.address);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContract.address)).to.eq(true);
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
      await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);
      await dtdEngine.modifyPauseStatus(true);
      await expect(dtdEngine.createVault(mockToken.address)).to.be.revertedWith("Pausable: paused");
    });
  });
});
