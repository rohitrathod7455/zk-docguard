import { expect } from 'chai';
import { ethers } from 'hardhat';
import { RevocationRegistry, IssuerRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('RevocationRegistry', function () {
  let issuerRegistry: IssuerRegistry;
  let revocationRegistry: RevocationRegistry;
  let admin: SignerWithAddress;
  let issuer1: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const sampleDid = 'did:ethr:0x1111111111111111111111111111111111111111';
  const sampleKeyHash = ethers.keccak256(ethers.toUtf8Bytes('issuer-zk-key'));
  const sampleMetadata = 'ipfs://QmSampleMetadata';

  const credentialId1 = ethers.keccak256(ethers.toUtf8Bytes('credential-id-1'));

  beforeEach(async function () {
    [admin, issuer1, unauthorized] = await ethers.getSigners();

    const IssuerFactory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = (await IssuerFactory.deploy(admin.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();

    const RevFactory = await ethers.getContractFactory('RevocationRegistry');
    revocationRegistry = (await RevFactory.deploy(
      admin.address,
      await issuerRegistry.getAddress(),
    )) as unknown as RevocationRegistry;
    await revocationRegistry.waitForDeployment();

    // Register and approve issuer1
    await issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid, sampleKeyHash, sampleMetadata);
    await issuerRegistry.connect(admin).approveIssuer(issuer1.address);
  });

  describe('Initialization', function () {
    it('sets the admin and issuer registry address correctly', async function () {
      const DEFAULT_ADMIN_ROLE = await revocationRegistry.DEFAULT_ADMIN_ROLE();
      expect(await revocationRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await revocationRegistry.ISSUER_REGISTRY()).to.equal(
        await issuerRegistry.getAddress(),
      );
    });

    it('reverts deployment with zero addresses', async function () {
      const RevFactory = await ethers.getContractFactory('RevocationRegistry');
      await expect(
        RevFactory.deploy(ethers.ZeroAddress, await issuerRegistry.getAddress()),
      ).to.be.revertedWithCustomError(revocationRegistry, 'InvalidParameters');

      await expect(
        RevFactory.deploy(admin.address, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(revocationRegistry, 'InvalidParameters');
    });
  });

  describe('v1: Direct Credential Revocation', function () {
    it('allows an active issuer to revoke a credential on-chain', async function () {
      expect(await revocationRegistry.isRevoked(credentialId1)).to.be.false;

      const tx = await revocationRegistry.connect(issuer1).revokeCredential(credentialId1);
      const block = await ethers.provider.getBlock(tx.blockNumber!);

      await expect(tx)
        .to.emit(revocationRegistry, 'CredentialRevoked')
        .withArgs(credentialId1, issuer1.address, block!.timestamp);

      expect(await revocationRegistry.isRevoked(credentialId1)).to.be.true;
      expect(await revocationRegistry.revocationIssuer(credentialId1)).to.equal(issuer1.address);
    });

    it('reverts if caller is not an active issuer', async function () {
      await expect(
        revocationRegistry.connect(unauthorized).revokeCredential(credentialId1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'IssuerNotActive');
    });

    it('reverts on duplicate revocation', async function () {
      await revocationRegistry.connect(issuer1).revokeCredential(credentialId1);
      await expect(
        revocationRegistry.connect(issuer1).revokeCredential(credentialId1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'CredentialAlreadyRevoked');
    });

    it('reverts on zero credentialId', async function () {
      await expect(
        revocationRegistry.connect(issuer1).revokeCredential(ethers.ZeroHash),
      ).to.be.revertedWithCustomError(revocationRegistry, 'InvalidParameters');
    });

    it('reverts when paused', async function () {
      await revocationRegistry.connect(admin).pause();
      await expect(
        revocationRegistry.connect(issuer1).revokeCredential(credentialId1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'EnforcedPause');
    });
  });

  describe('v2: Sparse Merkle Tree (SMT) Root Management & Ring Buffer', function () {
    const root1 = ethers.keccak256(ethers.toUtf8Bytes('smt-root-1'));
    const root2 = ethers.keccak256(ethers.toUtf8Bytes('smt-root-2'));

    it('allows key owner to update revocation root', async function () {
      await expect(revocationRegistry.connect(issuer1).updateRevocationRoot(sampleKeyHash, root1))
        .to.emit(revocationRegistry, 'RevocationRootUpdated')
        .withArgs(sampleKeyHash, root1, 1);

      expect(await revocationRegistry.isValidRoot(sampleKeyHash, root1)).to.be.true;
      expect(await revocationRegistry.isValidRoot(sampleKeyHash, root2)).to.be.false;

      const [latestRoot, epoch] = await revocationRegistry.getLatestRoot(sampleKeyHash);
      expect(latestRoot).to.equal(root1);
      expect(epoch).to.equal(1);
    });

    it('allows admin to update revocation root for an issuer', async function () {
      await expect(revocationRegistry.connect(admin).updateRevocationRoot(sampleKeyHash, root1))
        .to.emit(revocationRegistry, 'RevocationRootUpdated')
        .withArgs(sampleKeyHash, root1, 1);

      expect(await revocationRegistry.isValidRoot(sampleKeyHash, root1)).to.be.true;
    });

    it('reverts root update if unauthorized', async function () {
      await expect(
        revocationRegistry.connect(unauthorized).updateRevocationRoot(sampleKeyHash, root1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'UnauthorizedIssuer');
    });

    it('reverts root update with zero values', async function () {
      await expect(
        revocationRegistry.connect(issuer1).updateRevocationRoot(sampleKeyHash, ethers.ZeroHash),
      ).to.be.revertedWithCustomError(revocationRegistry, 'InvalidParameters');

      await expect(
        revocationRegistry.connect(issuer1).updateRevocationRoot(ethers.ZeroHash, root1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'InvalidParameters');
    });

    it('maintains a 32-element ring buffer and evicts roots beyond 32', async function () {
      const roots: string[] = [];
      for (let i = 1; i <= 35; i++) {
        const root = ethers.keccak256(ethers.toUtf8Bytes(`smt-root-${i}`));
        roots.push(root);
        await revocationRegistry.connect(issuer1).updateRevocationRoot(sampleKeyHash, root);
      }

      // Latest root should be roots[34] (root 35) with epoch 35
      const [latest, epoch] = await revocationRegistry.getLatestRoot(sampleKeyHash);
      expect(latest).to.equal(roots[34]);
      expect(epoch).to.equal(35);

      // Roots 1, 2, 3 should have been evicted (indices 0, 1, 2 in roots array)
      expect(await revocationRegistry.isValidRoot(sampleKeyHash, roots[0])).to.be.false;
      expect(await revocationRegistry.isValidRoot(sampleKeyHash, roots[1])).to.be.false;
      expect(await revocationRegistry.isValidRoot(sampleKeyHash, roots[2])).to.be.false;

      // Roots 4 through 35 (indices 3 through 34) must all still be valid
      for (let i = 3; i < 35; i++) {
        expect(await revocationRegistry.isValidRoot(sampleKeyHash, roots[i])).to.be.true;
      }
    });

    it('returns zero for getLatestRoot when no roots exist', async function () {
      const unusedKey = ethers.keccak256(ethers.toUtf8Bytes('unused'));
      const [latest, epoch] = await revocationRegistry.getLatestRoot(unusedKey);
      expect(latest).to.equal(ethers.ZeroHash);
      expect(epoch).to.equal(0);
    });

    it('returns false for zero root in isValidRoot', async function () {
      expect(await revocationRegistry.isValidRoot(sampleKeyHash, ethers.ZeroHash)).to.be.false;
    });

    it('reverts root update if key owner is not active', async function () {
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);
      await expect(
        revocationRegistry.connect(issuer1).updateRevocationRoot(sampleKeyHash, root1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'IssuerNotActive');
    });

    it('allows admin to pause and unpause', async function () {
      await revocationRegistry.connect(admin).pause();
      expect(await revocationRegistry.paused()).to.be.true;

      await expect(
        revocationRegistry.connect(issuer1).updateRevocationRoot(sampleKeyHash, root1),
      ).to.be.revertedWithCustomError(revocationRegistry, 'EnforcedPause');

      await revocationRegistry.connect(admin).unpause();
      expect(await revocationRegistry.paused()).to.be.false;
    });
  });
});
