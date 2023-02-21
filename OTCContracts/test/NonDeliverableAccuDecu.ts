import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { DTDEngine, MockToken, IndexTracker, AbsoluteSpotIndexCalculator, FlatCollateralCalculator, MockOracle, NoFix, NonDeliverableAccuDecu } from "../typechain-types";
import { createDTDEngine, createMockToken, createIndexContract, createFlatCollateralCalculator, createMockOracle, createAbsoluteSpotIndexCalculator, createNDACDEContract, createNoFix } from "./Utils";
import { OTCContractBase } from "../typechain-types/v1/contracts/NonDeliverableAccuDecu";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NDAccuDecu", function () {
    const VALUE_MULTIPLIER = 10 ** 6;
    const SPOT_MULTIPLIER = 10 ** 10;
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
    let offerEndTime: number;
    let contractEndTime: number;
    let base: OTCContractBase.BaseContractDataStruct;
    let contract: NonDeliverableAccuDecu.NDACDEDataStruct;
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
        ndacdeContract = await createNDACDEContract(index.address, dtdEngine.address);
        const contractRole = await dtdEngine.CONTRACT_ROLE();

        dtdEngine.grantRole(contractRole, ndacdeContract.address);

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

        await index.createSpotIndex(oracleStg1, [10000], [], ndacdeContract.address);

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
            AccuDeccuType: 0,
            strike: 70 * VALUE_MULTIPLIER,
            knockOutBarrier: 150 * VALUE_MULTIPLIER,
            leverageFactor: 20000,
            guaranteedFixings: 0
        }

        oracleVals = [100, 110, 120, 130, 140, 50, 60, 70, 80, 200];
        oracleVals = oracleVals.map((value, _index, _array) => { return value * VALUE_MULTIPLIER; });

        await mockOracle.setVals(oracleVals);
    });
});