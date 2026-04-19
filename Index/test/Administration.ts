// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";
import type { IndexTracker, AbsoluteSpotIndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types/index.js";
import {
    ethers,
    WEIGHT_MULTIPLIER,
    createAbsoluteSpotIndexCalculator,
    createIndexContract,
    createMockOracle,
    createNoFix,
    createRelativeSpotIndexCalculator,
    VALUE_MULTIPLIER,
    SPOT_MULTIPLIER,
} from "./Utils.js";

describe("Administration", function () {

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

    let weights: Array<number>;

    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let charles: HardhatEthersSigner;

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
            await oracle.setVals([0]);
            oracles.push(oracle);
            oracleAddresses.push(await oracle.getAddress());
        }

        weights = new Array<number>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            weights.push(WEIGHT_MULTIPLIER / ORACLE_COUNT);
        }
    });

    describe("Calculator admin", function () {
        it("Should not allow to call any methods", async function () {
            await expect(absoluteSpotCalculator.prepareNewIndex(1, 1, [])).to.be.revertedWith("No access rights");
            await expect(relativeSpotCalculator.prepareNewIndex(1, 1, [])).to.be.revertedWith("No access rights");

            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculatorAddress, noFixAddress);
            await index.createOracleStorage(oracleAddresses, relativeSpotCalculatorAddress, noFixAddress);

            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculatorAddress, noFixAddress);
            const oracleStg2 = await index.calculateOracleIndex(oracleAddresses, relativeSpotCalculatorAddress, noFixAddress);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const oracleStorage2 = await index.getOracleStorage(oracleStg2);

            await index.createSpotIndex(oracleStg1, weights, [], alice.address);
            await index.createSpotIndex(oracleStg2, weights, [0], bob.address);

            const indexStorage1 = await index.getIndexStorage(1);
            const indexStorage2 = await index.getIndexStorage(2);

            const oracleStorage1Input = {
                oracles: [...oracleStorage1.oracles],
                calculator: oracleStorage1.calculator,
                fixStyle: oracleStorage1.fixStyle,
            };
            const oracleStorage2Input = {
                oracles: [...oracleStorage2.oracles],
                calculator: oracleStorage2.calculator,
                fixStyle: oracleStorage2.fixStyle,
            };
            const indexStorage1Input = {
                markCount: indexStorage1.markCount,
                markingStartTimestamp: indexStorage1.markingStartTimestamp,
                markingPrevTimestamp: indexStorage1.markingPrevTimestamp,
                minDeltaBetweenMarkings: indexStorage1.minDeltaBetweenMarkings,
                oracleIndex: indexStorage1.oracleIndex,
                currentIndexValue: indexStorage1.currentIndexValue,
                callingContract: indexStorage1.callingContract,
                strikes: [...indexStorage1.strikes],
                weights: [...indexStorage1.weights],
            };
            const indexStorage2Input = {
                markCount: indexStorage2.markCount,
                markingStartTimestamp: indexStorage2.markingStartTimestamp,
                markingPrevTimestamp: indexStorage2.markingPrevTimestamp,
                minDeltaBetweenMarkings: indexStorage2.minDeltaBetweenMarkings,
                oracleIndex: indexStorage2.oracleIndex,
                currentIndexValue: indexStorage2.currentIndexValue,
                callingContract: indexStorage2.callingContract,
                strikes: [...indexStorage2.strikes],
                weights: [...indexStorage2.weights],
            };

            await expect(absoluteSpotCalculator.calculateIndex(oracleStorage1Input, indexStorage1Input, 1)).to.be.revertedWith("No access rights");
            await expect(relativeSpotCalculator.calculateIndex(oracleStorage2Input, indexStorage2Input, 2)).to.be.revertedWith("No access rights");

            await expect(index.connect(bob).calculateIndex(1, false)).to.be.revert(ethers);
            await expect(index.calculateIndex(2, false)).to.be.revert(ethers);
        });
    });

    describe("Index admin", function () {
        it("Should not allow the calls for modifying the index structure", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculatorAddress, noFixAddress);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculatorAddress, noFixAddress);
            const oracleStorage1 = await index.getOracleStorage(oracleStg1);

            await index.createSpotIndex(oracleStg1, weights, [], alice.address);

            const a = Array(ORACLE_COUNT).fill([1 * VALUE_MULTIPLIER]).flat();

            await expect(index.connect(bob).fixIndex(1, a)).to.be.revert(ethers);
            await index.fixIndex(1, a);

            await expect(index.connect(bob).calculateIndex(1, false)).to.be.revert(ethers);
            await index.calculateIndex(1, false);

            const testIndex = await index.getIndexStorage(1);
            expect(testIndex.currentIndexValue).to.be.eq(-SPOT_MULTIPLIER);
        });
    });
});
