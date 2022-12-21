import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("Creation", function () {
    let dtdEngine: DTDEngine;
    let emptyMockContract: EmptyMockContract;
    let emptyMockContract2: EmptyMockContract;
    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
    let mockToken: MockToken;
    let mockToken2: MockToken;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        emptyMockContract = await createEmptyMockContract();
        emptyMockContract2 = await createEmptyMockContract();
        mockToken = await createMockToken();
        mockToken2 = await createMockToken();
        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(1_000_000);
        await mockToken.connect(bob).faucet(1_000_000);

        const contractRole = await dtdEngine.CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, bob.address);
    });

    describe("Vault", function () {
        it("Should create a vault and deposit tokens there", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);

            await mockToken.connect(alice).approve(dtdEngine.address, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);

            const vault = await dtdEngine.getVault(1);
            expect(vault.depositBalance).to.equal(1_000_000);
        });

        it("Should create a vault and fail to deposit tokens", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);

            await mockToken.connect(bob).approve(dtdEngine.address, 1_000_000);
            await expect(dtdEngine.connect(bob).changeDepositBalance(1, 1_000_000)).to.be.reverted;

            await mockToken.approve(dtdEngine.address, 999_999);
            await expect(dtdEngine.changeDepositBalance(1, 1_000_000)).to.be.reverted;
        });

        it("Should create two vaults", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);
            await expect(dtdEngine.createVault(mockToken2.address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, alice.address, mockToken2.address);
            await expect(dtdEngine.connect(bob).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(3, bob.address, mockToken.address);
            await expect(dtdEngine.connect(bob).createVault(mockToken2.address)).to.emit(dtdEngine, "VaultCreated").withArgs(4, bob.address, mockToken2.address);
        });

        it("Should create vault and move margin back and forth", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);

            expect(await mockToken.balanceOf(alice.address)).to.equal(1_000_000);
            await mockToken.connect(alice).approve(dtdEngine.address, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);
            expect(await mockToken.balanceOf(alice.address)).to.equal(0);

            await dtdEngine.changeDepositBalance(1, -500_000);
            expect(await mockToken.balanceOf(alice.address)).to.equal(500_000);

            await expect(dtdEngine.changeDepositBalance(1, -500_001)).to.be.reverted;
            await dtdEngine.changeDepositBalance(1, -500_000);
            expect(await mockToken.balanceOf(alice.address)).to.equal(1_000_000);
        });
    });

    describe("Contract", function () {
        it("Shoud create contract successfully", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);
            await mockToken.connect(alice).approve(dtdEngine.address, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);
            await expect(dtdEngine.createContract(emptyMockContract.address, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContract.address, alice.address);
        });

        it("Should fail to create contract", async function () {
            await expect(dtdEngine.connect(bob).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, bob.address, mockToken.address);
            await mockToken.connect(bob).approve(dtdEngine.address, 1_000_000);
            await dtdEngine.connect(bob).changeDepositBalance(1, 1_000_000);

            await expect(dtdEngine.connect(charles).createContract(emptyMockContract.address, 2, 1, 1000, 1000)).to.be.reverted;

            await expect(dtdEngine.createContract(emptyMockContract.address, 2, 1, 1000, 1000)).to.be.reverted;

            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, alice.address, mockToken.address);
            await mockToken.approve(dtdEngine.address, 999);
            await dtdEngine.changeDepositBalance(2, 999);
            await expect(dtdEngine.createContract(emptyMockContract.address, 2, 2, 1000, 1)).to.be.reverted;
        });

        it("Should create contract and lock it", async function () {
            await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);
            await expect(dtdEngine.connect(bob).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockToken.address);

            await mockToken.approve(dtdEngine.address, 1_000_000);
            await mockToken.connect(bob).approve(dtdEngine.address, 1_000_000);

            await dtdEngine.changeDepositBalance(1, 1_000_000);
            await dtdEngine.connect(bob).changeDepositBalance(2, 1_000_000);

            await expect(dtdEngine.createContract(emptyMockContract.address, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContract.address, alice.address);
            await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);
        });

        it("Should create contract and failt to lock it", async function () {

        });
    });
});
