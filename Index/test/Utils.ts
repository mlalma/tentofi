import { ethers } from "hardhat";
import { AbsoluteSpotIndexCalculator, IndexTracker, MockOracle, NoFix, RelativeSpotIndexCalculator, SpotFix, SpotFixMul, SpotFixMulPlus, SpotFixPlus } from "../typechain-types";

export const WEIGHT_MULTIPLIER = 10000;
export const SPOT_DECIMAL_COUNT = 10;
export const SPOT_MULTIPLIER = 10 ** SPOT_DECIMAL_COUNT;

export async function createNoFix(): Promise<NoFix> {
    const noFix = await (await ethers.getContractFactory("NoFix")).deploy() as NoFix;
    await noFix.deployed();
    return noFix;
}

export async function createSpotFix(): Promise<SpotFix> {
    const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy() as SpotFix;
    await spotFix.deployed();
    return spotFix;
}

export async function createSpotFixPlus(): Promise<SpotFixPlus> {
    const spotFixPlus = await (await ethers.getContractFactory("SpotFixPlus")).deploy() as SpotFixPlus;
    await spotFixPlus.deployed();
    return spotFixPlus;
}

export async function createSpotFixMul(): Promise<SpotFixMul> {
    const spotFixMul = await (await ethers.getContractFactory("SpotFixMul")).deploy() as SpotFixMul;
    await spotFixMul.deployed();
    return spotFixMul;
}

export async function createSpotFixMulPlus(): Promise<SpotFixMulPlus> {
    const spotFixMulPlus = await (await ethers.getContractFactory("SpotFixMulPlus")).deploy() as SpotFixMulPlus;
    await spotFixMulPlus.deployed();
    return spotFixMulPlus;
}

export async function createIndexContract(): Promise<IndexTracker> {
    const index = await (await ethers.getContractFactory("IndexTracker")).deploy() as IndexTracker;
    await index.deployed();
    return index;
}

export async function createAbsoluteSpotIndexCalculator(index: string): Promise<AbsoluteSpotIndexCalculator> {
    const calculator = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(index) as AbsoluteSpotIndexCalculator;
    await calculator.deployed();
    return calculator;
}

export async function createRelativeSpotIndexCalculator(index: string): Promise<RelativeSpotIndexCalculator> {
    const calculator = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(index) as RelativeSpotIndexCalculator;
    await calculator.deployed();
    return calculator;
}

export async function createMockOracle(): Promise<MockOracle> {
    const mockOracle = await (await ethers.getContractFactory("MockOracle")).deploy() as MockOracle;
    await mockOracle.deployed();
    return mockOracle;
}