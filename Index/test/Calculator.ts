// Calculator tests. Index calculators are used to calculate the value of the index
import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";
import type { IndexTracker, AbsoluteSpotIndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types/index.js";
import {
    ethers,
    SPOT_MULTIPLIER,
    WEIGHT_MULTIPLIER,
    createAbsoluteSpotIndexCalculator,
    createIndexContract,
    createMockOracle,
    createNoFix,
    createRelativeSpotIndexCalculator,
    VALUE_MULTIPLIER,
    time,
} from "./Utils.js";

describe("Calculators", function () {

    let index: IndexTracker;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;
    let noFix: NoFix;
    let absoluteSpotCalculatorAddress: string;
    let relativeSpotCalculatorAddress: string;
    let noFixAddress: string;

    const ORACLE_COUNT = 5;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;

    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let charles: HardhatEthersSigner;

    let weights: Array<number>;

    beforeEach(async function () {
        [alice, bob, charles] = await ethers.getSigners();
        index = await createIndexContract();
        const indexAddress = await index.getAddress();
        absoluteSpotCalculator = await createAbsoluteSpotIndexCalculator(indexAddress);
        relativeSpotCalculator = await createRelativeSpotIndexCalculator(indexAddress);
        noFix = await createNoFix();
        absoluteSpotCalculatorAddress = await absoluteSpotCalculator.getAddress();
        relativeSpotCalculatorAddress = await relativeSpotCalculator.getAddress();
        noFixAddress = await noFix.getAddress();

        oracles = new Array<MockOracle>();
        oracleAddresses = new Array<string>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            const oracle = await createMockOracle();
            oracles.push(oracle);
            oracleAddresses.push(await oracle.getAddress());
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
            await index.createOracleStorage([oracleAddresses[0]], absoluteSpotCalculatorAddress, noFixAddress);

            // Get the calculated oracle index
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], absoluteSpotCalculatorAddress, noFixAddress);

            // Create spot index
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER], [], alice.address);

            // Fix the index to be able to start calculating the index value properly
            await index.fixIndex(1, [0])

            // Get indices
            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(oracleVals[i] * Math.pow(10, 4));
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], absoluteSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], absoluteSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 2], [], alice.address);
            await index.fixIndex(1, [0, 0])

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(oracleVals[i] * Math.pow(10, 4) / 2 + oracleVals2[i] * Math.pow(10, 4) / 2);
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], absoluteSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], absoluteSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 4, WEIGHT_MULTIPLIER / 4], [], alice.address);
            await index.fixIndex(1, [10 * VALUE_MULTIPLIER, -2 * VALUE_MULTIPLIER, 3 * VALUE_MULTIPLIER]);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                await index.calculateIndex(1, false);
                const val1 = (oracleVals[i] * Math.pow(10, 4) - 10 * Math.pow(10, 10)) / 2;
                const val2 = (oracleVals2[i] * Math.pow(10, 4) + 2 * Math.pow(10, 10)) / 4;
                const val3 = (oracleVals3[i] * Math.pow(10, 4) - 3 * Math.pow(10, 10)) / 4;
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(val1 + val2 + val3);
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

            await index.createOracleStorage([oracleAddresses[0]], relativeSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], relativeSpotCalculatorAddress, noFixAddress);

            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER], [0], alice.address);

            const FIX = 2 * VALUE_MULTIPLIER;
            await index.fixIndex(1, [FIX]);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(oracleVals[i] * SPOT_MULTIPLIER / FIX - SPOT_MULTIPLIER);
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 2], [0], alice.address);

            const fixes = [2 * 10 ** 6, 4 * 10 ** 6];
            await index.fixIndex(1, fixes);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val1 = 0.5 * (oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = 0.5 * (oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(val1 + val2);
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], relativeSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1], oracleAddresses[2]], relativeSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER / 2, WEIGHT_MULTIPLIER / 4, WEIGHT_MULTIPLIER / 4], [0], alice.address);
            const fixes = [10 * VALUE_MULTIPLIER, -2 * VALUE_MULTIPLIER, 3 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val1 = Math.trunc(Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER) * 5000 / 10000);
                const val2 = Math.trunc(Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER) * 2500 / 10000);
                const val3 = Math.trunc(Math.trunc(oracleVals3[i] * SPOT_MULTIPLIER / fixes[2] - SPOT_MULTIPLIER) * 2500 / 10000);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(Math.floor(val1 + val2 + val3));
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER, WEIGHT_MULTIPLIER], [1], alice.address);

            const fixes = [2 * VALUE_MULTIPLIER, 4 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val1 = Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(Math.min(val1, val2));
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

            await index.createOracleStorage([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0], oracleAddresses[1]], relativeSpotCalculatorAddress, noFixAddress);
            await index.createSpotIndex(oracleStg1, [WEIGHT_MULTIPLIER, WEIGHT_MULTIPLIER], [2], alice.address);

            const fixes = [2 * VALUE_MULTIPLIER, 4 * VALUE_MULTIPLIER];
            await index.fixIndex(1, fixes);

            for (let i = 0; i < oracleVals.length; i++) {
                await time.increase(1);
                const val1 = Math.trunc(oracleVals[i] * SPOT_MULTIPLIER / fixes[0] - SPOT_MULTIPLIER);
                const val2 = Math.trunc(oracleVals2[i] * SPOT_MULTIPLIER / fixes[1] - SPOT_MULTIPLIER);
                await index.calculateIndex(1, false);
                const indexStorage1 = await index.getIndexStorage(1);
                expect(indexStorage1.currentIndexValue).to.eq(Math.max(val1, val2));
                await oracles[0].increasePos();
                await oracles[1].increasePos();
            }
        });
    });
});
