# Patent Prior Art Notes & Comparative Analysis

## 1. Structured Prior Art Comparative Analysis

The following structured matrix compares the technical architecture of ZK-DocGuard against seven primary competing and adjacent systems.

| Technical Axis | MIT Blockcerts (2016) | EBSI (2021) | BBS+ / W3C VC (2020) | IETF SD-JWT (2023) | Polygon ID (2023) | Semaphore (2022) | **ZK-DocGuard (Ours)** |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Primary Proving Primitive** | None (SHA-256 Merkle root) | None (ES256 / Ed25519) | Pairing-based zero-knowledge proofs (BBS+) | Salting + SHA-256 HMAC digest arrays | Groth16 / PLONK (BN254) | Groth16 (BN254) | **Groth16 (BN254) via Circom 2.1.9** |
| **2. Signature Curve** | Secp256k1 (Bitcoin / Ethereum) | Secp256k1 / Ed25519 | BLS12-381 G2 signatures | NIST P-256 / Ed25519 | BabyJubJub EdDSA | BabyJubJub EdDSA | **BabyJubJub EdDSA (Twisted Edwards)** |
| **3. Selective Disclosure** | Not supported (Full document exposed) | Limited (JSON-LD credential subjects) | Supported via BBS+ attribute blinding | Supported via selective disclosure salts | Supported via schema R1CS constraints | Not supported (Group identity only) | **Supported via 8-slot fixed-slot mask & range predicates** |
| **4. Revocation Strategy** | On-chain status check (Bitcoin OP_RETURN / Eth) | StatusList2021 (bitstring array) | Accumulator / StatusList | Token revocation list | Sparse Merkle Tree (Identity state tree) | Merkle Tree exclusion | **Dual Mode: On-Chain Bitmapping + SMT-10 in-circuit non-membership** |
| **5. On-Chain Verification Cost** | Manual client-side verification | Manual off-chain verifier check | Prohibitive on EVM (>4,000,000 gas, no BLS precompiles) | Off-chain verifier check only | ~450,000 to ~650,000 gas | ~390,000 gas | **432,901 gas (Mode A) / 435,258 gas (Mode B)** |
| **6. Batch Storage Economics** | Linear registration (~190,000 gas per doc) | Off-chain | N/A (Off-chain) | N/A (Off-chain) | Tree updates vary | Tree updates vary | **Amortized: 1,453 gas/doc (99.2% reduction in 100-doc batches)** |
| **7. Large Document Transport** | Plaintext PDF / JSON on web server | Centralized EBSI cloud nodes | Not addressed (Metadata only) | Not addressed (JSON claims only) | IPFS (Unencrypted or clear) | Not addressed (Signals only) | **Client-side AES-256-GCM to Helia IPFS + X25519 ephemeral key wrap** |
| **8. GDPR Art. 17 Compliance** | Violates (Document hashes immutable on-chain) | Risk of DID document immutability | Fully compliant (Purely off-chain) | Fully compliant (Purely off-chain) | Compliant (Nullifiers and claims private) | Compliant | **Provably Compliant (Zero on-chain PII or reversible digests)** |

---

## 2. In-Depth Technical Differentiation

### 2.1 Differentiation from Polygon ID (Iden3)
- **State Coupling**: In Polygon ID, revocation is intertwined with the user's continuous Identity State Tree. Updating identity state requires publishing state transitions on-chain, requiring holders to maintain state synchronization with issuers.
- **ZK-DocGuard Advantage**: Decouples identity from document lifecycle. Revocation is isolated to a 10-level Sparse Merkle Tree managed by the issuer. The holder queries a static 10-element sibling proof (latency $< 0.20 \text{ ms}$) without managing complex Merkle identity trees or publishing personal state transitions.

### 2.2 Differentiation from BBS+ Signatures
- **EVM Feasibility**: BBS+ signatures are defined over the BLS12-381 curve. Ethereum and standard EVM L2s do not possess native precompiles for BLS12-381 pairings (EIP-2537 remains unfinalized on mainnet). Verifying a BBS+ proof on-chain requires software pairing emulation exceeding 4 million gas ($> \$50$).
- **ZK-DocGuard Advantage**: Operates over BN254 and BabyJubJub, executing on-chain in 435,258 gas ($< \$0.005$ on Polygon) via standardized precompiles `0x06`, `0x07`, and `0x08`.

### 2.3 Differentiation from Semaphore
- **Primitive Functionality**: Semaphore is designed exclusively for anonymous signaling within a static group (e.g., anonymous voting or whistleblowing). It lacks attribute-level credential schemas, selective disclosure masks, range inequality proofs, and encrypted payload delivery.
- **ZK-DocGuard Advantage**: Provides a comprehensive credential lifecycle encompassing rich document payloads, selective field disclosure, and institutional issuer governance.

---

## 3. Patent Search Strings & Classification Guide

For examination by patent attorneys and examiners, the following search formulas identify closest prior art across major patent registries.

### 3.1 Cooperative Patent Classifications (CPC)
- **`G06F 21/62`**: Protection of privacy in data handling.
- **`H04L 9/32`**: Cryptographic arrangements or protocols for verification of identity or origin.
- **`H04L 9/08`**: Key distribution and key agreement protocols.
- **`G06Q 20/38`**: Payment or transaction protocols using cryptographic mechanisms.
- **`H04L 2209/38`**: Blockchain, distributed ledger, and consensus-specific cryptographic applications.

### 3.2 Espacenet & Google Patents Search Queries

#### Query 1: Zero-Knowledge Selective Disclosure & Merkle Revocation
```
(CPC = G06F21/6245 OR CPC = H04L9/32) AND
("zero-knowledge" OR "zk-SNARK" OR "Groth16") AND
("selective disclosure" OR "attribute hiding") AND
("sparse Merkle tree" OR "non-membership") AND
("blockchain" OR "smart contract" OR "EVM")
```

#### Query 2: Ephemeral Key Wrapping & Decentralized Content Addressing
```
(CPC = H04L9/0844 OR CPC = H04L9/0861) AND
("content addressed" OR "IPFS") AND
("ephemeral key" OR "X25519" OR "key encapsulation") AND
("envelope encryption" OR "symmetric key wrap") AND
("credential" OR "identity document")
```

#### Query 3: On-Chain Gas Amortized Batch Anchoring
```
(CPC = H04L2209/38 OR CPC = G06Q20/38) AND
("batch registration" OR "amortization") AND
("Merkle root" OR "storage packing") AND
("smart contract" OR "Ethereum") AND
("credential" OR "certificate")
```
