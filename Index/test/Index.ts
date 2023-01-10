// Index tests. Tests index contract end-2-end. All parts of calculating the index are unit tested separately
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { WEIGHT_MULTIPLIER, createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator, VALUE_MULTIPLIER, SPOT_MULTIPLIER } from "./Utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Index", function () {

    let index: IndexTracker;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;
    let noFix: NoFix;

    const ORACLE_COUNT = 5;
    const DEF_VALUE = 4 * VALUE_MULTIPLIER;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;

    let weights: Array<number>;

    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let charles: SignerWithAddress;

    beforeEach(async function () {
        [alice, bob, charles] = await ethers.getSigners();

        index = await createIndexContract();
        absoluteSpotCalculator = await createAbsoluteSpotIndexCalculator(index.address);
        relativeSpotCalculator = await createRelativeSpotIndexCalculator(index.address);
        noFix = await createNoFix();

        oracles = new Array<MockOracle>();
        oracleAddresses = new Array<string>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            const oracle = await createMockOracle();
            await oracle.setVals([DEF_VALUE]);
            oracles.push(oracle);
            oracleAddresses.push(oracle.address);
        }

        weights = new Array<number>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            weights.push(WEIGHT_MULTIPLIER / ORACLE_COUNT);
        }
    });

    describe("Oracle storage", function () {
        it("Should create new entry in oracle storage", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);

            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStorage1 = await index.getOracleStorage(oracleStg1);

            expect(oracleStorage1.calculator).to.be.eq(absoluteSpotCalculator.address);
            expect(oracleStorage1.fixStyle).to.be.eq(noFix.address);
            expect(oracleStorage1.oracles.length).to.be.eq(ORACLE_COUNT);
            for (let i = 0; i < oracleAddresses.length; i++) {
                expect(oracleStorage1.oracles[i]).to.eq(oracleAddresses[i]);
            }
        });

        it("Should re-use entry in oracle storage", async function () {
            await expect(index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address)).to.emit(index, "OracleStorageCreated");
            await expect(index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address)).to.not.emit(index, "OracleStorageCreated");
        });
    });

    describe("Spot Index", function () {
        it("Should create a spot index", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            await expect(index.createSpotIndex(oracleStg1, weights, [])).to.emit(index, "SpotIndexCreated").withArgs(1);

            const indexData = await index.getIndexStorage(1);
            expect(indexData.oracleIndex).to.eq(oracleStg1);
            expect(indexData.weights.length).to.eq(weights.length);
            expect(indexData.markCount).to.eq(2 ** 32 - 1);
            expect(indexData.minDeltaBetweenMarkings).to.eq(0);
            expect(indexData.owner).to.eq(alice.address);
            expect(indexData.markingStartTimestamp).to.eq(0);
            expect(indexData.markingPrevTimestamp).to.eq(0);
            expect(indexData.currentIndexValue).to.eq(0);
        });

        it("Should fix a spot index properly", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            await expect(index.createSpotIndex(oracleStg1, weights, [])).to.emit(index, "SpotIndexCreated").withArgs(1);
            await expect(index.fixIndex(1, Array(ORACLE_COUNT).fill(0).flat())).to.emit(index, "IndexFixed").withArgs(1);

            const indexData = await index.getIndexStorage(1);
            const curTime = await time.latest();

            expect(indexData.oracleIndex).to.eq(oracleStg1);
            expect(indexData.weights.length).to.eq(weights.length);
            expect(indexData.markCount).to.eq(2 ** 32 - 1);
            expect(indexData.minDeltaBetweenMarkings).to.eq(0);
            expect(indexData.owner).to.eq(alice.address);
            expect(indexData.markingStartTimestamp).to.eq(curTime);
            expect(indexData.markingPrevTimestamp).to.eq(curTime);
            expect(indexData.currentIndexValue).to.eq(DEF_VALUE * SPOT_MULTIPLIER / VALUE_MULTIPLIER);
        });

        it("Should calculate spot index correctly", async function () {
            const vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

            await oracles[0].setVals(vals);

            await index.createOracleStorage([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);
            await expect(index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER], [])).to.emit(index, "SpotIndexCreated").withArgs(1);

            await expect(index.calculateIndex(1, false)).to.be.reverted;

            await expect(index.fixIndex(1, [0])).to.emit(index, "IndexFixed").withArgs(1);
            await time.increase(1);

            for (let i = 0; i < vals.length; i++) {
                await index.calculateIndex(1, false);
                const indexData = await index.getIndexStorage(1);
                expect(indexData.currentIndexValue).to.eq(vals[i] * SPOT_MULTIPLIER / VALUE_MULTIPLIER);
                await oracles[0].increasePos();
                await time.increase(1);
            }
        });
    });

    describe("Index", function () {
        it("Should create an index", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            await expect(index.createIndex(57, 3600, oracleStg1, weights, [])).to.emit(index, "IndexCreated").withArgs(1);

            const indexData = await index.getIndexStorage(1);
            expect(indexData.oracleIndex).to.eq(oracleStg1);
            expect(indexData.weights.length).to.eq(weights.length);
            expect(indexData.markCount).to.eq(57);
            expect(indexData.minDeltaBetweenMarkings).to.eq(3600);
            expect(indexData.owner).to.eq(alice.address);
            expect(indexData.markingStartTimestamp).to.eq(0);
            expect(indexData.markingPrevTimestamp).to.eq(0);
            expect(indexData.currentIndexValue).to.eq(0);
        });

        it("Should fix an index properly", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            await expect(index.createIndex(57, 3600, oracleStg1, weights, [])).to.emit(index, "IndexCreated").withArgs(1);
            await expect(index.fixIndex(1, Array(ORACLE_COUNT).fill(0).flat())).to.emit(index, "IndexFixed").withArgs(1);

            const indexData = await index.getIndexStorage(1);
            const curTime = await time.latest();

            expect(indexData.oracleIndex).to.eq(oracleStg1);
            expect(indexData.weights.length).to.eq(weights.length);
            expect(indexData.markCount).to.eq(57);
            expect(indexData.minDeltaBetweenMarkings).to.eq(3600);
            expect(indexData.owner).to.eq(alice.address);
            expect(indexData.markingStartTimestamp).to.eq(curTime);
            expect(indexData.markingPrevTimestamp).to.eq(curTime);
            expect(indexData.currentIndexValue).to.eq(DEF_VALUE * SPOT_MULTIPLIER / VALUE_MULTIPLIER);
        });

        it("Should calculate index correctly", async function () {
            const vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

            await oracles[0].setVals(vals);

            await index.createOracleStorage([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);
            await expect(index.createIndex(vals.length, 3600, oracleStg1, [WEIGHT_MULTIPLIER], [])).to.emit(index, "IndexCreated").withArgs(1);

            await expect(index.calculateIndex(1, false)).to.be.reverted;

            await expect(index.fixIndex(1, [0])).to.emit(index, "IndexFixed").withArgs(1);
            await time.increase(3600);

            for (let i = 0; i < vals.length; i++) {
                await index.calculateIndex(1, false);
                const indexData = await index.getIndexStorage(1);
                expect(indexData.currentIndexValue).to.eq(vals[i] * SPOT_MULTIPLIER / VALUE_MULTIPLIER);
                await oracles[0].increasePos();
                await time.increase(3600);
            }

            const indexData = await index.getIndexStorage(1);
            expect(indexData.markCount).to.eq(0);

            await expect(index.calculateIndex(1, false)).to.be.revertedWith("All the marks used or delta between calls too short");
        });
    });
});