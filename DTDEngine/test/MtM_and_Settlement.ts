import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("MarkToMarket", function () {
    let dtdEngine: DTDEngine;
    let emptyMockContract: EmptyMockContract;
    let emptyMockContract2: EmptyMockContract;
    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
    let mockToken: MockToken;
    let mockToken2: MockToken;

    const START_TOKENS = 1_000_000;
    const PENALTY_MARGIN = 1_000;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        emptyMockContract = await createEmptyMockContract();
        emptyMockContract2 = await createEmptyMockContract();
        mockToken = await createMockToken();
        mockToken2 = await createMockToken();
        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(START_TOKENS);
        await mockToken2.connect(alice).faucet(START_TOKENS);
        await mockToken.connect(bob).faucet(START_TOKENS);
        await mockToken.connect(charles).faucet(START_TOKENS);

        const contractRole = await dtdEngine.CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, bob.address);

        await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);

        await mockToken.connect(alice).approve(dtdEngine.address, START_TOKENS);
        await dtdEngine.changeDepositBalance(1, START_TOKENS);

        await expect(dtdEngine.createContract(emptyMockContract.address, 2, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContract.address, alice.address);

        await expect(dtdEngine.connect(bob).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockToken.address);
        await mockToken.connect(bob).approve(dtdEngine.address, START_TOKENS);
        await dtdEngine.connect(bob).changeDepositBalance(2, START_TOKENS);

        await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);

        await expect(dtdEngine.createVault(mockToken2.address)).to.emit(dtdEngine, "VaultCreated").withArgs(3, alice.address, mockToken2.address);
        await mockToken2.connect(alice).approve(dtdEngine.address, START_TOKENS);
        await dtdEngine.changeDepositBalance(3, START_TOKENS);

        await expect(dtdEngine.connect(charles).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(4, charles.address, mockToken.address);
        await mockToken.connect(charles).approve(dtdEngine.address, START_TOKENS);
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
        await expect(dtdEngine.createContract(emptyMockContract2.address, 2, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(2, emptyMockContract2.address, alice.address);
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
