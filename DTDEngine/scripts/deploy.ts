import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network name defined in hardhat.config.ts]
//
// Example (currently only polygon testnet is available):
// > npx hardhat run ./scripts/deploy.ts --network polygon_mumbai

async function main() {
  const DTDEngineFactory = await ethers.getContractFactory("DTDEngine");
  const DTDEngine = await DTDEngineFactory.deploy();
  console.log(`DTDEngine deployed to address: ${DTDEngine.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

