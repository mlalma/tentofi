import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";

require('dotenv').config();

const { API_URL, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.27",
  paths: {
    sources: "./v1"
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000
    }
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    polygon_mumbai: {
      url: API_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    }
  }
}