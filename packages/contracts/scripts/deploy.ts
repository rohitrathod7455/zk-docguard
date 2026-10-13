import { ethers, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

export interface DeploymentRecord {
  network: string;
  chainId: number;
  deployedAt: string;
  admin: string;
  contracts: {
    IssuerRegistry: {
      address: string;
      args: [string];
    };
    DocumentRegistry: {
      address: string;
      args: [string, string];
    };
    RevocationRegistry: {
      address: string;
      args: [string, string];
    };
  };
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer signer found.');
  }

  const networkName = network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`=======================================================`);
  console.log(`Deploying ZK-DocGuard contracts to: ${networkName} (chainId: ${chainId})`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(
    `Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH/POL`,
  );
  console.log(`=======================================================`);

  // 1. Deploy IssuerRegistry
  console.log('\n[1/3] Deploying IssuerRegistry...');
  const IssuerRegistryFactory = await ethers.getContractFactory('IssuerRegistry');
  const issuerRegistry = await IssuerRegistryFactory.deploy(deployer.address);
  await issuerRegistry.waitForDeployment();
  const issuerRegistryAddress = await issuerRegistry.getAddress();
  console.log(`✔ IssuerRegistry deployed to: ${issuerRegistryAddress}`);

  // 2. Deploy DocumentRegistry
  console.log('\n[2/3] Deploying DocumentRegistry...');
  const DocumentRegistryFactory = await ethers.getContractFactory('DocumentRegistry');
  const documentRegistry = await DocumentRegistryFactory.deploy(
    deployer.address,
    issuerRegistryAddress,
  );
  await documentRegistry.waitForDeployment();
  const documentRegistryAddress = await documentRegistry.getAddress();
  console.log(`✔ DocumentRegistry deployed to: ${documentRegistryAddress}`);

  // 3. Deploy RevocationRegistry
  console.log('\n[3/6] Deploying RevocationRegistry...');
  const RevocationRegistryFactory = await ethers.getContractFactory('RevocationRegistry');
  const revocationRegistry = await RevocationRegistryFactory.deploy(
    deployer.address,
    issuerRegistryAddress,
  );
  await revocationRegistry.waitForDeployment();
  const revocationRegistryAddress = await revocationRegistry.getAddress();
  console.log(`✔ RevocationRegistry deployed to: ${revocationRegistryAddress}`);

  // 4. Deploy Groth16Verifier (Mode A)
  console.log('\n[4/6] Deploying Groth16Verifier (Mode A)...');
  const VerifierAFactory = await ethers.getContractFactory('Groth16Verifier');
  const verifierModeA = await VerifierAFactory.deploy();
  await verifierModeA.waitForDeployment();
  const verifierModeAAddress = await verifierModeA.getAddress();
  console.log(`✔ Groth16Verifier (Mode A) deployed to: ${verifierModeAAddress}`);

  // 5. Deploy Groth16VerifierModeB (Mode B)
  console.log('\n[5/6] Deploying Groth16VerifierModeB (Mode B)...');
  const VerifierBFactory = await ethers.getContractFactory('Groth16VerifierModeB');
  const verifierModeB = await VerifierBFactory.deploy();
  await verifierModeB.waitForDeployment();
  const verifierModeBAddress = await verifierModeB.getAddress();
  console.log(`✔ Groth16VerifierModeB (Mode B) deployed to: ${verifierModeBAddress}`);

  // 6. Deploy VerifierGateway
  console.log('\n[6/6] Deploying VerifierGateway...');
  const GatewayFactory = await ethers.getContractFactory('VerifierGateway');
  const gateway = await GatewayFactory.deploy(
    deployer.address,
    issuerRegistryAddress,
    revocationRegistryAddress,
    verifierModeAAddress,
    verifierModeBAddress,
  );
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log(`✔ VerifierGateway deployed to: ${gatewayAddress}`);

  // Save deployment records
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const record = {
    network: networkName,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    admin: deployer.address,
    contracts: {
      IssuerRegistry: {
        address: issuerRegistryAddress,
        args: [deployer.address],
      },
      DocumentRegistry: {
        address: documentRegistryAddress,
        args: [deployer.address, issuerRegistryAddress],
      },
      RevocationRegistry: {
        address: revocationRegistryAddress,
        args: [deployer.address, issuerRegistryAddress],
      },
      Groth16Verifier: {
        address: verifierModeAAddress,
        args: [],
      },
      Groth16VerifierModeB: {
        address: verifierModeBAddress,
        args: [],
      },
      VerifierGateway: {
        address: gatewayAddress,
        args: [
          deployer.address,
          issuerRegistryAddress,
          revocationRegistryAddress,
          verifierModeAAddress,
          verifierModeBAddress,
        ],
      },
    },
  };

  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(record, null, 2));
  console.log(`\n✔ Deployment addresses saved to: ${deploymentPath}`);

  // Also export addresses to packages/core/src/contracts/addresses.json
  const coreContractsDir = path.join(__dirname, '..', '..', 'core', 'src', 'contracts');
  if (!fs.existsSync(coreContractsDir)) {
    fs.mkdirSync(coreContractsDir, { recursive: true });
  }
  const coreAddressesPath = path.join(coreContractsDir, 'addresses.json');
  let allAddresses: Record<string, unknown> = {};
  if (fs.existsSync(coreAddressesPath)) {
    try {
      allAddresses = JSON.parse(fs.readFileSync(coreAddressesPath, 'utf8'));
    } catch {
      allAddresses = {};
    }
  }
  allAddresses[networkName] = record;
  fs.writeFileSync(coreAddressesPath, JSON.stringify(allAddresses, null, 2));
  console.log(`✔ Exported network addresses to @zk-docguard/core: ${coreAddressesPath}`);

  console.log('\nDeployment successfully completed!');
}

main().catch((error) => {
  console.error('\nDeployment failed:', error);
  process.exit(1);
});
