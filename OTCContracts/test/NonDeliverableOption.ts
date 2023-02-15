import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DTDEngine, MockToken, IndexTracker, AbsoluteSpotIndexCalculator, FlatCollateralCalculator, MockOracle, NoFix, NonDeliverableOption } from "../typechain-types";
import { createDTDEngine, createMockToken, createIndexContract, createFlatCollateralCalculator, createMockOracle, createAbsoluteSpotIndexCalculator, createNDOContract, createNoFix } from "./Utils";
import { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableSwap";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NDO", function () {
    const VALUE_MULTIPLIER = 10 ** 6;
    const SPOT_MULTIPLIER = 10 ** 10;
    const START_BALANCE = 1_000_000 * VALUE_MULTIPLIER;
    const NOTIONAL_AMOUNT = 100 * VALUE_MULTIPLIER;

    let dtdEngine: DTDEngine;
    let ndoContract: NonDeliverableOption;
    let mockToken: MockToken;
    let mockOracle: MockOracle;
    let index: IndexTracker;
    let absoluteSpot: AbsoluteSpotIndexCalculator;
    let fixStyle: NoFix;
    let flatCollateralCalc: FlatCollateralCalculator;
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableOption.NDODataStruct;
    let putContract: NonDeliverableOption.NDODataStruct;
    let alice: SignerWithAddress, bob: SignerWithAddress, charles: SignerWithAddress;
    let oracleVals: Array<number>;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        mockToken = await createMockToken();
        mockOracle = await createMockOracle();
        index = await createIndexContract();
        fixStyle = await createNoFix();
        absoluteSpot = await createAbsoluteSpotIndexCalculator(index.address);
        flatCollateralCalc = await createFlatCollateralCalculator();
        ndoContract = await createNDOContract(index.address, dtdEngine.address);
        const contractRole = await dtdEngine.CONTRACT_ROLE();

        dtdEngine.grantRole(contractRole, ndoContract.address);

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

        await index.createOracleStorage([mockOracle.address], absoluteSpot.address, fixStyle.address);
        const oracleStg1 = await index.calculateOracleIndex([mockOracle.address], absoluteSpot.address, fixStyle.address);

        await index.createSpotIndex(oracleStg1, [10000], [], ndoContract.address);

        offerEndTime = await time.latest() + 60 * 60;
        contractEndTime = await time.latest() + 10 * 60 * 60;

        base = {
            dtdContractId: 0,
            indexId: 1,
            fixParameters: [0],
            collateralCalculator: flatCollateralCalc.address,
            collateralCalculatorParams: [0, 10000],
            offerEndTime: offerEndTime,
            contractLockTime: 0,
            contractEndTime: contractEndTime
        }

        contract = {
            baseData: base,
            state: 0,
            notionalAmount: NOTIONAL_AMOUNT,
            optionType: 0,
            active: true,
            optionParams: [10 * VALUE_MULTIPLIER, 100 * SPOT_MULTIPLIER]
        }

        putContract = {
            baseData: base,
            state: 0,
            notionalAmount: NOTIONAL_AMOUNT,
            optionType: 1,
            active: true,
            optionParams: [10 * VALUE_MULTIPLIER, 100 * SPOT_MULTIPLIER]
        }

        oracleVals = [100, 110, 120, 130, 140, 50, 60, 70, 80, 200];
        oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

        await mockOracle.setVals(oracleVals);
    });

    it("Should create a contract successfully", async function () {
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1)

        const contractData = await ndoContract.getNDOData(1);

        expect(contractData.state).to.equal(0);
        expect(contractData.notionalAmount).to.equal(NOTIONAL_AMOUNT);
        expect(contractData.baseData.dtdContractId).to.equal(1);
    });

    it("Should fail to create contract", async function () {
        contract.baseData.offerEndTime = await time.latest() - 10000;
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.baseData.offerEndTime = offerEndTime;
        contract.baseData.contractEndTime = offerEndTime - 1;
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.baseData.contractEndTime = contractEndTime;
        contract.notionalAmount = 0;
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.rejected;

        contract.notionalAmount = 1000 * VALUE_MULTIPLIER;
        await expect(ndoContract.connect(bob).createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.rejected;
    });

    it("Should lock the contract after counterparty confirmation", async function () {
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);

        const v1 = await dtdEngine.getVault(1);
        const v2 = await dtdEngine.getVault(2);

        expect(v1.depositBalance).to.be.equal(START_BALANCE + 10 * VALUE_MULTIPLIER);
        expect(v1.minMarginLevel).to.be.equal(100 * VALUE_MULTIPLIER);
        expect(v2.depositBalance).to.be.equal(START_BALANCE - 10 * VALUE_MULTIPLIER);
        expect(v2.minMarginLevel).to.be.equal(0);
    });

    it("Should fail to lock the contract during counterparty confirmation", async function () {
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(2, 2)).to.be.rejected;

        await expect(ndoContract.connect(charles).lockContract(1, 3)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.be.rejected;
    });


    it("Should mark-to-market call contract successfully", async function () {
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);

        for (let i = 0; i < oracleVals.length; i++) {
            await dtdEngine.markToMarket(1);
            const v1 = await dtdEngine.getVault(1);
            const v2 = await dtdEngine.getVault(2);
            expect(v1.depositBalance).to.be.equal(START_BALANCE + 10 * VALUE_MULTIPLIER);
            expect(v2.depositBalance).to.be.equal(START_BALANCE - 10 * VALUE_MULTIPLIER);

            const CHANGE = Math.round(Math.max(0, oracleVals[i] - 100 * VALUE_MULTIPLIER) * NOTIONAL_AMOUNT) / VALUE_MULTIPLIER;
            expect(v1.minMarginLevel).to.be.equal(100 * VALUE_MULTIPLIER + CHANGE);
            expect(v2.minMarginLevel).to.be.equal(0);
            await time.increase(10);
            await mockOracle.increasePos();
        }
    });

    it("Should mark-to-market put contract successfully", async function () {
        await expect(ndoContract.createOptionContract(putContract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);

        for (let i = 0; i < oracleVals.length; i++) {
            await dtdEngine.markToMarket(1);
            const v1 = await dtdEngine.getVault(1);
            const v2 = await dtdEngine.getVault(2);
            expect(v1.depositBalance).to.be.equal(START_BALANCE + 10 * VALUE_MULTIPLIER);
            expect(v2.depositBalance).to.be.equal(START_BALANCE - 10 * VALUE_MULTIPLIER);

            const CHANGE = Math.round(Math.max(0, 100 * VALUE_MULTIPLIER - oracleVals[i]) * NOTIONAL_AMOUNT) / VALUE_MULTIPLIER;
            expect(v1.minMarginLevel).to.be.equal(100 * VALUE_MULTIPLIER + CHANGE);
            expect(v2.minMarginLevel).to.be.equal(0);
            await time.increase(10);
            await mockOracle.increasePos();
        }
    });

    it("Should fail to mark-to-market the contract", async function () {
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.emit(ndoContract, "NonDeliverableOptionCreated").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);

        await expect(ndoContract.markToMarket(1)).to.be.rejected;
        await expect(dtdEngine.markToMarket(2)).to.be.rejected;
    });
});