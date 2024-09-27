import { ethers } from "hardhat";
import { NordPoolDayAheadOracle } from "../typechain-types";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network name defined in hardhat.config.ts]
//
// Example (currently only polygon testnet is available):
// > npx hardhat run ./scripts/deploy.ts --network polygon_amoy

async function main() {
  // Deploy example contract that should track the day-ahead per-hour prices of FI area
  const nordPoolOracleFactory = await ethers.getContractFactory("NordPoolDayAheadOracle");
  const nordPoolOracle = await nordPoolOracleFactory.deploy("NordPoolFI") as NordPoolDayAheadOracle;
  await nordPoolOracle.waitForDeployment();
  let nordPoolOracleAddress = await nordPoolOracle.getAddress();
  console.log(`DTDEngine deployed to address: ${nordPoolOracleAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });