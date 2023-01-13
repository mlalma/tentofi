import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network defined in hardhat.config.ts]
//
// Example:
// > npx hardhat run ./scripts/deploy.ts --network polygon_mumbai

async function main() {
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });