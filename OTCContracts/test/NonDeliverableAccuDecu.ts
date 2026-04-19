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
    NonDeliverableAccuDecu,
} from "../typechain-types/index.js";
import {
    ethers,
    createDTDEngine,
    createMockToken,
    createIndexContract,
    createFlatCollateralCalculator,
    createMockOracle,
    createAbsoluteSpotIndexCalculator,
    createNDACDEContract,
    createNoFix,
    time,
} from "./Utils.js";
import type { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableAccuDecu.js";

describe("NDAccuDecu", function () {
    const VALUE_MULTIPLIER = 10 ** 6;
    const START_BALANCE = 1_000_000 * VALUE_MULTIPLIER;
    const NOTIONAL_AMOUNT = 100 * VALUE_MULTIPLIER;

    let dtdEngine: DTDEngine;
    let ndacdeContract: NonDeliverableAccuDecu;
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
    let ndacdeContractAddress: string;
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableAccuDecu.NDACDEDataStruct;
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
        ndacdeContract = await createNDACDEContract(indexAddress, dtdEngineAddress);
        ndacdeContractAddress = await ndacdeContract.getAddress();
        callForwarder = await (await ethers.getContractFactory("OTCCallForwarder")).deploy();
        await callForwarder.waitForDeployment();
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();

        await dtdEngine.grantRole(contractRole, ndacdeContractAddress);

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

        await index.createSpotIndex(oracleStg1, [10000], [], ndacdeContractAddress);

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
            accuDeccuType: 0,
            strike: 70 * VALUE_MULTIPLIER,
            knockOutBarrier: 150 * VALUE_MULTIPLIER,
            leverageFactor: 20000,
            guaranteedFixings: 0,
            consolidatedPL: 0
        }

        oracleVals = [100, 110, 120, 130, 140, 50, 60, 70, 80, 200];
        oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

        await mockOracle.setVals(oracleVals);
    });

    it("Should create a contract successfully", async function () {
        await expect(
            ndacdeContract.createAccuDecuContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER)
        ).to.emit(ndacdeContract, "NonDeliverableAccuDecuCreated").withArgs(1);

        const contractData = await ndacdeContract.NDACDELedger(1);
        expect(contractData.state).to.equal(0);
        expect(contractData.notionalAmount).to.equal(NOTIONAL_AMOUNT);
        expect(contractData.baseData.dtdContractId).to.equal(1);
    });

    it("Should reject forwarded contract creation to prevent tx.origin auth bypass", async function () {
        const callData = ndacdeContract.interface.encodeFunctionData("createAccuDecuContract", [
            contract,
            1,
            100 * VALUE_MULTIPLIER,
            200 * VALUE_MULTIPLIER
        ]);

        await expect(callForwarder.connect(alice).forward(ndacdeContractAddress, callData)).to.be.revert(ethers);
    });

    it("Should lock the correct DTD contract id when multiple OTC contracts share one engine", async function () {
        const contractRole = await dtdEngine.DTD_CONTRACT_ROLE();
        const secondNdacdeContract = await createNDACDEContract(await index.getAddress(), dtdEngineAddress);
        const secondNdacdeContractAddress = await secondNdacdeContract.getAddress();
        await dtdEngine.grantRole(contractRole, secondNdacdeContractAddress);

        const oracleStorageId = await index.calculateOracleIndex([mockOracleAddress], absoluteSpotAddress, fixStyleAddress);
        await index.createSpotIndex(oracleStorageId, [10000], [], secondNdacdeContractAddress);

        const secondBase = {
            ...base,
            indexId: 2
        };
        const secondContract: NonDeliverableAccuDecu.NDACDEDataStruct = {
            baseData: secondBase,
            state: 0,
            notionalAmount: NOTIONAL_AMOUNT,
            accuDeccuType: 0,
            strike: 70 * VALUE_MULTIPLIER,
            knockOutBarrier: 150 * VALUE_MULTIPLIER,
            leverageFactor: 20000,
            guaranteedFixings: 0,
            consolidatedPL: 0
        };

        await ndacdeContract.createAccuDecuContract(contract, 1, 100 * VALUE_MULTIPLIER, 200 * VALUE_MULTIPLIER);
        await secondNdacdeContract.connect(charles).createAccuDecuContract(
            secondContract,
            3,
            100 * VALUE_MULTIPLIER,
            200 * VALUE_MULTIPLIER
        );

        await secondNdacdeContract.connect(bob).lockContract(1, 2);

        const firstDtdContract = await dtdEngine.getContract(1);
        const secondDtdContract = await dtdEngine.getContract(2);
        expect(firstDtdContract.longCounterpartyVault).to.equal(0);
        expect(secondDtdContract.longCounterpartyVault).to.equal(2);
    });
});
