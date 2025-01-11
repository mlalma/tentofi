import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";

require('dotenv').config();

const { API_URL, PRIVATE_KEY } = process.env;

module.exports = {
  paths: {
    sources: "./v1"
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      },
      evmVersion: "cancun"
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      hardfork: "cancun"
    },
    polygon_amoy: {
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  }
}