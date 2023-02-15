import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DTDEngine, MockToken, NonDeliverableSwap, IndexTracker, AbsoluteSpotIndexCalculator, FlatCollateralCalculator, MockOracle, SpotFix, RelativeSpotIndexCalculator } from "../typechain-types";
import { createDTDEngine, createMockToken, createIndexContract, createRelativeSpotIndexCalculator, createFlatCollateralCalculator, createNDSContract, createMockOracle, createSpotFix, createAbsoluteSpotIndexCalculator } from "./Utils";
import { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableSwap";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NDS", function () {
    const VALUE_MULTIPLIER = 10 ** 6;
    const START_BALANCE = 1_000_000 * VALUE_MULTIPLIER;
    const NOTIONAL_AMOUNT = 1_000 * VALUE_MULTIPLIER;

    let dtdEngine: DTDEngine;
    let ndsContract: NonDeliverableSwap;
    let mockToken: MockToken;
    let mockOracle: MockOracle;
    let index: IndexTracker;
    let relativeSpot: RelativeSpotIndexCalculator;
    let fixStyle: SpotFix;
    let flatCollateralCalc: FlatCollateralCalculator;
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableSwap.NDSDataStruct;
    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
    let oracleVals: Array<number>;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        mockToken = await createMockToken();
        mockOracle = await createMockOracle();
        index = await createIndexContract();
        fixStyle = await createSpotFix();
        relativeSpot = await createRelativeSpotIndexCalculator(index.address);
        flatCollateralCalc = await createFlatCollateralCalculator();
        ndsContract = await createNDSContract(index.address, dtdEngine.address);
        const contractRole = await dtdEngine.CONTRACT_ROLE();

        dtdEngine.grantRole(contractRole, ndsContract.address);

        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(START_BALANCE);
        await mockToken.connect(bob).faucet(START_BALANCE);
        await mockToken.connect(charles).faucet(START_BALANCE);

        await dtdEngine.connect(alice).createVault(mockToken.address);
        await mockToken.connect(alice).approve(dtdEngine.address, START_BALANCE);
        await dtdEngine.connect(alice).changeDepositBalance(1, START_BALANCE);

        await dtdEngine.connect(bob).createVault(mockToken.address);
        await mockToken.connect(bob).approve(dtdEngine.address, START_BALANCE);
        await dtdEngine.connect(bob).changeDepositBalance(2, START_BALANCE);

        await dtdEngine.connect(charles).createVault(mockToken.address);
        await mockToken.connect(charles).approve(dtdEngine.address, START_BALANCE);
        await dtdEngine.connect(charles).changeDepositBalance(3, START_BALANCE);

        await index.createOracleStorage([mockOracle.address], relativeSpot.address, fixStyle.address);

        const oracleStg1 = await index.calculateOracleIndex([mockOracle.address], relativeSpot.address, fixStyle.address);

        await index.createSpotIndex(oracleStg1, [10000], [0], ndsContract.address);

        offerEndTime = await time.latest() + 60 * 60;
        contractEndTime = await time.latest() + 10 * 60 * 60;

        base = {
            dtdContractId: 0,
            indexId: 1,
            fixParameters: [],
            collateralCalculator: flatCollateralCalc.address,
            collateralCalculatorParams: [0, 10000],
            offerEndTime: offerEndTime,
            contractLockTime: 0,
            contractEndTime: contractEndTime
        }

        contract = {
            baseData: base,
            state: 0,
            notionalAmount: 1000 * VALUE_MULTIPLIER
        }

        oracleVals = [100, -100, 200, -200, 300, -300, 400, -400, 500, -500];
        oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

        await mockOracle.setVals(oracleVals);
    });

    it("Should create a contract successfully", async function () {
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.emit(ndsContract, "NonDeliverableSwapCreated").withArgs(1)

        const contractData = await ndsContract.getNDSData(1);

        expect(contractData.state).to.equal(0);
        expect(contractData.notionalAmount).to.equal(NOTIONAL_AMOUNT);
        expect(contractData.baseData.dtdContractId).to.equal(1);
    });

    it("Should fail to create contract", async function () {
        contract.baseData.offerEndTime = await time.latest() - 10000;
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.baseData.offerEndTime = offerEndTime;
        contract.baseData.contractEndTime = offerEndTime - 1;
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.baseData.contractEndTime = contractEndTime;
        contract.notionalAmount = 0;
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.notionalAmount = 1000 * VALUE_MULTIPLIER;
        await expect(ndsContract.connect(bob).createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.rejected;
    });

    it("Should lock the contract after counterparty confirmation", async function () {
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.emit(ndsContract, "NonDeliverableSwapCreated").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(1, 2)).to.emit(ndsContract, "NonDeliverableSwapLocked").withArgs(1);

        const v1 = await dtdEngine.getVault(1);
        const v2 = await dtdEngine.getVault(2);

        expect(v1.depositBalance).to.be.equal(START_BALANCE);
        expect(v1.minMarginLevel).to.be.equal(100 * VALUE_MULTIPLIER);
        expect(v2.depositBalance).to.be.equal(START_BALANCE);
        expect(v2.minMarginLevel).to.be.equal(200 * VALUE_MULTIPLIER);
    });

    it("Should fail to lock the contract during counterparty confirmation", async function () {
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.emit(ndsContract, "NonDeliverableSwapCreated").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(2, 2)).to.be.rejected;

        await expect(ndsContract.connect(charles).lockContract(1, 3)).to.emit(ndsContract, "NonDeliverableSwapLocked").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(1, 2)).to.be.rejected;
    });

    it("Should mark-to-market the contract successfully", async function () {
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.emit(ndsContract, "NonDeliverableSwapCreated").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(1, 2)).to.emit(ndsContract, "NonDeliverableSwapLocked").withArgs(1);

        for (let i = 0; i < oracleVals.length; i++) {
            await dtdEngine.markToMarket(1);
            const v1 = await dtdEngine.getVault(1);
            const v2 = await dtdEngine.getVault(2);
            expect(v1.depositBalance).to.be.equal(START_BALANCE);

            const CHANGE = Math.round(((oracleVals[i] / oracleVals[0]) - 1.0) * NOTIONAL_AMOUNT);
            expect(v1.minMarginLevel).to.be.equal(100 * VALUE_MULTIPLIER + Math.max(0, CHANGE));
            expect(v2.depositBalance).to.be.equal(START_BALANCE);
            expect(v2.minMarginLevel).to.be.equal(200 * VALUE_MULTIPLIER + Math.max(0, -CHANGE));
            await time.increase(10);
            await mockOracle.increasePos();
        }
    });

    it("Should fail to mark-to-market the contract", async function () {
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.emit(ndsContract, "NonDeliverableSwapCreated").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(1, 2)).to.emit(ndsContract, "NonDeliverableSwapLocked").withArgs(1);

        await expect(ndsContract.markToMarket(1)).to.be.rejected;
        await expect(dtdEngine.markToMarket(2)).to.be.rejected;
    });
});