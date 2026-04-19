import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network defined in hardhat.config.ts]
//
// Example:
// > npx hardhat run ./scripts/deploy.ts --network polygon_amoy

async function main() {
  const flatCollateralCalc = await (await ethers.getContractFactory("FlatCollateralCalculator")).deploy();
  await flatCollateralCalc.waitForDeployment();
  console.log(`FlatCollateralCalc deployed to address: ${await flatCollateralCalc.getAddress()}`);

  const linearCollateralCalc = await (await ethers.getContractFactory("LinearCollateralCalculator")).deploy();
  await linearCollateralCalc.waitForDeployment();
  console.log(`LinearCollateralCalc deployed to address: ${await linearCollateralCalc.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
