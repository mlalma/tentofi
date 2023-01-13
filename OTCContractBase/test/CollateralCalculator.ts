import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CollateralMock, FlatCollateralCalculator, LinearCollateralCalculator } from "../typechain-types";

describe("CollateralCalculators", function () {

    let flatCalc: FlatCollateralCalculator;
    let linearCalc: LinearCollateralCalculator;
    let mock: CollateralMock;

    beforeEach(async function () {
        flatCalc = await (await ethers.getContractFactory("FlatCollateralCalculator")).deploy();
        linearCalc = await (await ethers.getContractFactory("LinearCollateralCalculator")).deploy();
        mock = await (await ethers.getContractFactory("CollateralMock")).deploy(flatCalc.address, linearCalc.address);
    });

    it("Should test flat collateral calculator", async function () {
        const testArr1 = [0, 10000];
        const testArr2 = [0, 5000];
        const testArr3 = [0, 0];

        await mock.calculateFlat(9999, testArr1);
        expect(await mock.getVal()).to.equal(9999);

        await mock.calculateFlat(5000, testArr2);
        expect(await mock.getVal()).to.equal(2500);

        await mock.calculateFlat(7777, testArr3);
        expect(await mock.getVal()).to.equal(0);
    });

    it("Should test linear collateral calculator", async function () {
        const testArr1 = [0, 0];
        const testArr2 = [2500, 0];
        const testArr3 = [5000, 0];
        const testArr4 = [7500, 0];
        const testArr5 = [10000, 0];

        await mock.calculateLinear(100, testArr1);
        expect(await mock.getVal()).to.equal(0);

        await mock.calculateLinear(100, testArr2);
        expect(await mock.getVal()).to.equal(25);

        await mock.calculateLinear(100, testArr3);
        expect(await mock.getVal()).to.equal(50);

        await mock.calculateLinear(100, testArr4);
        expect(await mock.getVal()).to.equal(75);

        await mock.calculateLinear(100, testArr5);
        expect(await mock.getVal()).to.equal(100);

        const testArr6 = [0, 2500];
        const testArr7 = [2500, 2500];
        const testArr8 = [5000, 2500];
        const testArr9 = [7500, 2500];
        const testArr10 = [10000, 2500];

        await mock.calculateLinear(100, testArr6);
        expect(await mock.getVal()).to.equal(25);

        await mock.calculateLinear(100, testArr7);
        expect(await mock.getVal()).to.equal(50);

        await mock.calculateLinear(100, testArr8);
        expect(await mock.getVal()).to.equal(75);

        await mock.calculateLinear(100, testArr9);
        expect(await mock.getVal()).to.equal(100);

        await mock.calculateLinear(100, testArr10);
        expect(await mock.getVal()).to.equal(100);
    });
});