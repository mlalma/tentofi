import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network name defined in hardhat.config.ts]
//
// Example (currently only polygon testnet is available):
// > npx hardhat run ./scripts/deploy.ts --network polygon_mumbai

async function main() {
  const index = await (await ethers.getContractFactory("Index")).deploy();
  console.log(`Index deployed to address: ${index.address}`);

  const noFix = await (await ethers.getContractFactory("NoFix")).deploy();
  console.log(`NoFix deployed to address: ${noFix.address}`);

  const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy();
  console.log(`SpotFix deployed to address: ${spotFix.address}`);

  const spotFixPlus = await (await ethers.getContractFactory("SpotFixPlus")).deploy();
  console.log(`SpotFixPlus deployed to address: ${spotFixPlus.address}`);

  const spotFixMul = await (await ethers.getContractFactory("SpotFixMul")).deploy();
  console.log(`SpotFixMul deployed to address: ${spotFixMul.address}`);

  const spotFixMulPlus = await (await ethers.getContractFactory("SpotFixMulPlus")).deploy();
  console.log(`SpotFixMulPlus deployed to address: ${spotFixMulPlus.address}`);

  const absoluteSpotCalculator = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(index.address);
  console.log(`SpotFixMulPlus deployed to address: ${absoluteSpotCalculator.address}`);

  const relativeSpotIndexCalculator = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(index.address);
  console.log(`SpotFixMulPlus deployed to address: ${relativeSpotIndexCalculator.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });