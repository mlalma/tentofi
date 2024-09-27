import { ethers } from "hardhat";
import { DTDEngine } from "../typechain-types";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network name defined in hardhat.config.ts]
//
// Example (currently only polygon testnet is available):
// > npx hardhat run ./scripts/deploy.ts --network polygon_amoy

async function main() {
  const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");    
  const DTDEngine = await DTDEngineFactory.deploy() as DTDEngine;
  await DTDEngine.waitForDeployment();
  let DTDEngineAddress = await DTDEngine.getAddress();
  console.log(`DTDEngine deployed to address: ${DTDEngineAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

