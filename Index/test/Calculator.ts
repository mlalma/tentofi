// Calculator tests. Index calculators are used to calculate the value of the index
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { SPOT_MULTIPLIER, WEIGHT_MULTIPLIER, createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator, VALUE_MULTIPLIER } from "./Utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Calculators", function () {

    let index: IndexTracker;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;
    let noFix: NoFix;

    const ORACLE_COUNT = 5;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;

    let weights: Array<number>;

    beforeEach(async function () {
        index = await createIndexContract();
        absoluteSpotCalculator = await createAbsoluteSpotIndexCalculator(index.address);
        relativeSpotCalculator = await createRelativeSpotIndexCalculator(index.address);
        noFix = await createNoFix();

        oracles = new Array<MockOracle>();
        oracleAddresses = new Array<string>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            const oracle = await createMockOracle();
            oracles.push(oracle);
            oracleAddresses.push(oracle.address);
        }

        weights = new Array<number>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            weights.push(WEIGHT_MULTIPLIER / ORACLE_COUNT);
        }
    });

    describe("AbsoluteSpotIndexCalculator", function () {
        it("Should correctly calculate the value of a single underlying index", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);

            // Create oracle storage
            await index.createOracleStorage([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);

            // Get the calculated oracle index
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);

            // Create spot index
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER], []);

            // Fix the index to be able to start calculating the index value properly
            await index.fixIndex(1, [0])

            // Get indices
            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await absoluteSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);
                expect(val).to.eq(oracleVals[i] * Math.pow(10, 4));
                await oracles[0].increasePos();
            }
        });

        it("Should correctly calculate the value index consisting of multiple underlying sources", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], absoluteSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 2], []);
            await index.fixIndex(1, [0, 0])

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await absoluteSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);
                expect(val).to.eq(oracleVals[i] * Math.pow(10, 4) / 2 + oracleVals2[i] * Math.pow(10, 4) / 2);
                await oracles[0].increasePos();
                await oracles[1].increasePos();
            }
        });

        it("Should correctly calculate the value index consisting of multiple underlying sources w/ different weightings", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];
            let oracleVals3 = [10, 42, -12, 33, -27, 35, -46, 55, -78, 89, -115];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals3 = oracleVals3.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);
            await oracles[2].setVals(oracleVals3);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], absoluteSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 4, WEIGHT_MULTIPLIER / 4], []);
            await index.fixIndex(1, [10 * VALUE_MULTIPLIER, -2 * VALUE_MULTIPLIER, 3 * VALUE_MULTIPLIER]);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await absoluteSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);

                const val1 = (oracleVals[i] * Math.pow(10, 4) - 10 * Math.pow(10, 10)) / 2;
                const val2 = (oracleVals2[i] * Math.pow(10, 4) + 2 * Math.pow(10, 10)) / 4;
                const val3 = (oracleVals3[i] * Math.pow(10, 4) - 3 * Math.pow(10, 10)) / 4;

                expect(val).to.eq(val1 + val2 + val3);
                await oracles[0].increasePos();
                await oracles[1].increasePos();
                await oracles[2].increasePos();
            }
        });
    });

    describe("RelativeSpotIndexCalculator", function () {
        it("Should correctly calculate the value of a single underlying index", async function () {
            let oracleVals: Array<number> = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

            await oracles[0].setVals(oracleVals);

            await index.createOracleStorage([oracleAddresses[0]], relativeSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], relativeSpotCalculator.address, noFix.address);

            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER], [0]);

            const FIX = 2 * VALUE_MULTIPLIER;
            await index.fixIndex(1, [FIX]);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await relativeSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);
                expect(val).to.eq(oracleVals[i] * SPOT_MULTIPLIER / FIX - SPOT_MULTIPLIER);
                await oracles[0].increasePos();
            }
        });

        it("Should correctly calculate the avg value index consisting of multiple underlying sources", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * Math.pow(10, 6); });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * Math.pow(10, 6); });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 2], [0]);

            const fixes = [2 * 10 ** 6, 4 * 10 ** 6];
            await index.fixIndex(1, fixes);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await relativeSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);

                const val1 = 0.5 * (oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = 0.5 * (oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                expect(val).to.eq(val1 + val2);
                await oracles[0].increasePos();
                await oracles[1].increasePos();
            }
        });

        it("Should correctly calculate the value index consisting of multiple underlying sources w/ different weightings", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];
            let oracleVals3 = [10, 42, -12, 33, -27, 35, -46, 55, -78, 89, -115];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals3 = oracleVals3.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);
            await oracles[2].setVals(oracleVals3);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], relativeSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], relativeSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 4, WEIGHT_MULTIPLIER / 4], [0]);
            const fixes = [10 * VALUE_MULTIPLIER, -2 * VALUE_MULTIPLIER, 3 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await relativeSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);

                const val1 = Math.trunc(Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER) * 5000 / 10000);
                const val2 = Math.trunc(Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER) * 2500 / 10000);
                const val3 = Math.trunc(Math.trunc(oracleVals3[i] * SPOT_MULTIPLIER / fixes[2] - SPOT_MULTIPLIER) * 2500 / 10000);

                expect(val).to.eq(Math.floor(val1 + val2 + val3));
                await oracles[0].increasePos();
                await oracles[1].increasePos();
                await oracles[2].increasePos();
            }
        });

        it("Should correctly calculate the min value index consisting of multiple underlying sources", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER, WEIGHT_MULTIPLIER], [1]);

            const fixes = [2 * VALUE_MULTIPLIER, 4 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await relativeSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);

                const val1 = Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                expect(val).to.eq(Math.min(val1, val2));
                await oracles[0].increasePos();
                await oracles[1].increasePos();
            }
        });

        it("Should correctly calculate the max value index consisting of multiple underlying sources", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            let oracleVals2 = [0, 2, -2, 3, -7, 5, -6, 5, -8, 9, -15];

            oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            oracleVals2 = oracleVals2.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });
            await oracles[0].setVals(oracleVals);
            await oracles[1].setVals(oracleVals2);

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculator.address, noFix.address);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER, WEIGHT_MULTIPLIER], [2]);

            const fixes = [2 * VALUE_MULTIPLIER, 4 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val = await relativeSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);

                const val1 = Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                expect(val).to.eq(Math.max(val1, val2));
                await oracles[0].increasePos();
                await oracles[1].increasePos();
            }
        });
    });
});