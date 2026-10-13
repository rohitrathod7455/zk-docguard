import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('VerifierGateway On-Chain Verification & Replay Protection', () => {
  const fixturePathModeA = path.resolve(__dirname, 'fixtures/groth16-proof-fixture.json');
  const fixturePathModeB = path.resolve(__dirname, 'fixtures/groth16-proof-fixture-mode-b.json');

  let admin: any;
  let issuer: any;
  let verifierUser: any;

  let issuerRegistry: any;
  let revocationRegistry: any;
  let verifierModeA: any;
  let verifierModeB: any;
  let gateway: any;

  let fixtureA: any;
  let fixtureB: any;
  let baseTargetTime: number;

  before(async () => {
    [admin, issuer, verifierUser] = await ethers.getSigners();

    fixtureA = JSON.parse(fs.readFileSync(fixturePathModeA, 'utf8'));
    fixtureB = JSON.parse(fs.readFileSync(fixturePathModeB, 'utf8'));

    baseTargetTime = Number(fixtureA.pubSignals[24]); // 2000000000

    // Advance block time to target time
    await ethers.provider.send('evm_setNextBlockTimestamp', [baseTargetTime]);
    await ethers.provider.send('evm_mine', []);

    // 1. Deploy IssuerRegistry
    const IssuerRegistryFactory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = await IssuerRegistryFactory.deploy(admin.address);
    await issuerRegistry.waitForDeployment();

    // 2. Deploy RevocationRegistry
    const RevocationRegistryFactory = await ethers.getContractFactory('RevocationRegistry');
    revocationRegistry = await RevocationRegistryFactory.deploy(
      admin.address,
      await issuerRegistry.getAddress(),
    );
    await revocationRegistry.waitForDeployment();

    // 3. Deploy Mode A and Mode B Groth16 Verifiers
    const VerifierAFactory = await ethers.getContractFactory('Groth16Verifier');
    verifierModeA = await VerifierAFactory.deploy();
    await verifierModeA.waitForDeployment();

    const VerifierBFactory = await ethers.getContractFactory('Groth16VerifierModeB');
    verifierModeB = await VerifierBFactory.deploy();
    await verifierModeB.waitForDeployment();

    // 4. Deploy VerifierGateway
    const GatewayFactory = await ethers.getContractFactory('VerifierGateway');
    gateway = await GatewayFactory.deploy(
      admin.address,
      await issuerRegistry.getAddress(),
      await revocationRegistry.getAddress(),
      await verifierModeA.getAddress(),
      await verifierModeB.getAddress(),
    );
    await gateway.waitForDeployment();

    // 5. Onboard issuer matching fixture issuerKeyHash
    // Fixture A issuerKeyHash: fixtureA.pubSignals[1]
    const keyHashA = fixtureA.pubSignals[1];
    await issuerRegistry
      .connect(issuer)
      .applyAsIssuer('did:ethr:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', keyHashA, 'ipfs://QmMeta');
    await issuerRegistry.connect(admin).approveIssuer(issuer.address);

    // Also register SMT root for Mode B in RevocationRegistry
    // Fixture B issuerKeyHash: fixtureB.pubSignals[0] (identical to keyHashA)
    // Fixture B revocationRoot: fixtureB.pubSignals[25]
    const rootB = fixtureB.pubSignals[25];
    await revocationRegistry.connect(issuer).updateRevocationRoot(keyHashA, rootB);
  });

  it('1. verifies valid Mode A presentation proof via view call', async () => {
    const [ok, reason] = await gateway.verifyPresentation(
      fixtureA.a,
      fixtureA.b,
      fixtureA.c,
      fixtureA.pubSignals,
      0, // Mode A
    );

    expect(ok).to.be.true;
    expect(reason).to.equal(0); // None = 0
  });

  it('2. negative case: Mode A rejects presentation if credentialId is revoked', async () => {
    const credId = fixtureA.pubSignals[0];
    await revocationRegistry.connect(issuer).revokeCredential(credId);

    const [ok, reason] = await gateway.verifyPresentation(
      fixtureA.a,
      fixtureA.b,
      fixtureA.c,
      fixtureA.pubSignals,
      0, // Mode A
    );

    expect(ok).to.be.false;
    expect(reason).to.equal(6); // CredentialRevoked = 6
  });

  it('3. verifies valid Mode B presentation proof (SMT in-circuit non-revocation)', async () => {
    const [ok, reason] = await gateway.verifyPresentation(
      fixtureB.a,
      fixtureB.b,
      fixtureB.c,
      fixtureB.pubSignals,
      1, // Mode B
    );

    expect(ok).to.be.true;
    expect(reason).to.equal(0); // None = 0
  });

  it('4. negative case: Mode B rejects presentation with unregistered / stale revocationRoot', async () => {
    const tamperedPubSignals = [...fixtureB.pubSignals];
    // Tamper with revocationRoot signal
    tamperedPubSignals[25] = '0x1111111111111111111111111111111111111111111111111111111111111111';

    const [ok, reason] = await gateway.verifyPresentation(
      fixtureB.a,
      fixtureB.b,
      fixtureB.c,
      tamperedPubSignals,
      1, // Mode B
    );

    expect(ok).to.be.false;
    // Either ProofInvalid (1) or RevocationRootInvalid (3)
    expect(Number(reason)).to.be.oneOf([1, 3]);
  });

  it('5. negative case: rejects presentation when issuer key is suspended', async () => {
    await issuerRegistry.connect(admin).suspendIssuer(issuer.address);

    const [ok, reason] = await gateway.verifyPresentation(
      fixtureB.a,
      fixtureB.b,
      fixtureB.c,
      fixtureB.pubSignals,
      1, // Mode B
    );

    expect(ok).to.be.false;
    expect(reason).to.equal(2); // IssuerKeyInactive = 2

    // Reinstate issuer for subsequent tests
    await issuerRegistry.connect(admin).reinstateIssuer(issuer.address);
  });

  it('6. consumeAndVerify executes on-chain, records nonce, emits event, and measures gas', async () => {
    const challengeNonce = ethers.encodeBytes32String('NONCE-TEST-2026-CHALLENGE-01');

    const tx = await gateway
      .connect(verifierUser)
      .consumeAndVerify(
        fixtureB.a,
        fixtureB.b,
        fixtureB.c,
        fixtureB.pubSignals,
        1, // Mode B
        challengeNonce,
      );

    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);

    console.warn(`\n  ⚡ VerifierGateway.consumeAndVerify Gas Used: ${receipt.gasUsed.toString()} gas\n`);
    expect(receipt.gasUsed).to.be.greaterThan(250000n);
    expect(receipt.gasUsed).to.be.lessThan(500000n);

    // Nonce should now be marked consumed
    expect(await gateway.isChallengeConsumed(challengeNonce)).to.be.true;
  });

  it('7. negative case: replaying consumeAndVerify with the same nonce reverts', async () => {
    const challengeNonce = ethers.encodeBytes32String('NONCE-TEST-2026-CHALLENGE-01');

    await expect(
      gateway
        .connect(verifierUser)
        .consumeAndVerify(
          fixtureB.a,
          fixtureB.b,
          fixtureB.c,
          fixtureB.pubSignals,
          1,
          challengeNonce,
        ),
    ).to.be.revertedWithCustomError(gateway, 'ChallengeAlreadyConsumed');
  });

  it('8. negative case: rejects presentation when timestamp exceeds ±5 min window', async () => {
    // Warp blockchain time 15 minutes ahead of target time (outside ±300s window)
    const expiredTime = baseTargetTime + 900;
    await ethers.provider.send('evm_setNextBlockTimestamp', [expiredTime]);
    await ethers.provider.send('evm_mine', []);

    const [ok, reason] = await gateway.verifyPresentation(
      fixtureB.a,
      fixtureB.b,
      fixtureB.c,
      fixtureB.pubSignals,
      1, // Mode B
    );

    expect(ok).to.be.false;
    expect(reason).to.equal(4); // TimestampExpired = 4
  });
});
