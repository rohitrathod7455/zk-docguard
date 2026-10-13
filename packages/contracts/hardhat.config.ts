import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';
const POLYGON_AMOY_RPC = process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org';
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: 'paris',
      viaIR: false,
    },
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    ...(DEPLOYER_PRIVATE_KEY
      ? {
          amoy: {
            url: POLYGON_AMOY_RPC,
            chainId: 80002,
            accounts: [DEPLOYER_PRIVATE_KEY],
          },
          sepolia: {
            url: SEPOLIA_RPC,
            chainId: 11155111,
            accounts: [DEPLOYER_PRIVATE_KEY],
          },
        }
      : {}),
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: 'polygonAmoy',
        chainId: 80002,
        urls: {
          apiURL: 'https://api-amoy.polygonscan.com/api',
          browserURL: 'https://amoy.polygonscan.com',
        },
      },
    ],
  },
};

export default config;
