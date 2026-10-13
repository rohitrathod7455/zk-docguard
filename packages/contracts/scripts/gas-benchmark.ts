import { ethers } from 'hardhat';
import * as path from 'node:path';
import * as fs from 'node:fs';

async function main() {
  console.log('[Gas Benchmarks] Starting on-chain gas consumption measurements...');

  const fixturePathModeA = path.resolve(__dirname, '../test/fixtures/groth16-proof-fixture.json');
  const fixturePathModeB = path.resolve(__dirname, '../test/fixtures/groth16-proof-fixture-mode-b.json');
  const fixtureA = JSON.parse(fs.readFileSync(fixturePathModeA, 'utf8'));
  const fixtureB = JSON.parse(fs.readFileSync(fixturePathModeB, 'utf8'));

  const [admin, issuer, verifierUser] = await ethers.getSigners();
  const baseTargetTime = Number(fixtureA.pubSignals[24]);

  await ethers.provider.send('evm_setNextBlockTimestamp', [baseTargetTime]);
  await ethers.provider.send('evm_mine', []);

  // 1. Deployments
  const gasDeployments: Record<string, number> = {};

  const IssuerRegistryFactory = await ethers.getContractFactory('IssuerRegistry');
  const issuerRegistry = await IssuerRegistryFactory.deploy(admin.address);
  const txIR = await issuerRegistry.deploymentTransaction();
  const receiptIR = await txIR?.wait();
  gasDeployments['IssuerRegistry'] = Number(receiptIR?.gasUsed ?? 0);

  const DocumentRegistryFactory = await ethers.getContractFactory('DocumentRegistry');
  const documentRegistry = await DocumentRegistryFactory.deploy(admin.address, await issuerRegistry.getAddress());
  const txDR = await documentRegistry.deploymentTransaction();
  const receiptDR = await txDR?.wait();
  gasDeployments['DocumentRegistry'] = Number(receiptDR?.gasUsed ?? 0);

  const RevocationRegistryFactory = await ethers.getContractFactory('RevocationRegistry');
  const revocationRegistry = await RevocationRegistryFactory.deploy(admin.address, await issuerRegistry.getAddress());
  const txRR = await revocationRegistry.deploymentTransaction();
  const receiptRR = await txRR?.wait();
  gasDeployments['RevocationRegistry'] = Number(receiptRR?.gasUsed ?? 0);

  const VerifierAFactory = await ethers.getContractFactory('Groth16Verifier');
  const verifierModeA = await VerifierAFactory.deploy();
  const txVA = await verifierModeA.deploymentTransaction();
  const receiptVA = await txVA?.wait();
  gasDeployments['Groth16Verifier'] = Number(receiptVA?.gasUsed ?? 0);

  const VerifierBFactory = await ethers.getContractFactory('Groth16VerifierModeB');
  const verifierModeB = await VerifierBFactory.deploy();
  const txVB = await verifierModeB.deploymentTransaction();
  const receiptVB = await txVB?.wait();
  gasDeployments['Groth16VerifierModeB'] = Number(receiptVB?.gasUsed ?? 0);

  const GatewayFactory = await ethers.getContractFactory('VerifierGateway');
  const gateway = await GatewayFactory.deploy(
    admin.address,
    await issuerRegistry.getAddress(),
    await revocationRegistry.getAddress(),
    await verifierModeA.getAddress(),
    await verifierModeB.getAddress(),
  );
  const txGW = await gateway.deploymentTransaction();
  const receiptGW = await txGW?.wait();
  gasDeployments['VerifierGateway'] = Number(receiptGW?.gasUsed ?? 0);

  // 2. Issuer Operations
  const gasOperations: Record<string, number> = {};

  const zkKeyHashA = ethers.toBeHex(BigInt(fixtureA.pubSignals[1]), 32);

  const txApply = await issuerRegistry.connect(issuer).applyAsIssuer(
    'did:ethr:' + issuer.address,
    zkKeyHashA,
    'ipfs://QmIssuerProfileMetadata',
  );
  const recApply = await txApply.wait();
  gasOperations['IssuerRegistry.applyAsIssuer'] = Number(recApply?.gasUsed ?? 0);

  const txApprove = await issuerRegistry.connect(admin).approveIssuer(issuer.address);
  const recApprove = await txApprove.wait();
  gasOperations['IssuerRegistry.approveIssuer'] = Number(recApprove?.gasUsed ?? 0);

  // Key rotation
  const rotatedKeyHash = ethers.keccak256(ethers.toUtf8Bytes('ROTATED-KEY-EPOCH-2'));
  const txRot = await issuerRegistry.connect(issuer).rotateKey(rotatedKeyHash);
  const recRot = await txRot.wait();
  gasOperations['IssuerRegistry.rotateKey'] = Number(recRot?.gasUsed ?? 0);

  // 3. Document Registration (Single vs Merkle Batch)
  const sampleDocHash = ethers.keccak256(ethers.toUtf8Bytes('CONTENT-SINGLE-001'));
  const sampleCredId = ethers.toBeHex(BigInt(fixtureA.pubSignals[0]), 32);
  const sampleSchemaId = ethers.keccak256(ethers.toUtf8Bytes('DEGREE-SCHEMA-V1'));
  const sampleCid = 'QmSampleDocumentCidHash0000000000000000001';

  const txRegister = await documentRegistry.connect(issuer).registerDocument(
    sampleDocHash,
    sampleCredId,
    sampleSchemaId,
    sampleCid,
    0, // no expiry
  );
  const recRegister = await txRegister.wait();
  gasOperations['DocumentRegistry.registerDocument (single)'] = Number(recRegister?.gasUsed ?? 0);

  // Batch 10
  const root10 = ethers.keccak256(ethers.toUtf8Bytes('BATCH-ROOT-10'));
  const txBatch10 = await documentRegistry.connect(issuer).registerBatch(root10, 10, 'QmBatchManifest10');
  const recBatch10 = await txBatch10.wait();
  gasOperations['DocumentRegistry.registerBatch (10 docs)'] = Number(recBatch10?.gasUsed ?? 0);

  // Batch 50
  const root50 = ethers.keccak256(ethers.toUtf8Bytes('BATCH-ROOT-50'));
  const txBatch50 = await documentRegistry.connect(issuer).registerBatch(root50, 50, 'QmBatchManifest50');
  const recBatch50 = await txBatch50.wait();
  gasOperations['DocumentRegistry.registerBatch (50 docs)'] = Number(recBatch50?.gasUsed ?? 0);

  // Batch 100
  const root100 = ethers.keccak256(ethers.toUtf8Bytes('BATCH-ROOT-100'));
  const txBatch100 = await documentRegistry.connect(issuer).registerBatch(root100, 100, 'QmBatchManifest100');
  const recBatch100 = await txBatch100.wait();
  gasOperations['DocumentRegistry.registerBatch (100 docs)'] = Number(recBatch100?.gasUsed ?? 0);

  // 4. Revocation Operations
  const sampleRevokeCredId = ethers.keccak256(ethers.toUtf8Bytes('CRED-REVOKED-001'));
  const txRev = await revocationRegistry.connect(issuer).revokeCredential(sampleRevokeCredId);
  const recRev = await txRev.wait();
  gasOperations['RevocationRegistry.revokeCredential (Mode A)'] = Number(recRev?.gasUsed ?? 0);

  const sampleSmtRoot = ethers.keccak256(ethers.toUtf8Bytes('SMT-ROOT-001'));
  const txSmt = await revocationRegistry.connect(issuer).updateRevocationRoot(zkKeyHashA, sampleSmtRoot);
  const recSmt = await txSmt.wait();
  gasOperations['RevocationRegistry.updateRevocationRoot (Mode B)'] = Number(recSmt?.gasUsed ?? 0);

  // 5. Direct Verifiers
  const gasDirectVerifyA = await verifierModeA.verifyProof.estimateGas(fixtureA.a, fixtureA.b, fixtureA.c, fixtureA.pubSignals);
  gasOperations['Groth16Verifier.verifyProof (Mode A standalone)'] = Number(gasDirectVerifyA);

  const gasDirectVerifyB = await verifierModeB.verifyProof.estimateGas(fixtureB.a, fixtureB.b, fixtureB.c, fixtureB.pubSignals);
  gasOperations['Groth16VerifierModeB.verifyProof (Mode B standalone)'] = Number(gasDirectVerifyB);

  // 6. Gateway Verification & consumeAndVerify
  // Anchor Mode B root in RevocationRegistry
  const rootBHex = ethers.toBeHex(BigInt(fixtureB.pubSignals[25]), 32);
  await (await revocationRegistry.connect(issuer).updateRevocationRoot(zkKeyHashA, rootBHex)).wait();

  // Mode A consumeAndVerify
  const nonceA = ethers.encodeBytes32String('NONCE-BENCHMARK-MODE-A-01');
  const txConsumeA = await gateway.connect(verifierUser).consumeAndVerify(
    fixtureA.a,
    fixtureA.b,
    fixtureA.c,
    fixtureA.pubSignals,
    0, // Mode A
    nonceA,
  );
  const recConsumeA = await txConsumeA.wait();
  gasOperations['VerifierGateway.consumeAndVerify (Mode A)'] = Number(recConsumeA?.gasUsed ?? 0);

  // Mode B consumeAndVerify
  const nonceB = ethers.encodeBytes32String('NONCE-BENCHMARK-MODE-B-01');
  const txConsumeB = await gateway.connect(verifierUser).consumeAndVerify(
    fixtureB.a,
    fixtureB.b,
    fixtureB.c,
    fixtureB.pubSignals,
    1, // Mode B
    nonceB,
  );
  const recConsumeB = await txConsumeB.wait();
  gasOperations['VerifierGateway.consumeAndVerify (Mode B)'] = Number(recConsumeB?.gasUsed ?? 0);

  // Summary Report
  const gasReport = {
    timestamp: new Date().toISOString(),
    evmVersion: 'paris',
    network: 'Hardhat Local / EVM Compatible (Polygon Amoy / Ethereum)',
    deployments: gasDeployments,
    operations: gasOperations,
    batchAmortization: {
      singleDocumentRegistrationGas: gasOperations['DocumentRegistry.registerDocument (single)'],
      batch10: { totalGas: gasOperations['DocumentRegistry.registerBatch (10 docs)'], gasPerDoc: Math.round(gasOperations['DocumentRegistry.registerBatch (10 docs)'] / 10) },
      batch50: { totalGas: gasOperations['DocumentRegistry.registerBatch (50 docs)'], gasPerDoc: Math.round(gasOperations['DocumentRegistry.registerBatch (50 docs)'] / 50) },
      batch100: { totalGas: gasOperations['DocumentRegistry.registerBatch (100 docs)'], gasPerDoc: Math.round(gasOperations['DocumentRegistry.registerBatch (100 docs)'] / 100) },
      amortizationSavingsPercentage100vsSingle: Math.round((1 - (gasOperations['DocumentRegistry.registerBatch (100 docs)'] / 100) / gasOperations['DocumentRegistry.registerDocument (single)']) * 1000) / 10,
    },
  };

  const resultsDir = path.resolve(__dirname, '../../../benchmarks/results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const outPath = path.resolve(resultsDir, 'gas-benchmarks.json');
  fs.writeFileSync(outPath, JSON.stringify(gasReport, null, 2), 'utf8');
  console.log(`[Gas Benchmarks] Complete. Written to ${outPath}`);
  console.log(JSON.stringify(gasReport, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
