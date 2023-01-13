import { ethers } from "hardhat";

// Deployment script can be executed using following command on root
// > npx hardhat run ./scripts/deploy.ts --network [network defined in hardhat.config.ts]
//
// Example:
// > npx hardhat run ./scripts/deploy.ts --network polygon_mumbai

async function main() {
  const flatCollateralCalc = await (await ethers.getContractFactory("FlatCollateralCalculator")).deploy();
  console.log(`FlatCollateralCalc deployed to address: ${flatCollateralCalc.address}`);

  const linearCollateralCalc = await (await ethers.getContractFactory("LinearCollateralCalculator")).deploy();
  console.log(`LinearCollateralCalc deployed to address: ${linearCollateralCalc.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });