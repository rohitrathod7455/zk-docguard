import { run, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to verify deployed contracts on Etherscan or Polygonscan
 */
async function main() {
  const networkName = network.name;
  const deploymentPath = path.join(__dirname, '..', 'deployments', `${networkName}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment file found for network: ${networkName} at ${deploymentPath}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  console.log(`Verifying contracts on ${networkName}...`);

  for (const [name, info] of Object.entries(deployment.contracts) as [
    string,
    { address: string; args: unknown[] },
  ][]) {
    console.log(`\nVerifying ${name} at ${info.address}...`);
    try {
      await run('verify:verify', {
        address: info.address,
        constructorArguments: info.args,
      });
      console.log(`✔ Verified ${name}`);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message.includes('Already Verified')) {
        console.log(`ℹ ${name} is already verified.`);
      } else {
        console.error(`✘ Verification failed for ${name}:`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
