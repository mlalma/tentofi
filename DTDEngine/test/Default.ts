import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("Defaulting", function () {
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

    const START_TOKENS = 1_000_0;
    const PENALTY_MARGIN = 1_000;

    async function grantAndMoveTokens(party: SignerWithAddress, vaultId: number) {
        await mockToken.connect(party).faucet(START_TOKENS);

        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, party.address);

        await dtdEngine.connect(party).createVault(mockTokenAddress);
        await mockToken.connect(party).approve(dtdEngineAddress, START_TOKENS);
        await dtdEngine.connect(party).changeDepositBalance(vaultId, START_TOKENS);
    }

    beforeEach(async function () {
        [dtdEngine, dtdEngineAddress] = await createDTDEngine();
        [emptyMockContract, emptyMockContractAddress] = await createEmptyMockContract();
        [emptyMockContract2, emptyMockContract2Address] = await createEmptyMockContract();
        [mockToken, mockTokenAddress] = await createMockToken();
        [mockToken2, mockToken2Address] = await createMockToken();

        [alice, bob, charles] = await ethers.getSigners();

        await grantAndMoveTokens(alice, 1);
        await grantAndMoveTokens(bob, 2);
        await grantAndMoveTokens(charles, 3);

        await expect(dtdEngine.createContract(emptyMockContractAddress, 2, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContractAddress, alice.address);
        await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);
    });

    it("Short party should not default as the whole deposit balance is used", async function () {
        const payout = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];

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
            expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN + payout[i]);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractSettled").withArgs(1, 9000);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(PENALTY_MARGIN);
        expect(bobVault.depositBalance).to.equal(2 * START_TOKENS - PENALTY_MARGIN);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);
    });

    it("Short party should default and penalty margin should be transferred", async function () {
        const payout = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            await emptyMockContract.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN + payout[i]);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarginCall").withArgs(1, alice.address);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(0);
        expect(bobVault.depositBalance).to.equal(2 * START_TOKENS);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);

        expect(await emptyMockContract.hasDefaulted()).to.equal(true);
    });

    it("Short party should default on one of the contracts and margins transferred between two counterparties accordingly", async function () {
        const payout = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 10000];
        const payout2 = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4000];

        await expect(dtdEngine.createContract(emptyMockContract2Address, 4, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(2, emptyMockContract2Address, alice.address);
        await expect(dtdEngine.connect(charles).lockContract(2, 3)).to.emit(dtdEngine, "ContractLocked").withArgs(2, 1, 3);

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        await emptyMockContract2.setPayoff(payout2);
        await emptyMockContract2.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        let charlesVault = await dtdEngine.getVault(3);

        expect(aliceVault.minMarginLevel).to.equal(2 * PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(charlesVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            await expect(dtdEngine.markToMarket(2)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(2, payout[i]);

            await emptyMockContract.increasePayoffPosition();
            await emptyMockContract2.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            charlesVault = await dtdEngine.getVault(3);
            expect(aliceVault.minMarginLevel).to.equal(2 * PENALTY_MARGIN + payout[i] + payout2[i]);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
            expect(charlesVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        charlesVault = await dtdEngine.getVault(3);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);
        expect(charlesVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarginCall").withArgs(1, alice.address);
        await expect(dtdEngine.markToMarket(2)).to.emit(dtdEngine, "ContractSettled").withArgs(2, 4000);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        charlesVault = await dtdEngine.getVault(3);

        expect(aliceVault.depositBalance).to.equal(PENALTY_MARGIN);
        expect(bobVault.depositBalance).to.equal(START_TOKENS + PENALTY_MARGIN + 4000);
        expect(charlesVault.depositBalance).to.equal(START_TOKENS + 4000);

        expect(await emptyMockContract.hasDefaulted()).to.equal(true);
        expect(await emptyMockContract2.hasDefaulted()).to.equal(false);
    });

    it("Long party should not default as the whole deposit balance is used", async function () {
        const payout = [0, -1000, -2000, -3000, -4000, -5000, -6000, -7000, -8000, -9000];

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
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN - payout[i]);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractSettled").withArgs(1, -9000);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(2 * START_TOKENS - PENALTY_MARGIN);
        expect(bobVault.depositBalance).to.equal(PENALTY_MARGIN);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);
    });

    it("Long party should default and penalty margin should be transferred", async function () {
        const payout = [0, -1000, -2000, -3000, -4000, -5000, -6000, -7000, -8000, -10000];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            await emptyMockContract.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            expect(aliceVault.minMarginLevel).to.equal(PENALTY_MARGIN);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN - payout[i]);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarginCall").withArgs(1, bob.address);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        expect(aliceVault.depositBalance).to.equal(2 * START_TOKENS);
        expect(bobVault.depositBalance).to.equal(0);
        expect(aliceVault.minMarginLevel).to.equal(0);
        expect(bobVault.minMarginLevel).to.equal(0);

        expect(await emptyMockContract.hasDefaulted()).to.equal(true);
    });

    it("Long party should default on one of the contracts and margins transferred between two counterparties accordingly", async function () {
        const payout = [0, -500, -1000, -1500, -2000, -2500, -3000, -3500, -4000, -10000];
        const payout2 = [0, -500, -1000, -1500, -2000, -2500, -3000, -3500, -4000, -4000];

        await expect(dtdEngine.createContract(emptyMockContract2Address, 4, 1, PENALTY_MARGIN, PENALTY_MARGIN)).to.emit(dtdEngine, "ContractCreated").withArgs(2, emptyMockContract2Address, alice.address);
        await expect(dtdEngine.connect(charles).lockContract(2, 3)).to.emit(dtdEngine, "ContractLocked").withArgs(2, 1, 3);

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        await emptyMockContract2.setPayoff(payout2);
        await emptyMockContract2.getPayoff();

        let aliceVault = await dtdEngine.getVault(1);
        let bobVault = await dtdEngine.getVault(2);
        let charlesVault = await dtdEngine.getVault(3);

        expect(aliceVault.minMarginLevel).to.equal(2 * PENALTY_MARGIN);
        expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN);
        expect(charlesVault.minMarginLevel).to.equal(PENALTY_MARGIN);

        for (let i = 0; i < payout.length - 1; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            await expect(dtdEngine.markToMarket(2)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(2, payout[i]);

            await emptyMockContract.increasePayoffPosition();
            await emptyMockContract2.increasePayoffPosition();

            aliceVault = await dtdEngine.getVault(1);
            bobVault = await dtdEngine.getVault(2);
            charlesVault = await dtdEngine.getVault(3);
            expect(aliceVault.minMarginLevel).to.equal(2 * PENALTY_MARGIN);
            expect(bobVault.minMarginLevel).to.equal(PENALTY_MARGIN - payout[i]);
            expect(charlesVault.minMarginLevel).to.equal(PENALTY_MARGIN - payout2[i]);
        }

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        charlesVault = await dtdEngine.getVault(3);
        expect(aliceVault.depositBalance).to.equal(START_TOKENS);
        expect(bobVault.depositBalance).to.equal(START_TOKENS);
        expect(charlesVault.depositBalance).to.equal(START_TOKENS);

        await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarginCall").withArgs(1, bob.address);
        await expect(dtdEngine.markToMarket(2)).to.emit(dtdEngine, "ContractSettled").withArgs(2, -4000);

        aliceVault = await dtdEngine.getVault(1);
        bobVault = await dtdEngine.getVault(2);
        charlesVault = await dtdEngine.getVault(3);

        expect(aliceVault.depositBalance).to.equal(2 * START_TOKENS + 4000);
        expect(bobVault.depositBalance).to.equal(0);
        expect(charlesVault.depositBalance).to.equal(6000);

        expect(await emptyMockContract.hasDefaulted()).to.equal(true);
        expect(await emptyMockContract2.hasDefaulted()).to.equal(false);
    });
});
