// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MockOracle, NoFix, SpotFix, SpotFixMul, SpotFixMulPlus, SpotFixPlus } from "../typechain-types";
import { createMockOracle, createNoFix, createSpotFix, createSpotFixMul, createSpotFixMulPlus, createSpotFixPlus } from "./Utils";

describe("Fix tests", function () {

    let noFix: NoFix;
    let spotFix: SpotFix;
    let spotFixPlus: SpotFixPlus;
    let spotFixMul: SpotFixMul;
    let spotFixMulPlus: SpotFixMulPlus;
    let oracles: Array<MockOracle>;
    let oracleAddresses: Array<string>;
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const ORACLE_COUNT = 5;

    beforeEach(async function () {
        noFix = await createNoFix();
        spotFix = await createSpotFix();
        spotFixPlus = await createSpotFixPlus();
        spotFixMul = await createSpotFixMul();
        spotFixMulPlus = await createSpotFixMulPlus();

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

    describe("SpotFix tests", function () {
        it("Should not succeed", async function () {
            for (let i = 0; i < ORACLE_COUNT; i++) {
                await oracles[i].modifyPos(8);
            }

            const strikes = await spotFix.fixStrikes(oracleAddresses, []);
            for (let i = 0; i < ORACLE_COUNT; i++) {
                expect(strikes[i]).to.not.equal(vals[i]);
            }
        });

        it("Should set strikes correctly", async function () {
            for (let i = 0; i < ORACLE_COUNT; i++) {
                await oracles[i].modifyPos(i);
            }

            const strikes = await spotFix.fixStrikes(oracleAddresses, []);
            for (let i = 0; i < ORACLE_COUNT; i++) {
                expect(strikes[i]).to.equal(vals[i]);
            }
        });
    });

    describe("spotFixPlus tests", function () {
        it("Should not succeed", async function () {
            const fixVals = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT - 1; i++) {
                fixVals.push(0);
            }
            await expect(spotFixPlus.fixStrikes(oracleAddresses, fixVals)).to.be.rejected;
        });

        it("Should set strikes correctly", async function () {
            for (let i = 0; i < ORACLE_COUNT; i++) {
                await oracles[i].modifyPos(i);
            }

            const plus = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT; i++) {
                plus.push(10);
            }

            const strikes = await spotFixPlus.fixStrikes(oracleAddresses, plus);
            for (let i = 0; i < ORACLE_COUNT; i++) {
                expect(strikes[i]).to.equal(vals[i] + 10);
            }
        });
    });

    describe("spotFixMul tests", function () {
        it("Should not succeed", async function () {
            const fixVals = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT - 1; i++) {
                fixVals.push(0);
            }
            await expect(spotFixMul.fixStrikes(oracleAddresses, fixVals)).to.be.rejected;
        });

        it("Should set strikes correctly", async function () {
            for (let i = 0; i < ORACLE_COUNT; i++) {
                await oracles[i].modifyPos(i);
            }

            const mul = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT; i++) {
                mul.push(Math.round(1.5 * 65536));
            }

            const strikes = await spotFixMul.fixStrikes(oracleAddresses, mul);
            for (let i = 0; i < ORACLE_COUNT; i++) {
                expect(strikes[i]).to.equal(Math.floor(vals[i] * 1.5));
            }
        });
    });

    describe("spotFixMulPlus tests", function () {
        it("Should not succeed", async function () {
            const fixVals = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT; i++) {
                fixVals.push(0);
            }
            await expect(spotFixMulPlus.fixStrikes(oracleAddresses, fixVals)).to.be.rejected;
        });

        it("Should set strikes correctly", async function () {
            for (let i = 0; i < ORACLE_COUNT; i++) {
                await oracles[i].modifyPos(i);
            }

            const mul = new Array<number>();
            for (let i = 0; i < ORACLE_COUNT; i++) {
                mul.push(Math.round(1.5 * 65536));
                mul.push(10);
            }

            const strikes = await spotFixMulPlus.fixStrikes(oracleAddresses, mul);
            for (let i = 0; i < ORACLE_COUNT; i++) {
                expect(strikes[i]).to.equal(10 + Math.floor(vals[i] * 1.5));
            }
        });
    });
});