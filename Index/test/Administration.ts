// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { WEIGHT_MULTIPLIER, createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator, VALUE_MULTIPLIER, SPOT_MULTIPLIER } from "./Utils";

describe("Administration", function () {

    let index: IndexTracker;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;
    let noFix: NoFix;

    const ORACLE_COUNT = 5;
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
            await oracle.setVals([0]);
            oracles.push(oracle);
            oracleAddresses.push(oracle.address);
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

            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            await index.createOracleStorage(oracleAddresses, relativeSpotCalculator.address, noFix.address);

            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg2 = await index.calculateOracleIndex(oracleAddresses, relativeSpotCalculator.address, noFix.address);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const oracleStorage2 = await index.getOracleStorage(oracleStg2);

            await index.createSpotIndex(oracleStg1, weights, []);
            await index.createSpotIndex(oracleStg2, weights, [0]);

            const indexStorage1 = await index.getIndexStorage(1);
            const indexStorage2 = await index.getIndexStorage(2);

            await expect(absoluteSpotCalculator.calculateIndex(oracleStorage1, indexStorage1, 1)).to.be.revertedWith("No access rights");
            await expect(relativeSpotCalculator.calculateIndex(oracleStorage2, indexStorage2, 2)).to.be.revertedWith("No access rights");
        });
    });

    describe("Index admin", function () {
        it("Should not allow the calls for modifying the index structure", async function () {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);
            const oracleStorage1 = await index.getOracleStorage(oracleStg1);

            await index.createSpotIndex(oracleStg1, weights, []);

            const a = Array(ORACLE_COUNT).fill([1 * VALUE_MULTIPLIER]).flat();

            await expect(index.connect(bob).fixIndex(1, a)).to.be.reverted;
            await index.fixIndex(1, a);

            await expect(index.connect(bob).calculateIndex(1)).to.be.reverted;
            await index.calculateIndex(1);

            const testIndex = await index.getIndexStorage(1);
            expect(testIndex.currentIndexValue).to.be.eq(-SPOT_MULTIPLIER);
        });
    });
});