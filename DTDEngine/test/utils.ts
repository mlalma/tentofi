import { ethers } from "hardhat";
import { DTDEngine, EmptyMockContract, MockToken } from "../typechain-types";

export async function createDTDEngine(): Promise<[DTDEngine, string]> {
    const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");
    const dtdEngine = await DTDEngineFactory.deploy() as DTDEngine;
    await dtdEngine.waitForDeployment();
    let address = await dtdEngine.getAddress();
    return [dtdEngine, address];
}

export async function createEmptyMockContract(): Promise<[EmptyMockContract, string]> {
    const EmptyMockContractFactory = await ethers.getContractFactory("EmptyMockContract");
    const emptyMockContract = await EmptyMockContractFactory.deploy() as EmptyMockContract;
    await emptyMockContract.waitForDeployment();
    let address = await emptyMockContract.getAddress();
    return [emptyMockContract, address];
}

export async function createMockToken(): Promise<[MockToken, string]> {
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    const mockTokenContract = await MockTokenFactory.deploy() as MockToken;
    await mockTokenContract.waitForDeployment();
    let address = await mockTokenContract.getAddress();
    return [mockTokenContract, address];
}