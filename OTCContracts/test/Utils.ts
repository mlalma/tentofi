import { ethers } from "hardhat";
import { DTDEngine, MockToken, IndexTracker, RelativeSpotIndexCalculator, NoFix, FlatCollateralCalculator, NonDeliverableSwap, NonDeliverableOption, MockOracle, SpotFix, AbsoluteSpotIndexCalculator, NonDeliverableAccuDecu } from "../typechain-types";

export async function createDTDEngine(): Promise<DTDEngine> {
    const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");
    const dtdEngine = await DTDEngineFactory.deploy() as DTDEngine;
    await dtdEngine.deployed();
    return dtdEngine;
}

export async function createMockToken(): Promise<MockToken> {
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    const mockTokenContract = await MockTokenFactory.deploy() as MockToken;
    await mockTokenContract.deployed();
    return mockTokenContract;
}

export async function createMockOracle(): Promise<MockOracle> {
    const mockOracle = await (await ethers.getContractFactory("MockOracle")).deploy() as MockOracle;
    await mockOracle.deployed();
    return mockOracle;
}

export async function createSpotFix(): Promise<SpotFix> {
    const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy() as SpotFix;
    await spotFix.deployed();
    return spotFix;
}

export async function createNoFix(): Promise<NoFix> {
    const noFix = await (await ethers.getContractFactory("NoFix")).deploy() as SpotFix;
    await noFix.deployed();
    return noFix;
}

export async function createIndexContract(): Promise<IndexTracker> {
    const index = await (await ethers.getContractFactory("IndexTracker")).deploy() as IndexTracker;
    await index.deployed();
    return index;
}

export async function createRelativeSpotIndexCalculator(indexContractAddress: string): Promise<RelativeSpotIndexCalculator> {
    const relativeIndex = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(indexContractAddress) as RelativeSpotIndexCalculator;
    await relativeIndex.deployed();
    return relativeIndex;
}

export async function createAbsoluteSpotIndexCalculator(indexContractAddress: string): Promise<AbsoluteSpotIndexCalculator> {
    const absoluteIndex = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(indexContractAddress) as RelativeSpotIndexCalculator;
    await absoluteIndex.deployed();
    return absoluteIndex;
}

export async function createFlatCollateralCalculator(): Promise<FlatCollateralCalculator> {
    const flatCollCalc = await (await ethers.getContractFactory("FlatCollateralCalculator")).deploy() as FlatCollateralCalculator;
    await flatCollCalc.deployed();
    return flatCollCalc;
}

export async function createNDSContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableSwap> {
    const nds = await (await ethers.getContractFactory("NonDeliverableSwap")).deploy(indexContractAddress, dtdContractAddress) as NonDeliverableSwap;
    await nds.deployed();
    return nds;
}

export async function createNDOContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableOption> {
    const ndo = await (await ethers.getContractFactory("NonDeliverableOption")).deploy(indexContractAddress, dtdContractAddress) as NonDeliverableOption;
    await ndo.deployed();
    return ndo;
}

export async function createNDACDEContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableAccuDecu> {
    const ndacde = await (await ethers.getContractFactory("NonDeliverableAccuDecu")).deploy(indexContractAddress, dtdContractAddress) as NonDeliverableAccuDecu;
    await ndacde.deployed();
    return ndacde;
}