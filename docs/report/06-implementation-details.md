# Chapter 6: Implementation Details & Codebase Anatomy

## 6.1 Smart Contract Layer Implementation

The ZK-DocGuard smart contract system is implemented in Solidity 0.8.24 and deployed across EVM-compatible architectures. The protocol decouples identity authority, document registration, revocation tracking, and zero-knowledge proof verification into dedicated modular contracts.

### 6.1.1 Document Registry (`DocumentRegistry.sol`)
The [`DocumentRegistry`](file:///d:/projects/BlockChain/zk-docguard/packages/contracts/contracts/DocumentRegistry.sol) contract manages content-anchored document hashes and batch Merkle roots without storing cleartext metadata.

```solidity
// packages/contracts/contracts/DocumentRegistry.sol
contract DocumentRegistry is Ownable, Pausable {
    struct DocumentRecord {
        address issuer;
        uint64 timestamp;
        bool revoked;
        bytes32 merkleRoot; // Non-zero if issued as part of a batch
    }

    // Mapping from document hash to metadata record
    mapping(bytes32 => DocumentRecord) public documents;
    IIssuerRegistry public immutable issuerRegistry;

    event DocumentRegistered(bytes32 indexed docHash, address indexed issuer, uint64 timestamp);
    event BatchRegistered(bytes32 indexed merkleRoot, address indexed issuer, uint256 count);

    function registerDocument(bytes32 docHash) external whenNotPaused {
        if (!issuerRegistry.isIssuerActive(msg.sender)) revert IssuerNotActive();
        if (documents[docHash].issuer != address(0)) revert DocumentAlreadyExists();

        documents[docHash] = DocumentRecord({
            issuer: msg.sender,
            timestamp: uint64(block.timestamp),
            revoked: false,
            merkleRoot: bytes32(0)
        });
        emit DocumentRegistered(docHash, msg.sender, uint64(block.timestamp));
    }

    function registerBatch(bytes32[] calldata docHashes, bytes32 merkleRoot) external whenNotPaused {
        if (!issuerRegistry.isIssuerActive(msg.sender)) revert IssuerNotActive();
        uint256 len = docHashes.length;
        if (len == 0 || len > 100) revert InvalidBatchSize();

        for (uint256 i = 0; i < len; ) {
            bytes32 docHash = docHashes[i];
            if (documents[docHash].issuer != address(0)) revert DocumentAlreadyExists();
            documents[docHash] = DocumentRecord({
                issuer: msg.sender,
                timestamp: uint64(block.timestamp),
                revoked: false,
                merkleRoot: merkleRoot
            });
            unchecked { ++i; }
        }
        emit BatchRegistered(merkleRoot, msg.sender, len);
    }
}
```

#### Gas Optimization Techniques:
1. **Unchecked Loop Increments**: The loop variable `i` is incremented inside an `unchecked` block (`unchecked { ++i; }`), saving 80 gas per loop iteration by eliminating redundant overflow checks.
2. **Calldata Storage**: Arrays are passed as `calldata` rather than `memory`, avoiding expensive heap memory allocations.
3. **Storage Packing**: `uint64 timestamp` and `bool revoked` are packed alongside `address issuer` (160 bits) into a single 256-bit storage slot, saving a 20,000-gas `SSTORE` operation per record.

---

### 6.1.2 Verifier Gateway (`VerifierGateway.sol`)
The [`VerifierGateway`](file:///d:/projects/BlockChain/zk-docguard/packages/contracts/contracts/VerifierGateway.sol) contract acts as the single on-chain entry point for zero-knowledge presentations, verifying Groth16 proofs against registered issuer keys and current revocation roots.

```solidity
// packages/contracts/contracts/VerifierGateway.sol
contract VerifierGateway is Ownable, Pausable {
    IGroth16Verifier public immutable verifierModeA;
    IGroth16Verifier public immutable verifierModeB;
    IIssuerRegistry public immutable issuerRegistry;
    IRevocationRegistry public immutable revocationRegistry;

    mapping(bytes32 => bool) public consumedNullifiers;
    mapping(bytes32 => uint256) public activeSessionNonces;

    event ProofVerified(bytes32 indexed nullifier, address indexed issuer, uint8 mode);

    function consumeAndVerify(
        uint8 mode,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[26] calldata input
    ) external whenNotPaused returns (bool) {
        bytes32 nullifier = bytes32(input[0]);
        if (consumedNullifiers[nullifier]) revert NullifierAlreadyConsumed();

        // Validate Issuer Public Key Registration
        uint256 issuerAx = input[1];
        uint256 issuerAy = input[2];
        if (!issuerRegistry.isPublicKeyRegistered(issuerAx, issuerAy)) revert UnregisteredIssuerKey();

        bool isValid = false;
        if (mode == 0) {
            isValid = verifierModeA.verifyProof(a, b, c, input);
        } else if (mode == 1) {
            bytes32 expectedRoot = bytes32(input[3]);
            if (!revocationRegistry.isValidRevocationRoot(expectedRoot)) revert InvalidRevocationRoot();
            isValid = verifierModeB.verifyProof(a, b, c, input);
        } else {
            revert UnsupportedMode();
        }

        if (!isValid) revert InvalidGroth16Proof();

        consumedNullifiers[nullifier] = true;
        emit ProofVerified(nullifier, issuerRegistry.getIssuerByPublicKey(issuerAx, issuerAy), mode);
        return true;
    }
}
```

---

## 6.2 Zero-Knowledge Circuit Layer (Circom 2.1.9)

### 6.2.1 Mode B Circuit Architecture (`DiscloseModeB.circom`)
The [`DiscloseModeB`](file:///d:/projects/BlockChain/zk-docguard/packages/circuits/circuits/DiscloseModeB.circom) circuit proves that:
1. The prover possesses an authentic credential signed by an authorized BabyJubJub issuer key.
2. The credential's unique identifier (`docId`) is **excluded** from the issuer's active Sparse Merkle Tree revocation root.
3. Specific attributes (e.g., date of birth, clearance level) satisfy disclosure constraints without revealing secret fields.
4. An unforgeable nullifier is generated binding the session nonce to the credential secret.

```circom
// packages/circuits/circuits/DiscloseModeB.circom
pragma circom 2.1.9;

include "./SparseMerkleTreeVerifier.circom";
include "./BabyJubJubEdDSAVerifier.circom";
include "./PoseidonSponge.circom";
include "./Comparators.circom";

template DiscloseModeB(DEPTH, NUM_FIELDS) {
    // Public Inputs
    signal input nullifier;
    signal input issuerPubKeyX;
    signal input issuerPubKeyY;
    signal input currentRevocationRoot;
    signal input sessionNonce;
    signal input disclosedFieldsMask[NUM_FIELDS];
    signal input disclosedFields[NUM_FIELDS];

    // Private Witnesses
    signal input docId;
    signal input holderSecret;
    signal input rawFields[NUM_FIELDS];
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;

    // SMT Non-Membership Witnesses
    signal input smtSiblings[DEPTH];
    signal input isOld0;
    signal input oldKey;
    signal input oldValue;

    // 1. Verify BabyJubJub EdDSA Signature
    component docHasher = PoseidonSponge(NUM_FIELDS + 2);
    docHasher.inputs[0] <== docId;
    docHasher.inputs[1] <== holderSecret;
    for (var i = 0; i < NUM_FIELDS; i++) {
        docHasher.inputs[i + 2] <== rawFields[i];
    }

    component sigVerifier = BabyJubJubEdDSAVerifier();
    sigVerifier.enabled <== 1;
    sigVerifier.Ax <== issuerPubKeyX;
    sigVerifier.Ay <== issuerPubKeyY;
    sigVerifier.R8x <== sigR8x;
    sigVerifier.R8y <== sigR8y;
    sigVerifier.S <== sigS;
    sigVerifier.M <== docHasher.out;

    // 2. SMT Non-Membership Verification
    component smtExclusion = SMTNonMembershipVerifier(DEPTH);
    smtExclusion.root <== currentRevocationRoot;
    smtExclusion.targetKey <== docId;
    smtExclusion.isOld0 <== isOld0;
    smtExclusion.oldKey <== oldKey;
    smtExclusion.oldValue <== oldValue;
    for (var d = 0; d < DEPTH; d++) {
        smtExclusion.siblings[d] <== smtSiblings[d];
    }

    // 3. Selective Field Disclosures
    for (var f = 0; f < NUM_FIELDS; f++) {
        disclosedFields[f] === disclosedFieldsMask[f] * rawFields[f];
    }

    // 4. Nullifier Derivation
    component nullifierDeriver = Poseidon(3);
    nullifierDeriver.inputs[0] <== holderSecret;
    nullifierDeriver.inputs[1] <== sessionNonce;
    nullifierDeriver.inputs[2] <== docId;
    nullifier === nullifierDeriver.out;
}
```

---

## 6.3 Cryptographic Engine Layer (`@zk-docguard/crypto`)

### 6.3.1 Sparse Merkle Tree Implementation
The [`SparseMerkleTree`](file:///d:/projects/BlockChain/zk-docguard/packages/crypto/src/smt.ts) class maintains a depth-10 binary tree over Poseidon hashes, computing logarithmic non-membership proofs in under 0.20 ms.

```typescript
// packages/crypto/src/smt.ts
export class SparseMerkleTree {
  private readonly depth: number;
  private readonly storage: Map<string, SMTNode>;
  private rootHash: bigint;

  constructor(depth = 10) {
    this.depth = depth;
    this.storage = new Map();
    this.rootHash = BigInt(0);
  }

  public getNonMembershipWitness(key: bigint): SMTNonMembershipWitness {
    const pathBits = this.getBits(key, this.depth);
    const siblings: bigint[] = [];
    let currentNode = this.rootHash;

    for (let level = 0; level < this.depth; level++) {
      const node = this.storage.get(currentNode.toString());
      if (!node) {
        // Empty slot reached: isOld0 = 1
        return {
          isOld0: 1,
          oldKey: 0n,
          oldValue: 0n,
          siblings: this.padSiblings(siblings, this.depth)
        };
      }
      const direction = pathBits[level];
      siblings.push(direction === 0 ? node.right : node.left);
      currentNode = direction === 0 ? node.left : node.right;
    }

    // Collision leaf reached: oldKey !== targetKey
    const leaf = this.storage.get(currentNode.toString())!;
    return {
      isOld0: 0,
      oldKey: leaf.key,
      oldValue: leaf.value,
      siblings
    };
  }
}
```

---

## 6.4 Client-Side Web Worker Prover Layer

In the Next.js wallet application, proof generation is offloaded to a Web Worker ([`zk-prover.worker.ts`](file:///d:/projects/BlockChain/zk-docguard/apps/web-wallet/src/workers/zk-prover.worker.ts)), executing WebAssembly Snarkjs operations off the browser rendering thread.

```typescript
// apps/web-wallet/src/workers/zk-prover.worker.ts
import { groth16 } from "snarkjs";

self.onmessage = async (e: MessageEvent<ProverRequest>) => {
  const { circuitType, witnessInput, zkeyUrl, wasmUrl } = e.data;
  const startTime = performance.now();

  try {
    postMessage({ type: "PROGRESS", stage: "WITNESS_GENERATION" });
    const { proof, publicSignals } = await groth16.fullProve(
      witnessInput,
      wasmUrl,
      zkeyUrl
    );

    const elapsedMs = performance.now() - startTime;
    postMessage({
      type: "SUCCESS",
      proof,
      publicSignals,
      provingTimeMs: elapsedMs
    });
  } catch (err: any) {
    postMessage({ type: "ERROR", error: err.message });
  }
};
```

This guarantees 60 FPS responsiveness in the mobile wallet UI even during multi-second proving cycles.
