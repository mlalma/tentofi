// Index fix tests. Index fixes are used to lock down the strikes used then to calculate the actual index value
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Index, AbsoluteSpotIndexCalculator, IndexCalculator, RelativeSpotIndexCalculator } from "../typechain-types";
import { createAbsoluteSpotIndexCalculator, createIndexContract, createRelativeSpotIndexCalculator } from "./Utils";

describe("Administration", function () {

    let index: Index;
    let absoluteSpotCalculator: AbsoluteSpotIndexCalculator;
    let relativeSpotCalculator: RelativeSpotIndexCalculator;

    beforeEach(async function () {
        index = await createIndexContract();
        absoluteSpotCalculator = await createAbsoluteSpotIndexCalculator(index.address);
        relativeSpotCalculator = await createRelativeSpotIndexCalculator(index.address);
    });

    describe("Calculator admin", function () {

        it("Should not allow to call any methods", async function () {
            await expect(absoluteSpotCalculator.prepareNewIndex(1, 1, [])).to.be.revertedWith("No access rights");
            await expect(relativeSpotCalculator.prepareNewIndex(1, 1, [])).to.be.revertedWith("No access rights");
        });
    });
});