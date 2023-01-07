// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IndexTracker, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator, NoFix, MockOracle } from "../typechain-types";
import { createAbsoluteSpotIndexCalculator, createIndexContract, createMockOracle, createNoFix, createRelativeSpotIndexCalculator } from "./Utils";

describe("Administration", function () {

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
            weights.push(100/ORACLE_COUNT);
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

            await index.createSpotIndex(oracleStg1, weights, []);
            await index.createSpotIndex(oracleStg2, weights, [0]);
            
            const oracleStorage1 = await index.getOracleStorage(oracleStg1);
            const oracleStorage2 = await index.getOracleStorage(oracleStg2);

            const indexStorage1 = await index.getIndexStorage(1);
            const indexStorage2 = await index.getIndexStorage(2);

            await expect(absoluteSpotCalculator.calculateIndex(oracleStorage1, indexStorage1, 1)).to.be.revertedWith("No access rights");
            await expect(relativeSpotCalculator.calculateIndex(oracleStorage2, indexStorage2, 2)).to.be.revertedWith("No access rights");
        });
    });
});