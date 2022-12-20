import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { DTDEngine, EmptyMockContract } from "../typechain-types";

export async function createDTDEngine(): Promise<DTDEngine> {
    const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");
    const dtdEngine = await DTDEngineFactory.deploy() as DTDEngine;
    await dtdEngine.deployed();
    return dtdEngine;
}

export async function createEmptyMockContract(): Promise<EmptyMockContract> {
    const EmptyMockContractFactory = await ethers.getContractFactory("EmptyMockContract");
    const emptyMockContract = await EmptyMockContractFactory.deploy() as EmptyMockContract;
    await emptyMockContract.deployed();
    return emptyMockContract;
}