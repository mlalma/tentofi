import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createDTDEngine, createEmptyMockContract, createMockToken } from "./Utils";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

describe("MarkToMarket", function () {
    let dtdEngine: DTDEngine;
    let emptyMockContract: EmptyMockContract;
    let emptyMockContract2: EmptyMockContract;
    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
    let mockToken: MockToken;
    let mockToken2: MockToken;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        emptyMockContract = await createEmptyMockContract();
        emptyMockContract2 = await createEmptyMockContract();
        mockToken = await createMockToken();
        mockToken2 = await createMockToken();
        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(1_000_000);
        await mockToken.connect(bob).faucet(1_000_000);

        const contractRole = await dtdEngine.CONTRACT_ROLE();
        await dtdEngine.grantRole(contractRole, bob.address);

        await expect(dtdEngine.createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(1, alice.address, mockToken.address);

        await mockToken.connect(alice).approve(dtdEngine.address, 1_000_000);
        await dtdEngine.changeDepositBalance(1, 1_000_000);

        await expect(dtdEngine.createContract(emptyMockContract.address, 2, 1, 1000, 1000)).to.emit(dtdEngine, "ContractCreated").withArgs(1, emptyMockContract.address, alice.address);

        await expect(dtdEngine.connect(bob).createVault(mockToken.address)).to.emit(dtdEngine, "VaultCreated").withArgs(2, bob.address, mockToken.address);
        await mockToken.connect(bob).approve(dtdEngine.address, 1_000_000);
        await dtdEngine.connect(bob).changeDepositBalance(2, 1_000_000);

        await expect(dtdEngine.connect(bob).lockContract(1, 2)).to.emit(dtdEngine, "ContractLocked").withArgs(1, 1, 2);
    });

    it("Should correctly settle a contract with linear win for long party", async function () {
        const payout = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        await emptyMockContract.setPayoff(payout);
        await emptyMockContract.getPayoff();

        for (let i = 0; i < payout.length; i++) {
            await expect(dtdEngine.markToMarket(1)).to.emit(dtdEngine, "ContractMarkedToMarket").withArgs(1, payout[i]);
            emptyMockContract.increasePayoffPosition();
        }
    });
});
