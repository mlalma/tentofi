import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  paths: {
    sources: "./v1",
  },
  typechain: {
    outDir: "./typechain-types",
  },
  solidity: {
    version: "0.8.34",
    npmFilesToBuild: [
      "tento-dtd/v1/contracts/DTDEngine.sol",
      "tento-index/v1/contracts/Index.sol",
      "tento-index/v1/contracts/IndexCalculator.sol",
      "tento-index/v1/contracts/IndexFix.sol",
      "tento-otccontractbase/v1/contracts/CollateralCalculators.sol",
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      allowUnlimitedContractSize: true,
    },
    polygon_amoy: {
      type: "http",
      url: configVariable("API_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});
