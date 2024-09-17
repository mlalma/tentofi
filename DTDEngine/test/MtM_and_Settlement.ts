import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("MarkToMarket", function () {
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

    const START_TOKENS = 1_000_000;
    const PENALTY_MARGIN = 1_000;

    beforeEach(async function () {
        [dtdEngine, dtdEngineAddress] = await createDTDEngine();
        [emptyMockContract, emptyMockContractAddress] = await createEmptyMockContract();
        [emptyMockContract2, emptyMockContract2Address] = await createEmptyMockContract();
        [mockToken, mockTokenAddress] = await createMockToken();
        [mockToken2, mockToken2Address] = await createMockToken();
        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(START_TOKENS);
        await mockToken2.connect(alice).faucet(START_TOKENS);
        await mockToken.connect(bob).faucet(START_TOKENS);
        await mockToken.connect(charles).faucet(START_TOKENS);

        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, bob.address);

        await expect(dtdEngine.createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockTokenAddress);

        await mockToken.connect(alice).approve(dtdEngineAddress, START_TOKENS);
        await dtdEngine.changeDepositBalance(1, START_TOKENS);

        await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContractAddress, alice.address);

        await expect(dtdEngine.connect(bob).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockTokenAddress);
        await mockToken.connect(bob).approve(dtdEngineAddress, START_TOKENS);
        await dtdEngine.connect(bob).changeDepositBalance(2, START_TOKENS);

        await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);

        await expect(dtdEngine.createVault(mockToken2Address)).to.emit(dtdEngine, "VaultCreated").withArgs(3, alice.address, mockToken2Address);
        await mockToken2.connect(alice).approve(dtdEngineAddress, START_TOKENS);
        await dtdEngine.changeDepositBalance(3, START_TOKENS);

        await expect(dtdEngine.connect(charles).createVault(mockTokenAddress)).to.emit(dtdEngine, "VaultCreated").withArgs(4, charles.address, mockTokenAddress);
        await mockToken.connect(charles).approve(dtdEngineAddress, START_TOKENS);
        await dtdEngine.connect(charles).changeDepositBalance(4, START_TOKENS);
    });

    it("Should correctly settle a contract with linear win for long party", async function () {
        const payout = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            emptyMockContract.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN + i);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractSettled").withArgs(1, 10);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS - 10);
        expect(bobVault.depositBalance).to.equal(START_TOKENS + 10);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);
    });

    it("Should correctly settle a contract with linear win for short party", async function () {
        const payout = [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            emptyMockContract.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN + i);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractSettled").withArgs(1, -10);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS + 10);
        expect(bobVault.depositBalance).to.equal(START_TOKENS - 10);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);
    });

    it("Should correctly settle a contract with seesaw profile", async function () {
        const payout = [0, -1, 2, -3, 4, -5, 6, -7, 8, -9, 10];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            emptyMockContract.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            expect(aliceVault.minMarginLevel).to.equal(Math.max(PENALTY_MARGIN, PENALTY_MARGIN + payout[i]));
            expect(bobVault.minMarginLevel).to.equal(Math.max(PENALTY_MARGIN, PENALTY_MARGIN - payout[i]));
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractSettled").withArgs(1, 10);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS - 10);
        expect(bobVault.depositBalance).to.equal(START_TOKENS + 10);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);
    });

    it("Should correctly settle contract when there is no counterparty and contract is terminated", async function () {
        await expect(dtdEngine.createContract(emptyMockContract2Address, 2, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(2, emptyMockContract2Address, alice.address);
        let aliceVault = await dtdEngine.getVault(1);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(aliceVault.minMarginLevel).to.equal(2 * PENALTY_MARGIN);
        emptyMockContract2.setDunzo(true);
        await expect(dtdEngine.markToMarket(2)).to.emit(dtdEngine, "ContractSettled").withArgs(2, 0);
        aliceVault = await dtdEngine.getVault(1);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
    });

    describe("Transfer", function () {
        it("Should transfer correct amount of balance to other vault", async function () {
            await dtdEngine.connect(alice).transferBetweenVaults(2, 1, 1_000);
            const v1 = await dtdEngine.getVault(1);
            const v2 = await dtdEngine.getVault(2);

            expect(v1.depositBalance).to.eq(START_TOKENS - 1_000);
            expect(v2.depositBalance).to.eq(START_TOKENS + 1_000);
        });

        it("Should not transfer balance to other vault", async function () {
            await expect(dtdEngine.connect(bob).transferBetweenVaults(2, 1, 1_000)).to.be.reverted;
            await expect(dtdEngine.connect(alice).transferBetweenVaults(2, 1, START_TOKENS - PENALTY_MARGIN + 1)).to.be.reverted;
            await expect(dtdEngine.connect(alice).transferBetweenVaults(2, 3, 1_000)).to.be.reverted;
        });
    });
});
