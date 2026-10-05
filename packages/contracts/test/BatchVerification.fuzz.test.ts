import { expect } from 'chai';
import { ethers } from 'hardhat';
import { DocumentRegistry, IssuerRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

/**
 * Standard sorted-pair Merkle tree compatible with OpenZeppelin's MerkleProof.verify
 */
class SortedMerkleTree {
  leaves: string[];
  layers: string[][];

  constructor(leaves: string[]) {
    this.leaves = leaves;
    this.layers = [leaves];
    let current = leaves;
    while (current.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        if (i + 1 < current.length) {
          next.push(this.hashPair(current[i]!, current[i + 1]!));
        } else {
          next.push(current[i]!); // promote unpaired leaf
        }
      }
      this.layers.push(next);
      current = next;
    }
  }

  hashPair(a: string, b: string): string {
    const [left, right] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
    return ethers.keccak256(ethers.concat([left, right]));
  }

  getRoot(): string {
    const top = this.layers[this.layers.length - 1];
    return top ? top[0]! : ethers.ZeroHash;
  }

  getProof(leafIndex: number): string[] {
    const proof: string[] = [];
    let idx = leafIndex;
    for (let layerIdx = 0; layerIdx < this.layers.length - 1; layerIdx++) {
      const layer = this.layers[layerIdx]!;
      const isRightNode = idx % 2 === 1;
      const siblingIdx = isRightNode ? idx - 1 : idx + 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]!);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  }
}

describe('BatchVerification Fuzz & Property Testing', function () {
  let issuerRegistry: IssuerRegistry;
  let documentRegistry: DocumentRegistry;
  let admin: SignerWithAddress;
  let issuer: SignerWithAddress;

  before(async function () {
    [admin, issuer] = await ethers.getSigners();

    const IssuerFactory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = (await IssuerFactory.deploy(admin.address)) as unknown as IssuerRegistry;
    await issuerRegistry.waitForDeployment();

    const DocFactory = await ethers.getContractFactory('DocumentRegistry');
    documentRegistry = (await DocFactory.deploy(
      admin.address,
      await issuerRegistry.getAddress(),
    )) as unknown as DocumentRegistry;
    await documentRegistry.waitForDeployment();

    const sampleKeyHash = ethers.keccak256(ethers.toUtf8Bytes('batch-fuzz-issuer-key'));
    await issuerRegistry
      .connect(issuer)
      .applyAsIssuer('did:ethr:batch-fuzzer', sampleKeyHash, 'ipfs://meta');
    await issuerRegistry.connect(admin).approveIssuer(issuer.address);
  });

  const testSizes = [2, 4, 8, 16, 32, 64];

  for (const size of testSizes) {
    it(`correctly verifies all inclusion proofs for Merkle tree of size ${size}`, async function () {
      const leaves = Array.from({ length: size }, (_, i) =>
        ethers.keccak256(ethers.toUtf8Bytes(`batch-${size}-doc-${i}`)),
      );

      const tree = new SortedMerkleTree(leaves);
      const root = tree.getRoot();

      await documentRegistry
        .connect(issuer)
        .registerBatch(root, size, `ipfs://batch-manifest-${size}`);

      // Verify every leaf in the batch succeeds
      for (let i = 0; i < size; i++) {
        const leaf = leaves[i]!;
        const proof = tree.getProof(i);
        const isValid = await documentRegistry.verifyInBatch(root, leaf, proof);
        expect(isValid).to.be.true;
      }

      // Negative check 1: Random non-member leaf must fail
      const randomFakeLeaf = ethers.keccak256(ethers.toUtf8Bytes(`fake-leaf-not-in-batch-${size}`));
      const proof0 = tree.getProof(0);
      const fakeResult = await documentRegistry.verifyInBatch(root, randomFakeLeaf, proof0);
      expect(fakeResult).to.be.false;

      // Negative check 2: Tampered proof step must fail
      if (proof0.length > 0) {
        const tamperedProof = [...proof0];
        tamperedProof[0] = ethers.keccak256(ethers.toUtf8Bytes('corrupted-sibling'));
        const tamperedResult = await documentRegistry.verifyInBatch(
          root,
          leaves[0]!,
          tamperedProof,
        );
        expect(tamperedResult).to.be.false;
      }
    });
  }
});
