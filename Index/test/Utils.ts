import hre from "hardhat";
import type {
    AbsoluteSpotIndexCalculator,
    IndexTracker,
    MockOracle,
    NoFix,
    RelativeSpotIndexCalculator,
    SpotFix,
    SpotFixMul,
    SpotFixMulPlus,
    SpotFixPlus,
} from "../typechain-types/index.js";

const { ethers, networkHelpers } = await hre.network.connect();

export { ethers };
export const time = networkHelpers.time;

export const WEIGHT_MULTIPLIER = 10000;
export const SPOT_DECIMAL_COUNT = 10;
export const SPOT_MULTIPLIER = 10 ** SPOT_DECIMAL_COUNT;
export const VALUE_MULTIPLIER = 10 ** 6;

export async function createNoFix(): Promise<NoFix> {
    const noFix = await (await ethers.getContractFactory("NoFix")).deploy() as unknown as NoFix;
    await noFix.waitForDeployment();
    return noFix;
}

export async function createSpotFix(): Promise<SpotFix> {
    const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy() as unknown as SpotFix;
    await spotFix.waitForDeployment();
    return spotFix;
}

export async function createSpotFixPlus(): Promise<SpotFixPlus> {
    const spotFixPlus = await (await ethers.getContractFactory("SpotFixPlus")).deploy() as unknown as SpotFixPlus;
    await spotFixPlus.waitForDeployment();
    return spotFixPlus;
}

export async function createSpotFixMul(): Promise<SpotFixMul> {
    const spotFixMul = await (await ethers.getContractFactory("SpotFixMul")).deploy() as unknown as SpotFixMul;
    await spotFixMul.waitForDeployment();
    return spotFixMul;
}

export async function createSpotFixMulPlus(): Promise<SpotFixMulPlus> {
    const spotFixMulPlus = await (await ethers.getContractFactory("SpotFixMulPlus")).deploy() as unknown as SpotFixMulPlus;
    await spotFixMulPlus.waitForDeployment();
    return spotFixMulPlus;
}

export async function createIndexContract(): Promise<IndexTracker> {
    const index = await (await ethers.getContractFactory("IndexTracker")).deploy() as unknown as IndexTracker;
    await index.waitForDeployment();
    return index;
}

export async function createAbsoluteSpotIndexCalculator(indexAddress: string): Promise<AbsoluteSpotIndexCalculator> {
    const calculator = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(indexAddress) as unknown as AbsoluteSpotIndexCalculator;
    await calculator.waitForDeployment();
    return calculator;
}

export async function createRelativeSpotIndexCalculator(indexAddress: string): Promise<RelativeSpotIndexCalculator> {
    const calculator = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(indexAddress) as unknown as RelativeSpotIndexCalculator;
    await calculator.waitForDeployment();
    return calculator;
}

export async function createMockOracle(): Promise<MockOracle> {
    const mockOracle = await (await ethers.getContractFactory("MockOracle")).deploy() as unknown as MockOracle;
    await mockOracle.waitForDeployment();
    return mockOracle;
}
