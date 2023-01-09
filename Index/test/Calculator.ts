// Calculator tests. Index calculators are used to calculate the value of the index
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator } from "./Utils";
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
            weights.push(100 / ORACLE_COUNT);
        }
    });

    describe("AbsoluteSpotIndexCalculator", function () {

        it("Should correctly calculate the position of single underlying index", async function () {
            let oracleVals = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
            oracleVals.forEach((value, index, array) => { value * Math.pow(10, 6) });
            await oracles[0].setVals(oracleVals);

            // Create oracle storage
            await index.createOracleStorage([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);

            // Get the calculated oracle index
            const oracleStg1 = await index.calculateOracleIndex([oracleAddresses[0]], absoluteSpotCalculator.address, noFix.address);

            // Create spot index
            await index.createSpotIndex(oracleStg1, [100], []);

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
    });
});