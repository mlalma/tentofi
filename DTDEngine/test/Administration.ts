import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract } from "./utils";
import { DTDEngine, EmptyMockContract } from "../typechain-types";

describe("Administration", function () {
  let dtdEngine: DTDEngine;
  let emptyMockContract: EmptyMockContract;
  let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;

  beforeEach(async function () {
    dtdEngine = await createDTDEngine();
    [alice, bob, charles] = await ethers.getSigners();
    emptyMockContract = await createEmptyMockContract();
  });

  describe("Registration", function () {
    it("Should register a contract to DTD", async function () {
      const contractRole = await dtdEngine.CONTRACT_ROLE();
      await dtdEngine.grantRole(contractRole, emptyMockContract.address);
      expect(await dtdEngine.hasRole(contractRole, emptyMockContract.address)).to.eq(true);
    });

    it("Should fail to register contract to DTD", async function () {
    });

    it("Should add a new contract registror to DTD and then call it", async function () {
    });
  });

  describe("Pausing", function () {
    it("Should pause the contract successfully", async function () {
    });

    it("Should fail to pause contract", async function () {
    });

    it("Should not be able to call any methods of DTD when contract is paused", async function () {
    });
  });
});
