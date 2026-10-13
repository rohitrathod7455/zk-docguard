# Chapter 5: Technology Stack & Architectural Justifications

## 5.1 Architectural Layer Topology

The ZK-DocGuard architecture is decoupled into five distinct, specialized functional layers. Each layer is engineered to uphold the fundamental security, privacy, and performance invariants of the system: zero leakage of personally identifiable information (PII), sub-second client proving on consumer hardware, and sub-dollar on-chain verification costs on EVM networks.

```
+-----------------------------------------------------------------------------------+
|                        5. CLIENT PRESENTATION & WALLET LAYER                      |
| Next.js 15 (App Router) | React 19 | WebAssembly Prover (Web Workers) | Web Crypto|
+-----------------------------------------------------------------------------------+
                                          | JSON-RPC / REST / QR
+-----------------------------------------------------------------------------------+
|                         4. GATEWAY & MICROSERVICES LAYER                          |
| Fastify 5.x | TypeScript 5.6 | Prisma ORM 5.22 | SQLite WAL | Session Nonces      |
+-----------------------------------------------------------------------------------+
             |                                                  |
+---------------------------------------+  +----------------------------------------+
| 3. DECENTRALIZED STORAGE LAYER        |  | 2. DISTRIBUTED LEDGER & SMART CONTRACTS|
| Helia IPFS (CIDv1) | UnixFS           |  | Solidity 0.8.24 | Hardhat | EVM (Paris)|
| Client-Side AES-256-GCM Envelope Encr.|  | Polygon Amoy | EIP-197 EC Pairings     |
+---------------------------------------+  +----------------------------------------+
                                          |
+-----------------------------------------------------------------------------------+
|                        1. CRYPTOGRAPHIC PRIMITIVE LAYER                           |
| BN254 (alt_bn128) | Circom 2.1.9 | Snarkjs 0.7.5 | Groth16 | Poseidon Sponge T=3  |
| BabyJubJub Twisted Edwards Curve | EdDSA-Poseidon | Sparse Merkle Trees (SMT-10)  |
+-----------------------------------------------------------------------------------+
```

---

## 5.2 Cryptographic Primitive Layer

### 5.2.1 Pairing-Friendly Elliptic Curve: BN254 (`alt_bn128`)
ZK-DocGuard instantiates its zk-SNARK constraint systems over the BN254 pairing-friendly elliptic curve (also designated as `alt_bn128` in Ethereum Improvement Proposals). BN254 is defined by the Barreto-Naehrig family parameter $u = 496566136792884961$, yielding:

$$\text{Curve Equation: } y^2 = x^3 + 3 \pmod p$$

Where the base field order $p$ and scalar subgroup order $r$ are:
$$p = 21888242871839275222246405745257275088696311157297823662689037894645226208583$$
$$r = 21888242871839275222246405745257275088548364400416034343698204186575808495617$$

The embedding degree is $k = 12$, enabling optimal Ate pairings $e: \mathbb{G}_1 \times \mathbb{G}_2 \rightarrow \mathbb{G}_T$.

#### Justification Against Alternatives (BLS12-381, Secp256k1, Stark Curve)
1. **Native EVM Precompiles**: The Ethereum Virtual Machine natively provides precompiled contracts for BN254 operations under EIP-196 and EIP-197:
   - `0x06`: $\mathbb{G}_1$ addition (`ecAdd`, 150 gas)
   - `0x07`: $\mathbb{G}_1$ scalar multiplication (`ecMul`, 6,000 gas)
   - `0x08`: Bilinear pairing check (`ecPairing`, $45,000 + 34,000 \times k$ gas)
2. **Economic Viability**: Verifying a Groth16 proof requiring 3 bilinear pairings on BN254 incurs ~184,000 gas for the pairing operations and ~384,621 gas total execution overhead. In contrast, evaluating BLS12-381 pairings on an EVM chain without native precompiles requires non-native field simulation costing in excess of 4,000,000 gas—rendering on-chain smart contract verification economically prohibitive for enterprise credentialing.
3. **Security Level**: Although BN254 exhibits approximately 100 bits of security under modern Kim-Barbulescu tower number field sieve (TNFS) algorithms (compared to 128 bits for BLS12-381), this security margin exceeds the threat envelope for temporal credential validity, with zero practical attacks known against BN254 discrete logarithm instances.

### 5.2.2 SNARK Proving Protocol: Groth16
ZK-DocGuard utilizes Jens Groth's 2016 zero-knowledge proof construction (Groth16).

$$\text{Proof: } \pi = (A \in \mathbb{G}_1, B \in \mathbb{G}_2, C \in \mathbb{G}_1)$$

The verification equation evaluates a single pairing product:

$$e(A, B) = e(\alpha, \beta) \cdot e\left(\sum_{i=0}^l x_i \left[\frac{\beta u_i(x) + \alpha v_i(x) + w_i(x)}{\gamma}\right], \gamma\right) \cdot e(C, \delta)$$

#### Justification Against PLONK, Halo2, and STARKs
1. **Proof Compactness**: Groth16 yields exactly 3 group elements (2 in $\mathbb{G}_1$, 1 in $\mathbb{G}_2$), serializing to exactly 724 bytes. PLONK produces proofs between 1,200 and 2,400 bytes, while STARK proofs range from 45 KB to 250 KB.
2. **Minimal Verification Gas**: Groth16 requires exactly 3 pairings and $l$ elliptic curve scalar multiplications for public input accumulation. Standalone on-chain verification consumes only 384,621 gas on EVM. PLONK verification consumes ~450,000 to ~600,000 gas.
3. **Client Proving Speed**: Groth16 prover execution on BN254 achieves 801 ms proving latency on desktop and ~2,284 ms in mobile WebAssembly Web Workers, fitting comfortably within synchronous user checkout or presentation workflows.

### 5.2.3 Algebraic Hash Function: Poseidon
Credential hashing, Merkle tree construction, and signature digests utilize the Poseidon sponge hash function, instantiated over $\mathbb{F}_r$ with parameters $t = 3$ (rate = 2, capacity = 1), $R_F = 8$ full rounds, and $R_P = 57$ partial rounds.

#### Justification Against SHA-256 and Keccak-256
Bitwise cryptographic hash functions like SHA-256 and Keccak-256 decompose inputs into boolean bit arrays, requiring XOR, bit-shift, and modular arithmetic operations:
- **SHA-256**: Requires approximately 25,000 to 30,000 R1CS constraints per 512-bit block invocation.
- **Keccak-256**: Requires approximately 150,000 R1CS constraints per invocation.
- **Poseidon ($t=3$)**: Operates directly over the scalar field $\mathbb{F}_r$ using $S$-boxes of degree $\alpha = 5$ ($x^5$), requiring only **240 R1CS constraints** per two-element compression.
This represents a **100x to 600x constraint reduction**, enabling complex 10-level Sparse Merkle Tree non-membership proofs and multi-field credential hashing to execute inside circuits with fewer than 13,000 total constraints.

### 5.2.4 Embedded Curve and Signature Scheme: BabyJubJub & EdDSA
Identity attestation signatures are computed using the Twisted Edwards curve BabyJubJub, defined birationally over the scalar field $\mathbb{F}_r$ of BN254:

$$a x^2 + y^2 = 1 + d x^2 y^2$$

Where $a = 168700$ and $d = 168696$.

#### Justification Against ECDSA over Secp256k1
Verifying standard Ethereum ECDSA signatures inside a zk-SNARK requires non-native big-integer emulation over $\mathbb{F}_p$ for curve order $n_{\text{secp256k1}}$, consuming over 150,000 R1CS constraints. Because BabyJubJub's base field is isomorphic to BN254's scalar field $\mathbb{F}_r$, point addition and scalar multiplication require direct field operations in $\mathbb{F}_r$, evaluating EdDSA verification in **1,418 R1CS constraints**—a 99% reduction.

---

## 5.3 Smart Contract & Blockchain Infrastructure

### 5.3.1 Solidity 0.8.24 & OpenZeppelin v5
The smart contract registry layer is authored in Solidity 0.8.24 targeting the `paris` EVM specification:
- **Built-in Arithmetic Overflow Protection**: Eliminates SafeMath overhead while guaranteeing arithmetic safety.
- **Custom Errors**: Replaces long revert strings with 4-byte selector custom errors (e.g., `error IssuerNotActive()`, `error DocumentAlreadyRevoked()`), conserving bytecode and deployment gas.
- **OpenZeppelin Contracts v5.0**: Provides audited, hardened implementations for `OwnableUpgradeable`, `Pausable`, and reentrancy protections.

### 5.3.2 EVM Target Network: Polygon Amoy Testnet
ZK-DocGuard targets Polygon Amoy (and Polygon PoS in production), providing:
- Full EVM compatibility (supporting EIP-196/197 precompiles).
- Deterministic 2-second block finality.
- Sub-cent transaction execution fees (~0.0001 MATIC / POL per registration or verification), ensuring that high-throughput institutional batch registrations remain financially sustainable.

---

## 5.4 Decentralized Storage Layer: Helia IPFS

To decouple heavy payload storage from on-chain state, ZK-DocGuard implements off-chain content-addressed storage via Helia (the modern pure-TypeScript IPFS implementation):
- **CIDv1 Formatting**: Employs base32-encoded Content Identifiers (`bafy...`) ensuring DNS and URL safety.
- **Client-Side Envelope Encryption**: Raw document payloads (PDF transcripts, JPEG badges) are never written in plaintext to IPFS. Payloads are encrypted client-side using authenticated AES-256-GCM prior to Helia chunking.
- **UnixFS Data Dag**: Ensures high-throughput chunking and deterministic deduplication of credential schemas.

---

## 5.5 Backend API Gateway Layer: Fastify & Prisma

The microservices tier (`issuer-api`, `verifier-api`) is engineered with Fastify 5.x over Node.js 20 LTS:
- **Fastify**: Delivers high-throughput asynchronous request routing, schema-based JSON serialization via `fast-json-stringify`, and integrated lifecycle hooks for bearer authentication and rate limiting.
- **Prisma ORM 5.22 with SQLite WAL**: Houses off-chain metadata, issuer application queues, and active presentation sessions. SQLite configured with Write-Ahead Logging (`PRAGMA journal_mode=WAL`) enables concurrent non-blocking reads and writes without requiring external infrastructure for single-node deployments.

---

## 5.6 Frontend Client & Wallet Layer: Next.js 15 PWA

The citizen wallet interface (`web-wallet`) is constructed with Next.js 15 App Router and React 19:
- **Multi-Threaded Web Workers**: SNARK witness generation and Groth16 proving are offloaded to dedicated Web Workers, preventing user interface frame drops or thread locking during proof generation.
- **IndexedDB Key & Credential Vault**: Private BabyJubJub signing keys, master secrets, and issued credentials are encrypted at rest using AES-GCM-256 derived from user passphrases via PBKDF2 (100,000 iterations) or WebAuthn credentials.
- **Responsive Design System**: Implemented using pure Vanilla CSS tokens with high-contrast accessibility and dynamic theme toggling, free of utility bloat.
