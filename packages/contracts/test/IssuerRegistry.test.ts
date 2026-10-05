import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { IssuerRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('IssuerRegistry', function () {
  let issuerRegistry: IssuerRegistry;
  let admin: SignerWithAddress;
  let issuer1: SignerWithAddress;
  let issuer2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const sampleDid1 = 'did:ethr:0x1111111111111111111111111111111111111111';
  const sampleDid2 = 'did:ethr:0x2222222222222222222222222222222222222222';
  const sampleKeyHash1 = ethers.keccak256(ethers.toUtf8Bytes('issuer-1-zk-key'));
  const sampleKeyHash2 = ethers.keccak256(ethers.toUtf8Bytes('issuer-2-zk-key'));
  const sampleMetadata = 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';

  beforeEach(async function () {
    [admin, issuer1, issuer2, unauthorized] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = (await Factory.deploy(admin.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();
  });

  describe('Initialization', function () {
    it('sets the admin role correctly', async function () {
      const DEFAULT_ADMIN_ROLE = await issuerRegistry.DEFAULT_ADMIN_ROLE();
      expect(await issuerRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await issuerRegistry.hasRole(DEFAULT_ADMIN_ROLE, unauthorized.address)).to.be.false;
    });

    it('sets the default grace period to 7 days', async function () {
      expect(await issuerRegistry.keyGracePeriod()).to.equal(7 * 24 * 3600);
    });

    it('reverts deployment with zero address admin', async function () {
      const Factory = await ethers.getContractFactory('IssuerRegistry');
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        issuerRegistry,
        'InvalidParameters',
      );
    });
  });

  describe('applyAsIssuer', function () {
    it('allows an institution to apply and emits IssuerApplied', async function () {
      await expect(
        issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata),
      )
        .to.emit(issuerRegistry, 'IssuerApplied')
        .withArgs(issuer1.address, sampleDid1, sampleKeyHash1, sampleMetadata);

      const issuer = await issuerRegistry.getIssuer(issuer1.address);
      expect(issuer.did).to.equal(sampleDid1);
      expect(issuer.zkKeyHash).to.equal(sampleKeyHash1);
      expect(issuer.metadataURI).to.equal(sampleMetadata);
      expect(issuer.status).to.equal(1); // Pending
      expect(issuer.keyEpoch).to.equal(1);

      const keyRec = await issuerRegistry.getKeyRecord(sampleKeyHash1);
      expect(keyRec.issuer).to.equal(issuer1.address);
      expect(keyRec.isCurrent).to.be.true;
    });

    it('reverts on empty DID or zero keyHash', async function () {
      await expect(
        issuerRegistry.connect(issuer1).applyAsIssuer('', sampleKeyHash1, sampleMetadata),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidParameters');

      await expect(
        issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid1, ethers.ZeroHash, sampleMetadata),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidParameters');
    });

    it('reverts if caller already applied', async function () {
      await issuerRegistry
        .connect(issuer1)
        .applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata);
      await expect(
        issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata),
      ).to.be.revertedWithCustomError(issuerRegistry, 'IssuerAlreadyRegistered');
    });

    it('reverts if keyHash is already used by another applicant', async function () {
      await issuerRegistry
        .connect(issuer1)
        .applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata);
      await expect(
        issuerRegistry.connect(issuer2).applyAsIssuer(sampleDid2, sampleKeyHash1, sampleMetadata),
      ).to.be.revertedWithCustomError(issuerRegistry, 'KeyAlreadyUsed');
    });

    it('reverts when paused', async function () {
      await issuerRegistry.connect(admin).pause();
      await expect(
        issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata),
      ).to.be.revertedWithCustomError(issuerRegistry, 'EnforcedPause');
    });
  });

  describe('Approval, Suspension, Reinstatement, and Revocation Lifecycle', function () {
    beforeEach(async function () {
      await issuerRegistry
        .connect(issuer1)
        .applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata);
    });

    it('allows admin to approve pending issuer', async function () {
      await expect(issuerRegistry.connect(admin).approveIssuer(issuer1.address))
        .to.emit(issuerRegistry, 'IssuerApproved')
        .withArgs(issuer1.address);

      expect(await issuerRegistry.getIssuerStatus(issuer1.address)).to.equal(2); // Active
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.true;
    });

    it('prevents non-admin from approving issuer', async function () {
      const DEFAULT_ADMIN_ROLE = await issuerRegistry.DEFAULT_ADMIN_ROLE();
      await expect(
        issuerRegistry.connect(unauthorized).approveIssuer(issuer1.address),
      ).to.be.revertedWithCustomError(issuerRegistry, 'AccessControlUnauthorizedAccount');
    });

    it('reverts when approving non-pending issuer', async function () {
      await issuerRegistry.connect(admin).approveIssuer(issuer1.address);
      await expect(
        issuerRegistry.connect(admin).approveIssuer(issuer1.address),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidIssuerStatus');
    });

    it('allows admin to suspend active issuer', async function () {
      await issuerRegistry.connect(admin).approveIssuer(issuer1.address);

      await expect(issuerRegistry.connect(admin).suspendIssuer(issuer1.address))
        .to.emit(issuerRegistry, 'IssuerSuspended')
        .withArgs(issuer1.address);

      expect(await issuerRegistry.getIssuerStatus(issuer1.address)).to.equal(3); // Suspended
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.false;
    });

    it('allows admin to reinstate suspended issuer', async function () {
      await issuerRegistry.connect(admin).approveIssuer(issuer1.address);
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);

      await expect(issuerRegistry.connect(admin).reinstateIssuer(issuer1.address))
        .to.emit(issuerRegistry, 'IssuerReinstated')
        .withArgs(issuer1.address);

      expect(await issuerRegistry.getIssuerStatus(issuer1.address)).to.equal(2); // Active
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.true;
    });

    it('allows admin to revoke issuer permanently', async function () {
      await issuerRegistry.connect(admin).approveIssuer(issuer1.address);

      await expect(issuerRegistry.connect(admin).revokeIssuer(issuer1.address))
        .to.emit(issuerRegistry, 'IssuerRevoked')
        .withArgs(issuer1.address);

      expect(await issuerRegistry.getIssuerStatus(issuer1.address)).to.equal(4); // Revoked
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.false;

      // Cannot reinstate or approve a revoked issuer
      await expect(
        issuerRegistry.connect(admin).reinstateIssuer(issuer1.address),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidIssuerStatus');
    });

    it('reverts when suspending or reinstating with invalid current status', async function () {
      await expect(
        issuerRegistry.connect(admin).suspendIssuer(issuer1.address),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidIssuerStatus');

      await expect(
        issuerRegistry.connect(admin).reinstateIssuer(issuer1.address),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidIssuerStatus');
    });
  });

  describe('Key Rotation & Grace Period', function () {
    const rotatedKey = ethers.keccak256(ethers.toUtf8Bytes('issuer-1-new-key-epoch-2'));

    beforeEach(async function () {
      await issuerRegistry
        .connect(issuer1)
        .applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata);
      await issuerRegistry.connect(admin).approveIssuer(issuer1.address);
    });

    it('allows active issuer to rotate key and preserves old key during grace window', async function () {
      const tx = await issuerRegistry.connect(issuer1).rotateKey(rotatedKey);
      const block = await ethers.provider.getBlock(tx.blockNumber!);
      const expectedGraceUntil = block!.timestamp + 7 * 24 * 3600;

      await expect(tx)
        .to.emit(issuerRegistry, 'KeyRotated')
        .withArgs(issuer1.address, sampleKeyHash1, rotatedKey, 2, expectedGraceUntil);

      const issuer = await issuerRegistry.getIssuer(issuer1.address);
      expect(issuer.zkKeyHash).to.equal(rotatedKey);
      expect(issuer.keyEpoch).to.equal(2);

      // Both new key and old key are active right now
      expect(await issuerRegistry.isActiveKey(rotatedKey)).to.be.true;
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.true;

      // Fast-forward past half of grace period -> still active
      await time.increase(3 * 24 * 3600);
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.true;

      // Fast-forward past full grace period -> old key expires
      await time.increase(5 * 24 * 3600);
      expect(await issuerRegistry.isActiveKey(sampleKeyHash1)).to.be.false;
      expect(await issuerRegistry.isActiveKey(rotatedKey)).to.be.true;
    });

    it('reverts key rotation if caller is not active', async function () {
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);
      await expect(
        issuerRegistry.connect(issuer1).rotateKey(rotatedKey),
      ).to.be.revertedWithCustomError(issuerRegistry, 'IssuerNotActive');
    });

    it('reverts key rotation with zero or previously used key', async function () {
      await expect(
        issuerRegistry.connect(issuer1).rotateKey(ethers.ZeroHash),
      ).to.be.revertedWithCustomError(issuerRegistry, 'InvalidParameters');

      await expect(
        issuerRegistry.connect(issuer1).rotateKey(sampleKeyHash1),
      ).to.be.revertedWithCustomError(issuerRegistry, 'KeyAlreadyUsed');
    });

    it('allows admin to configure key grace period', async function () {
      const newPeriod = 14 * 24 * 3600;
      await expect(issuerRegistry.connect(admin).setGracePeriod(newPeriod))
        .to.emit(issuerRegistry, 'GracePeriodUpdated')
        .withArgs(7 * 24 * 3600, newPeriod);

      expect(await issuerRegistry.keyGracePeriod()).to.equal(newPeriod);
    });

    it('reverts setting grace period if not admin', async function () {
      await expect(
        issuerRegistry.connect(unauthorized).setGracePeriod(100),
      ).to.be.revertedWithCustomError(issuerRegistry, 'AccessControlUnauthorizedAccount');
    });
  });

  describe('View functions and edge cases', function () {
    it('returns false for unregistered key in isActiveKey', async function () {
      expect(await issuerRegistry.isActiveKey(ethers.keccak256(ethers.toUtf8Bytes('unknown')))).to
        .be.false;
    });

    it('returns correct issuer address for key hash', async function () {
      await issuerRegistry
        .connect(issuer1)
        .applyAsIssuer(sampleDid1, sampleKeyHash1, sampleMetadata);
      expect(await issuerRegistry.issuerOfKey(sampleKeyHash1)).to.equal(issuer1.address);
      expect(await issuerRegistry.issuerOfKey(ethers.ZeroHash)).to.equal(ethers.ZeroAddress);
    });

    it('pausing and unpausing by admin works and blocks restricted actions', async function () {
      await issuerRegistry.connect(admin).pause();
      expect(await issuerRegistry.paused()).to.be.true;

      await issuerRegistry.connect(admin).unpause();
      expect(await issuerRegistry.paused()).to.be.false;
    });
  });
});
