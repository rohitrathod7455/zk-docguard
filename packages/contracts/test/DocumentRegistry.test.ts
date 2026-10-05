import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { DocumentRegistry, IssuerRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('DocumentRegistry', function () {
  let issuerRegistry: IssuerRegistry;
  let documentRegistry: DocumentRegistry;
  let admin: SignerWithAddress;
  let issuer1: SignerWithAddress;
  let issuer2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const sampleDid = 'did:ethr:0x1111111111111111111111111111111111111111';
  const sampleKeyHash = ethers.keccak256(ethers.toUtf8Bytes('issuer-zk-key'));
  const sampleMetadata = 'ipfs://QmSampleMetadata';

  const docHash1 = ethers.keccak256(ethers.toUtf8Bytes('document-1-bytes'));
  const credentialId1 = ethers.keccak256(ethers.toUtf8Bytes('credential-id-1'));
  const schemaId = ethers.keccak256(ethers.toUtf8Bytes('UniversityDegreeSchema'));
  const cid1 = 'QmDocumentCiphertextCid1';

  beforeEach(async function () {
    [admin, issuer1, issuer2, unauthorized] = await ethers.getSigners();

    const IssuerFactory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = (await IssuerFactory.deploy(admin.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();

    const DocFactory = await ethers.getContractFactory('DocumentRegistry');
    documentRegistry = (await DocFactory.deploy(
      admin.address,
      await issuerRegistry.getAddress(),
    )) as unknown as DocumentRegistry;
    await documentRegistry.waitForDeployment();

    // Register and approve issuer1
    await issuerRegistry.connect(issuer1).applyAsIssuer(sampleDid, sampleKeyHash, sampleMetadata);
    await issuerRegistry.connect(admin).approveIssuer(issuer1.address);
  });

  describe('Initialization', function () {
    it('sets the admin and issuer registry address correctly', async function () {
      const DEFAULT_ADMIN_ROLE = await documentRegistry.DEFAULT_ADMIN_ROLE();
      expect(await documentRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await documentRegistry.ISSUER_REGISTRY()).to.equal(await issuerRegistry.getAddress());
    });

    it('reverts deployment with zero addresses', async function () {
      const DocFactory = await ethers.getContractFactory('DocumentRegistry');
      await expect(
        DocFactory.deploy(ethers.ZeroAddress, await issuerRegistry.getAddress()),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');

      await expect(
        DocFactory.deploy(admin.address, ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');
    });
  });

  describe('registerDocument', function () {
    it('allows an active issuer to register a document and emits DocumentRegistered', async function () {
      const expiry = (await time.latest()) + 365 * 24 * 3600;

      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(docHash1, credentialId1, schemaId, cid1, expiry),
      )
        .to.emit(documentRegistry, 'DocumentRegistered')
        .withArgs(docHash1, issuer1.address, credentialId1, schemaId, cid1, expiry);

      const doc = await documentRegistry.getDocument(docHash1);
      expect(doc.issuer).to.equal(issuer1.address);
      expect(doc.credentialId).to.equal(credentialId1);
      expect(doc.schemaId).to.equal(schemaId);
      expect(doc.cid).to.equal(cid1);
      expect(doc.expiry).to.equal(expiry);
      expect(doc.revoked).to.be.false;
    });

    it('reverts if caller is not an active issuer', async function () {
      await expect(
        documentRegistry
          .connect(unauthorized)
          .registerDocument(docHash1, credentialId1, schemaId, cid1, 0),
      ).to.be.revertedWithCustomError(documentRegistry, 'IssuerNotActive');
    });

    it('reverts on duplicate document registration', async function () {
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, 0);

      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(docHash1, credentialId1, schemaId, cid1, 0),
      ).to.be.revertedWithCustomError(documentRegistry, 'DocumentAlreadyRegistered');
    });

    it('reverts on zero docHash or credentialId', async function () {
      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(ethers.ZeroHash, credentialId1, schemaId, cid1, 0),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');

      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(docHash1, ethers.ZeroHash, schemaId, cid1, 0),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');
    });

    it('reverts if expiry is in the past', async function () {
      const pastExpiry = (await time.latest()) - 100;
      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(docHash1, credentialId1, schemaId, cid1, pastExpiry),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidExpiry');
    });

    it('reverts when paused', async function () {
      await documentRegistry.connect(admin).pause();
      await expect(
        documentRegistry
          .connect(issuer1)
          .registerDocument(docHash1, credentialId1, schemaId, cid1, 0),
      ).to.be.revertedWithCustomError(documentRegistry, 'EnforcedPause');
    });
  });

  describe('verifyDocument (Status Verification)', function () {
    it('returns Unknown for unregistered document', async function () {
      const [status, issuer, issuedAt, expiry] = await documentRegistry.verifyDocument(docHash1);
      expect(status).to.equal(0); // Unknown
      expect(issuer).to.equal(ethers.ZeroAddress);
      expect(issuedAt).to.equal(0);
      expect(expiry).to.equal(0);
    });

    it('returns Valid for an active, unexpired, non-revoked document', async function () {
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, 0);

      const [status, issuer] = await documentRegistry.verifyDocument(docHash1);
      expect(status).to.equal(1); // Valid
      expect(issuer).to.equal(issuer1.address);
    });

    it('returns Expired when timestamp exceeds expiry', async function () {
      const expiry = (await time.latest()) + 100;
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, expiry);

      expect((await documentRegistry.verifyDocument(docHash1))[0]).to.equal(1); // Valid initially

      await time.increase(101);
      expect((await documentRegistry.verifyDocument(docHash1))[0]).to.equal(2); // Expired
    });

    it('returns Revoked when document has been revoked by issuer', async function () {
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, 0);

      const reasonCode = ethers.keccak256(ethers.toUtf8Bytes('ACADEMIC_MISCONDUCT'));
      await documentRegistry.connect(issuer1).revokeDocument(docHash1, reasonCode);

      const [status] = await documentRegistry.verifyDocument(docHash1);
      expect(status).to.equal(3); // Revoked
    });

    it('returns IssuerSuspended when issuing institution is suspended or revoked', async function () {
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, 0);

      // Suspend issuer
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);
      expect((await documentRegistry.verifyDocument(docHash1))[0]).to.equal(4); // IssuerSuspended

      // Reinstate issuer -> document valid again
      await issuerRegistry.connect(admin).reinstateIssuer(issuer1.address);
      expect((await documentRegistry.verifyDocument(docHash1))[0]).to.equal(1); // Valid
    });
  });

  describe('revokeDocument', function () {
    const reasonCode = ethers.keccak256(ethers.toUtf8Bytes('TYPO_CORRECTION'));

    beforeEach(async function () {
      await documentRegistry
        .connect(issuer1)
        .registerDocument(docHash1, credentialId1, schemaId, cid1, 0);
    });

    it('allows issuing institution to revoke document', async function () {
      await expect(documentRegistry.connect(issuer1).revokeDocument(docHash1, reasonCode))
        .to.emit(documentRegistry, 'DocumentRevoked')
        .withArgs(docHash1, issuer1.address, reasonCode);

      const doc = await documentRegistry.getDocument(docHash1);
      expect(doc.revoked).to.be.true;
    });

    it('reverts when non-issuer tries to revoke', async function () {
      await expect(
        documentRegistry.connect(unauthorized).revokeDocument(docHash1, reasonCode),
      ).to.be.revertedWithCustomError(documentRegistry, 'UnauthorizedIssuer');
    });

    it('reverts when revoking already revoked document', async function () {
      await documentRegistry.connect(issuer1).revokeDocument(docHash1, reasonCode);
      await expect(
        documentRegistry.connect(issuer1).revokeDocument(docHash1, reasonCode),
      ).to.be.revertedWithCustomError(documentRegistry, 'DocumentAlreadyRevoked');
    });

    it('reverts when document not found', async function () {
      const unknownHash = ethers.keccak256(ethers.toUtf8Bytes('unknown-hash'));
      await expect(
        documentRegistry.connect(issuer1).revokeDocument(unknownHash, reasonCode),
      ).to.be.revertedWithCustomError(documentRegistry, 'DocumentNotFound');
    });
  });

  describe('Batch Registration & Merkle Verification', function () {
    // 2-leaf Merkle tree:
    // leafA = docHash1, leafB = docHash2
    // root = keccak256(leafA < leafB ? (leafA + leafB) : (leafB + leafA))
    let leafA: string;
    let leafB: string;
    let batchRoot: string;
    const batchManifest = 'ipfs://QmBatchManifestCid';

    beforeEach(function () {
      leafA = docHash1;
      leafB = ethers.keccak256(ethers.toUtf8Bytes('document-2-bytes'));

      const [left, right] = BigInt(leafA) < BigInt(leafB) ? [leafA, leafB] : [leafB, leafA];
      batchRoot = ethers.keccak256(ethers.concat([left, right]));
    });

    it('allows active issuer to register a batch root', async function () {
      await expect(documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest))
        .to.emit(documentRegistry, 'BatchRegistered')
        .withArgs(batchRoot, issuer1.address, 2, batchManifest);

      const batch = await documentRegistry.getBatch(batchRoot);
      expect(batch.issuer).to.equal(issuer1.address);
      expect(batch.count).to.equal(2);
      expect(batch.manifestCid).to.equal(batchManifest);
    });

    it('verifies inclusion proof in batch', async function () {
      await documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest);

      // Proof for leafA is sibling leafB
      const proofA = [leafB];
      expect(await documentRegistry.verifyInBatch(batchRoot, leafA, proofA)).to.be.true;

      // Proof for leafB is sibling leafA
      const proofB = [leafA];
      expect(await documentRegistry.verifyInBatch(batchRoot, leafB, proofB)).to.be.true;

      // Tampered leaf or proof fails
      const fakeProof = [ethers.keccak256(ethers.toUtf8Bytes('fake'))];
      expect(await documentRegistry.verifyInBatch(batchRoot, leafA, fakeProof)).to.be.false;
    });

    it('returns false for verifyInBatch if batch issuer is suspended', async function () {
      await documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest);
      await issuerRegistry.connect(admin).suspendIssuer(issuer1.address);

      expect(await documentRegistry.verifyInBatch(batchRoot, leafA, [leafB])).to.be.false;
    });

    it('returns false for unregistered batch in verifyInBatch', async function () {
      const unknownRoot = ethers.keccak256(ethers.toUtf8Bytes('unregistered-batch'));
      expect(await documentRegistry.verifyInBatch(unknownRoot, leafA, [leafB])).to.be.false;
    });

    it('reverts batch registration with invalid params or duplicates', async function () {
      await expect(
        documentRegistry.connect(issuer1).registerBatch(ethers.ZeroHash, 2, batchManifest),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');

      await expect(
        documentRegistry.connect(issuer1).registerBatch(batchRoot, 0, batchManifest),
      ).to.be.revertedWithCustomError(documentRegistry, 'InvalidParameters');

      await documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest);
      await expect(
        documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest),
      ).to.be.revertedWithCustomError(documentRegistry, 'BatchAlreadyRegistered');
    });

    it('blocks registerBatch when paused and restores upon unpause', async function () {
      await documentRegistry.connect(admin).pause();
      expect(await documentRegistry.paused()).to.be.true;

      await expect(
        documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest),
      ).to.be.revertedWithCustomError(documentRegistry, 'EnforcedPause');

      await documentRegistry.connect(admin).unpause();
      expect(await documentRegistry.paused()).to.be.false;

      await expect(
        documentRegistry.connect(issuer1).registerBatch(batchRoot, 2, batchManifest),
      ).to.emit(documentRegistry, 'BatchRegistered');
    });
  });
});
