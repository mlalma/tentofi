import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("Creation", function () {
    let dtdEngine: DTDEngine;
    let dtdEngineAddress: string;
    let emptyMockContract: EmptyMockContract;
    let emptyMockContractAddress: string;
    let emptyMockContract2: EmptyMockContract;
    let emptyMockContract2Address: string;
    let mockToken: MockToken;
    let mockTokenAddress: string;
    let mockToken2: MockToken;
    let mockToken2Address: string;

    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;

    beforeEach(async function () {
        [dtdEngine, dtdEngineAddress] = await createDTDEngine();
        [emptyMockContract, emptyMockContractAddress] = await createEmptyMockContract();
        [emptyMockContract2, emptyMockContract2Address] = await createEmptyMockContract();
        [mockToken, mockTokenAddress] = await createMockToken();
        [mockToken2, mockToken2Address] = await createMockToken();

        [alice, bob, charles] = await ethers.getSigners();
        await mockToken.connect(alice).faucet(1_000_000);
        await mockToken.connect(bob).faucet(1_000_000);
        await mockToken2.connect(bob).faucet(1_000_000);

        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, bob.address);
    });

    describe("Vault", function () {
        it("Should create a vault and deposit tokens there", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);

            await mockToken.connect(alice).approve(dtdEngineAddress, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);

            const vault = await dtdEngine.getVault(1);
            expect(vault.depositBalance).to.equal(1_000_000);
        });

        it("Should create a vault and fail to deposit tokens", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);

            await mockToken.connect(bob).approve(dtdEngineAddress, 1_000_000);
            await expect(dtdEngine.connect(bob).changeDepositBalance(1, 1_000_000)).to.be.reverted;

            await mockToken.approve(dtdEngineAddress, 999_999);
            await expect(dtdEngine.changeDepositBalance(1, 1_000_000)).to.be.reverted;
        });

        it("Should create two vaults", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
            await expect(dtdEngine.createVault(mockToken2Address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, alice.address, mockToken2Address);
            await expect(dtdEngine.connect(bob).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(3, bob.address, mockTokenAddress);
            await expect(dtdEngine.connect(bob).createVault(mockToken2Address)).to.emit(dtdEngine, "VaultCreated").withArgs(4, bob.address, mockToken2Address);
        });

        it("Should create vault and move margin back and forth", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);

            expect(await mockToken.balanceOf(alice.address)).to.equal(1_000_000);
            await mockToken.connect(alice).approve(dtdEngineAddress, 1_000_000);
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
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
            await mockToken.connect(alice).approve(dtdEngineAddress, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);
            await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContractAddress, alice.address);
        });

        it("Should fail to create contract", async function () {
            await expect(dtdEngine.connect(bob).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, bob.address, mockTokenAddress);
            await mockToken.connect(bob).approve(dtdEngineAddress, 1_000_000);
            await dtdEngine.connect(bob).changeDepositBalance(1, 1_000_000);

            await expect(dtdEngine.connect(charles).createContract(emptyMockContractAddress, 2, 1, 1000, 1000)).to.be.reverted;

            await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, 1000, 1000)).to.be.reverted;

            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(2, alice.address, mockTokenAddress);
            await mockToken.approve(dtdEngineAddress, 999);
            await dtdEngine.changeDepositBalance(2, 999);
            await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 2, 1000, 1)).to.be.reverted;
        });

        it("Should create contract and lock it", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
            await expect(dtdEngine.connect(bob).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockTokenAddress);

            await mockToken.approve(dtdEngineAddress, 1_000_000);
            await mockToken.connect(bob).approve(dtdEngineAddress, 1_000_000);

            await dtdEngine.changeDepositBalance(1, 1_000_000);
            await dtdEngine.connect(bob).changeDepositBalance(2, 1_000_000);

            await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContractAddress, alice.address);
            await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);
        });

        it("Should create contract and failt to lock it", async function () {
            await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);
            await expect(dtdEngine.connect(bob).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockTokenAddress);
            await expect(dtdEngine.connect(bob).createVault(mockToken2Address)).to.emit(dtdEngine, "VaultCreated").withArgs(3, bob.address, mockToken2Address);

            await mockToken.approve(dtdEngineAddress, 1_000_000);
            await dtdEngine.changeDepositBalance(1, 1_000_000);

            await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContractAddress, alice.address);

            await expect(dtdEngine.connect(bob).lockContract(2, 2)).to.be.reverted;
            await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.be.reverted;

            await mockToken2.connect(bob).approve(dtdEngineAddress, 1_000_000);
            await dtdEngine.connect(bob).changeDepositBalance(3, 1_000_000);

            await expect(dtdEngine.connect(bob).lockContract(1, 3)).to.be.reverted;
        });
    });
});
