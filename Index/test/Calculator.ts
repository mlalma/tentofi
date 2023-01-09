// Calculator tests. Index calculators are used to calculate the value of the index
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator } from "./Utils";

describe("Calculators", function() {

    let index: IndexTracker;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;
    let noFix: NoFix;

    const ORACLE_COUNT = 5;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;

    let weights: Array<number>;

    beforeEach(async function() {
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

    describe("AbsoluteSpotIndexCalculator", function() {
        
        it("Should correctly calculate the position", async function() {
            await index.createOracleStorage(oracleAddresses, absoluteSpotCalculator.address, noFix.address);

            const oracleStg1 = await index.calculateOracleIndex(oracleAddresses, absoluteSpotCalculator.address, noFix.address);

            await index.createSpotIndex(oracleStg1, weights, []);

            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const indexStorage1 = await index.getIndexStorage(1);

            await absoluteSpotCalculator.connect(index.address).calculateIndex(oracleStorage1, indexStorage1, 1);
        });
    });
});