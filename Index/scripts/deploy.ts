import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network name defined in hardhat.config.ts]
//
// Example (currently only polygon testnet is available):
// > npx hardhat run ./scripts/deploy.ts --network polygon_amoy

async function main() {
  const index = await (await ethers.getContractFactory("Index")).deploy();
  await index.waitForDeployment();
  const indexAddress = await index.getAddress();
  console.log(`Index deployed to address: ${indexAddress}`);

  const noFix = await (await ethers.getContractFactory("NoFix")).deploy();
  await noFix.waitForDeployment();
  console.log(`NoFix deployed to address: ${await noFix.getAddress()}`);

  const spotFix = await (await ethers.getContractFactory("SpotFix")).deploy();
  await spotFix.waitForDeployment();
  console.log(`SpotFix deployed to address: ${await spotFix.getAddress()}`);

  const spotFixPlus = await (await ethers.getContractFactory("SpotFixPlus")).deploy();
  await spotFixPlus.waitForDeployment();
  console.log(`SpotFixPlus deployed to address: ${await spotFixPlus.getAddress()}`);

  const spotFixMul = await (await ethers.getContractFactory("SpotFixMul")).deploy();
  await spotFixMul.waitForDeployment();
  console.log(`SpotFixMul deployed to address: ${await spotFixMul.getAddress()}`);

  const spotFixMulPlus = await (await ethers.getContractFactory("SpotFixMulPlus")).deploy();
  await spotFixMulPlus.waitForDeployment();
  console.log(`SpotFixMulPlus deployed to address: ${await spotFixMulPlus.getAddress()}`);

  const absoluteSpotCalculator = await (await ethers.getContractFactory("AbsoluteSpotIndexCalculator")).deploy(indexAddress);
  await absoluteSpotCalculator.waitForDeployment();
  console.log(`AbsoluteSpotIndexCalculator deployed to address: ${await absoluteSpotCalculator.getAddress()}`);

  const relativeSpotIndexCalculator = await (await ethers.getContractFactory("RelativeSpotIndexCalculator")).deploy(indexAddress);
  await relativeSpotIndexCalculator.waitForDeployment();
  console.log(`RelativeSpotIndexCalculator deployed to address: ${await relativeSpotIndexCalculator.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
