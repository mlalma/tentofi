import { expect } from "chai";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers.js";
import type { Contract } from "ethers";
import type {
    DTDEngine,
    MockToken,
    NonDeliverableSwap,
    IndexTracker,
    FlatCollateralCalculator,
    MockOracle,
    SpotFix,
    RelativeSpotIndexCalculator,
} from "../typechain-types/index.js";
import {
    ethers,
    createDTDEngine,
    createMockToken,
    createIndexContract,
    createRelativeSpotIndexCalculator,
    createFlatCollateralCalculator,
    createNDSContract,
    createMockOracle,
    createSpotFix,
    time,
} from "./Utils.js";
import type { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableSwap.js";

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
    let dtdEngineAddress: string;
    let mockTokenAddress: string;
    let mockOracleAddress: string;
    let relativeSpotAddress: string;
    let fixStyleAddress: string;
    let flatCollateralCalcAddress: string;
    let ndsContractAddress: string;
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableSwap.NDSDataStruct;
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
        fixStyle = await createSpotFix();
        fixStyleAddress = await fixStyle.getAddress();
        relativeSpot = await createRelativeSpotIndexCalculator(indexAddress);
        relativeSpotAddress = await relativeSpot.getAddress();
        flatCollateralCalc = await createFlatCollateralCalculator();
        flatCollateralCalcAddress = await flatCollateralCalc.getAddress();
        ndsContract = await createNDSContract(indexAddress, dtdEngineAddress);
        ndsContractAddress = await ndsContract.getAddress();
        callForwarder = await (await ethers.getContractFactory("OTCCallForwarder")).deploy();
        await callForwarder.waitForDeployment();
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();

        await dtdEngine.grantRole(contractRole, ndsContractAddress);

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

        await index.createOracleStorage([mockOracleAddress], relativeSpotAddress, fixStyleAddress);

        const oracleStg1 = await index.calculateOracleIndex([mockOracleAddress], relativeSpotAddress, fixStyleAddress);

        await index.createSpotIndex(oracleStg1, [10000], [0], ndsContractAddress);

        offerEndTime = await time.latest() + 60 * 60;
        contractEndTime = await time.latest() + 10 * 60 * 60;

        base = {
            dtdContractId: 0,
            indexId: 1,
            fixParameters: [],
            collateralCalculator: flatCollateralCalcAddress,
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
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.baseData.offerEndTime = offerEndTime;
        contract.baseData.contractEndTime = offerEndTime - 1;
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.baseData.contractEndTime = contractEndTime;
        contract.notionalAmount = 0;
        await expect(ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.revert(ethers);

        contract.notionalAmount = 1000 * VALUE_MULTIPLIER;
        await expect(ndsContract.connect(bob).createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)).to.be.revert(ethers);
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
        await expect(ndsContract.connect(bob).lockContract(2, 2)).to.be.revert(ethers);

        await expect(ndsContract.connect(charles).lockContract(1, 3)).to.emit(ndsContract, "NonDeliverableSwapLocked").withArgs(1);
        await expect(ndsContract.connect(bob).lockContract(1, 2)).to.be.revert(ethers);
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

        await expect(ndsContract.markToMarket(1)).to.be.revert(ethers);
        await expect(dtdEngine.markToMarket(2)).to.be.revert(ethers);
    });

    it("Should reject forwarded contract creation to prevent tx.origin auth bypass", async function () {
        const callData = ndsContract.interface.encodeFunctionData("createSwapContract", [
            contract,
            1,
            100 * VALUE_MULTIPLIER,
            200 * VALUE_MULTIPLIER
        ]);

        await expect(callForwarder.connect(alice).forward(ndsContractAddress, callData)).to.be.revert(ethers);
    });

    it("Should lock the correct DTD contract id when multiple OTC contracts share one engine", async function () {
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        const secondNdsContract = await createNDSContract(await index.getAddress(), dtdEngineAddress);
        const secondNdsContractAddress = await secondNdsContract.getAddress();
        await dtdEngine.grantRole(contractRole, secondNdsContractAddress);

        const oracleStorageId = await index.calculateOracleIndex([mockOracleAddress], relativeSpotAddress, fixStyleAddress);
        await index.createSpotIndex(oracleStorageId, [10000], [0], secondNdsContractAddress);

        const secondBase = {
            ...base,
            indexId: 2
        };
        const secondContract = {
            baseData: secondBase,
            state: 0,
            notionalAmount: NOTIONAL_AMOUNT
        };

        await ndsContract.createSwapContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER);
        await secondNdsContract.connect(charles).createSwapContract(
            secondContract,
            3,
            100 * VALUE_MULTIPLIER,
            200 * VALUE_MULTIPLIER
        );

        await secondNdsContract.connect(bob).lockContract(1, 2);

        const firstDtdContract = await dtdEngine.getContract(1);
        const secondDtdContract = await dtdEngine.getContract(2);
        expect(firstDtdContract.longCounterpartyVault).to.equal(0);
        expect(secondDtdContract.longCounterpartyVault).to.equal(2);
    });
});
