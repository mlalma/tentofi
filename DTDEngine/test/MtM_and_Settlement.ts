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
        await mockToken.connect(bob).faucet(START_TOKENS);

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
});
