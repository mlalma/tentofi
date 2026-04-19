import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";
import type { Contract } from "ethers";
import type {
    DTDEngine,
    MockToken,
    IndexTracker,
    AbsoluteSpotIndexCalculator,
    FlatCollateralCalculator,
    MockOracle,
    NoFix,
    NonDeliverableOption,
} from "../typechain-types/index.js";
import {
    ethers,
    createDTDEngine,
    createMockToken,
    createIndexContract,
    createFlatCollateralCalculator,
    createMockOracle,
    createAbsoluteSpotIndexCalculator,
    createNDOContract,
    createNoFix,
    time,
} from "./Utils.js";
import type { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableOption.js";

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
    let dtdEngineAddress: string;
    let mockTokenAddress: string;
    let mockOracleAddress: string;
    let absoluteSpotAddress: string;
    let fixStyleAddress: string;
    let flatCollateralCalcAddress: string;
    let ndoContractAddress: string;
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableOption.NDODataStruct;
    let putContract: NonDeliverableOption.NDODataStruct;
    let callForwarder: Contract;
    let alice: HardhatEthersSigner, bob: HardhatEthersSigner, charles: HardhatEthersSigner;
    let oracleVals: Array<number>;

    beforeEach(async function () {
        dtdEngine = await createDTDEngine();
        dtdEngineAddress = await dtdEngine.getAddress();
        mockToken = await createMockToken();
        mockTokenAddress = await mockToken.getAddress();
        mockOracle = await createMockOracle();
        mockOracleAddress = await mockOracle.getAddress();
        index = await createIndexContract();
        const indexAddress = await index.getAddress();
        fixStyle = await createNoFix();
        fixStyleAddress = await fixStyle.getAddress();
        absoluteSpot = await createAbsoluteSpotIndexCalculator(indexAddress);
        absoluteSpotAddress = await absoluteSpot.getAddress();
        flatCollateralCalc = await createFlatCollateralCalculator();
        flatCollateralCalcAddress = await flatCollateralCalc.getAddress();
        ndoContract = await createNDOContract(indexAddress, dtdEngineAddress);
        ndoContractAddress = await ndoContract.getAddress();
        callForwarder = await (await ethers.getContractFactory("OTCCallForwarder")).deploy();
        await callForwarder.waitForDeployment();
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();

        await dtdEngine.grantRole(contractRole, ndoContractAddress);

        [alice, bob, charles] = await ethers.getSigners();

        await mockToken.connect(alice).faucet(START_BALANCE);
        await mockToken.connect(bob).faucet(START_BALANCE);
        await mockToken.connect(charles).faucet(START_BALANCE);

        await dtdEngine.connect(alice).createVault(mockTokenAddress);
        await mockToken.connect(alice).approve(dtdEngineAddress, START_BALANCE);
        await dtdEngine.connect(alice).changeDepositBalance(1, START_BALANCE);

        await dtdEngine.connect(bob).createVault(mockTokenAddress);
        await mockToken.connect(bob).approve(dtdEngineAddress, START_BALANCE);
        await dtdEngine.connect(bob).changeDepositBalance(2, START_BALANCE);

        await dtdEngine.connect(charles).createVault(mockTokenAddress);
        await mockToken.connect(charles).approve(dtdEngineAddress, START_BALANCE);
        await dtdEngine.connect(charles).changeDepositBalance(3, START_BALANCE);

        await index.createOracleStorage([mockOracleAddress], absoluteSpotAddress, fixStyleAddress);
        const oracleStg1 = await index.calculateOracleIndex([mockOracleAddress], absoluteSpotAddress, fixStyleAddress);

        await index.createSpotIndex(oracleStg1, [10000], [], ndoContractAddress);

        offerEndTime = await time.latest() + 60 * 60;
        contractEndTime = await time.latest() + 10 * 60 * 60;

        base = {
            dtdContractId: 0,
            indexId: 1,
            fixParameters: [0],
            collateralCalculator: flatCollateralCalcAddress,
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
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.baseData.offerEndTime = offerEndTime;
        contract.baseData.contractEndTime = offerEndTime - 1;
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.baseData.contractEndTime = contractEndTime;
        contract.notionalAmount = 0;
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.notionalAmount = 1000 * VALUE_MULTIPLIER;
        await expect(ndoContract.connect(bob).createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract = {
            ...contract,
            optionParams: [10 * VALUE_MULTIPLIER]
        };
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revertedWith(
            "Invalid option params"
        );

        contract = {
            ...contract,
            optionType: 2,
            optionParams: [10 * VALUE_MULTIPLIER, 100 * SPOT_MULTIPLIER]
        };
        await expect(ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER)).to.be.revertedWith(
            "Invalid digital option params"
        );
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
        await expect(ndoContract.connect(bob).lockContract(2, 2)).to.be.revert(ethers);

        await expect(ndoContract.connect(charles).lockContract(1, 3)).to.emit(ndoContract, "NonDeliverableOptionLocked").withArgs(1);
        await expect(ndoContract.connect(bob).lockContract(1, 2)).to.be.revert(ethers);
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

        await expect(ndoContract.markToMarket(1)).to.be.revert(ethers);
        await expect(dtdEngine.markToMarket(2)).to.be.revert(ethers);
    });

    it("Should reject forwarded contract creation to prevent tx.origin auth bypass", async function () {
        const callData = ndoContract.interface.encodeFunctionData("createOptionContract", [
            contract,
            1,
            100 * VALUE_MULTIPLIER
        ]);

        await expect(callForwarder.connect(alice).forward(ndoContractAddress, callData)).to.be.revert(ethers);
    });

    it("Should lock the correct DTD contract id when multiple OTC contracts share one engine", async function () {
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        const secondNdoContract = await createNDOContract(await index.getAddress(), dtdEngineAddress);
        const secondNdoContractAddress = await secondNdoContract.getAddress();
        await dtdEngine.grantRole(contractRole, secondNdoContractAddress);

        const oracleStorageId = await index.calculateOracleIndex([mockOracleAddress], absoluteSpotAddress, fixStyleAddress);
        await index.createSpotIndex(oracleStorageId, [10000], [], secondNdoContractAddress);

        const secondBase = {
            ...base,
            indexId: 2
        };
        const secondContract: NonDeliverableOption.NDODataStruct = {
            baseData: secondBase,
            state: 0,
            notionalAmount: NOTIONAL_AMOUNT,
            optionType: 0,
            active: true,
            optionParams: [10 * VALUE_MULTIPLIER, 100 * SPOT_MULTIPLIER]
        };

        await ndoContract.createOptionContract(contract, 1, 100 * VALUE_MULTIPLIER);
        await secondNdoContract.connect(charles).createOptionContract(secondContract, 3, 100 * VALUE_MULTIPLIER);

        await secondNdoContract.connect(bob).lockContract(1, 2);

        const firstDtdContract = await dtdEngine.getContract(1);
        const secondDtdContract = await dtdEngine.getContract(2);
        expect(firstDtdContract.longCounterpartyVault).to.equal(0);
        expect(secondDtdContract.longCounterpartyVault).to.equal(2);
    });
});
