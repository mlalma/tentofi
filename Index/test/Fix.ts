// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockOracle, NoFix, SpotFix, SpotFixMul, SpotFixPlus } from "../typechain-types";
import { createMockOracle, createNoFix, createSpotFix, createSpotFixMul, createSpotFixPlus } from "./Utils";

describe("Fix tests", function () {

    let noFix: NoFix;
    let spotFix: SpotFix;
    let spotFixPlus: SpotFixPlus;
    let spotFixMul: SpotFixMul;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;

    const ORACLE_COUNT = 5;

    beforeEach(async function () {
        noFix = await createNoFix();
        spotFix = await createSpotFix();
        spotFixPlus = await createSpotFixPlus();
        spotFixMul = await createSpotFixMul();

        const vals = [1, 2, 3, 4, 5, 6];
        oracles = new Array<MockOracle>();
        oracleAddresses = new Array<string>();
        for (let i = 0; i < ORACLE_COUNT; i++) {
            const oracle = await createMockOracle();
            await oracle.setVals(vals);
            oracles.push(oracle);
            oracleAddresses.push(oracle.address);
        }
    });

    describe("NoFix tests", function () {
        it("Should not succeed", async function () {
            const fixVals = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT - 1; i++) {
                fixVals.push(0);
            }
            await expect(noFix.fixStrikes(oracleAddresses, fixVals)).to.be.rejected;
        });

        it("Should set the strikes correctly", async function () {
            const fixVals = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT; i++) {
                fixVals.push(i);
            }
            
            const strikes = await noFix.fixStrikes(oracleAddresses, fixVals);
            for (let i = 0; i < ORACLE_COUNT; i++) {                
                expect(fixVals[i]).to.equal(strikes[i]);
            }
        });
    });
});