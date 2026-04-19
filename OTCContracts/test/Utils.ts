import hre from "hardhat";
import type {
    DTDEngine,
    MockToken,
    IndexTracker,
    RelativeSpotIndexCalculator,
    NoFix,
    FlatCollateralCalculator,
    NonDeliverableSwap,
    NonDeliverableOption,
    MockOracle,
    SpotFix,
    AbsoluteSpotIndexCalculator,
    NonDeliverableAccuDecu,
} from "../typechain-types/index.js";

const { ethers, networkHelpers } = await hre.network.connect();

export { ethers };
export const time = networkHelpers.time;

export async function createDTDEngine(): Promise<DTDEngine> {
    const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");
    const dtdEngine = await DTDEngineFactory.deploy() as unknown as DTDEngine;
    await dtdEngine.waitForDeployment();
    return dtdEngine;
}

export async function createMockToken(): Promise<MockToken> {
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    const mockTokenContract = await MockTokenFactory.deploy() as unknown as MockToken;
    await mockTokenContract.waitForDeployment();
    return mockTokenContract;
}

export async function createMockOracle(): Promise<MockOracle> {
    const mockOracle = await (await ethers.getContractFactory("MockOracle")).deploy() as unknown as MockOracle;
    await mockOracle.waitForDeployment();
    return mockOracle;
}

export async function createSpotFix(): Promise<SpotFix> {
    const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy() as unknown as SpotFix;
    await spotFix.waitForDeployment();
    return spotFix;
}

export async function createNoFix(): Promise<NoFix> {
    const noFix = await (await ethers.getContractFactory("NoFix")).deploy() as unknown as NoFix;
    await noFix.waitForDeployment();
    return noFix;
}

export async function createIndexContract(): Promise<IndexTracker> {
    const index = await (await ethers.getContractFactory("IndexTracker")).deploy() as unknown as IndexTracker;
    await index.waitForDeployment();
    return index;
}

export async function createRelativeSpotIndexCalculator(indexContractAddress: string): Promise<RelativeSpotIndexCalculator> {
    const relativeIndex = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(indexContractAddress) as unknown as RelativeSpotIndexCalculator;
    await relativeIndex.waitForDeployment();
    return relativeIndex;
}

export async function createAbsoluteSpotIndexCalculator(indexContractAddress: string): Promise<AbsoluteSpotIndexCalculator> {
    const absoluteIndex = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(indexContractAddress) as unknown as AbsoluteSpotIndexCalculator;
    await absoluteIndex.waitForDeployment();
    return absoluteIndex;
}

export async function createFlatCollateralCalculator(): Promise<FlatCollateralCalculator> {
    const flatCollCalc = await (await ethers.getContractFactory("FlatCollateralCalculator")).deploy() as unknown as FlatCollateralCalculator;
    await flatCollCalc.waitForDeployment();
    return flatCollCalc;
}

export async function createNDSContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableSwap> {
    const nds = await (await ethers.getContractFactory("NonDeliverableSwap")).deploy(indexContractAddress, dtdContractAddress) as unknown as NonDeliverableSwap;
    await nds.waitForDeployment();
    return nds;
}

export async function createNDOContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableOption> {
    const ndo = await (await ethers.getContractFactory("NonDeliverableOption")).deploy(indexContractAddress, dtdContractAddress) as unknown as NonDeliverableOption;
    await ndo.waitForDeployment();
    return ndo;
}

export async function createNDACDEContract(indexContractAddress: string, dtdContractAddress: string): Promise<NonDeliverableAccuDecu> {
    const ndacde = await (await ethers.getContractFactory("NonDeliverableAccuDecu")).deploy(indexContractAddress, dtdContractAddress) as unknown as NonDeliverableAccuDecu;
    await ndacde.waitForDeployment();
    return ndacde;
}
