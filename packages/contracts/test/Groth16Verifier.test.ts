import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('Groth16Verifier On-Chain Verification', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/groth16-proof-fixture.json');

  it('verifies a real Groth16 selective disclosure proof on-chain', async () => {
    expect(fs.existsSync(fixturePath)).to.be.true;

    // 1. Deploy the generated Groth16Verifier contract
    const VerifierFactory = await ethers.getContractFactory('Groth16Verifier');
    const verifier = await VerifierFactory.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    expect(verifierAddress).to.properAddress;

    // 2. Load the real Groth16 proof fixture
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { a, b, c, pubSignals } = fixture;

    expect(a.length).to.equal(2);
    expect(b.length).to.equal(2);
    expect(c.length).to.equal(2);
    expect(pubSignals.length).to.equal(26);

    // 3. Execute on-chain verification
    const isValid = await verifier.verifyProof(a, b, c, pubSignals);
    expect(isValid).to.be.true;

    // 4. Measure and verify real gas consumption
    const gasEstimate = await verifier.verifyProof.estimateGas(a, b, c, pubSignals);
    console.warn(`\n  ⚡ Groth16 on-chain verification gas: ${gasEstimate.toString()} gas\n`);
    expect(gasEstimate).to.be.greaterThan(250000n);
    expect(gasEstimate).to.be.lessThan(450000n);

    // 5. Negative test: tampered public signal must return false
    const tamperedPubSignals = [...pubSignals];
    // Alter the first public signal (credentialId)
    tamperedPubSignals[0] =
      '0x' + (BigInt(tamperedPubSignals[0]) + 1n).toString(16).padStart(64, '0');
    const isTamperedValid = await verifier.verifyProof(a, b, c, tamperedPubSignals);
    expect(isTamperedValid).to.be.false;

    // 6. Negative test: tampered proof scalar must return false
    const tamperedA: [string, string] = [
      '0x' + (BigInt(a[0]) + 1n).toString(16).padStart(64, '0'),
      a[1],
    ];
    const isTamperedAValid = await verifier.verifyProof(tamperedA, b, c, pubSignals);
    expect(isTamperedAValid).to.be.false;
  });
});
