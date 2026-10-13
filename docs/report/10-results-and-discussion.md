# Chapter 10: Results, Trade-Offs & Discussion

## 10.1 Trade-Off Analysis: Mode A vs. Mode B

A foundational design contribution of ZK-DocGuard is the dual-mode presentation architecture. By offering both **Mode A (Selective Disclosure with Direct Revocation)** and **Mode B (Zero-Knowledge Non-Revocation via Sparse Merkle Trees)**, the protocol allows relying parties and holders to negotiate the optimal balance between computational efficiency, bandwidth, and privacy.

### Table 10.1: Detailed Trade-Off Matrix Between Presentation Modes
| Evaluation Dimension | Mode A (`DiscloseModeA`) | Mode B (`DiscloseModeB`) | Architectural Implication |
| :--- | :--- | :--- | :--- |
| **Privacy Guarantee** | High (Pseudonymous) | Maximum (Zero-Knowledge) | Mode B conceals even the credential identifier from the verifier and the blockchain. |
| **Revocation Mechanism** | On-chain status check in `RevocationRegistry.sol` | In-circuit exclusion check against Merkle root | Mode A requires on-chain querying of `isRevoked(docHash)`. Mode B checks root $R$ in SNARK. |
| **Circuit Constraints** | 9,144 constraints | 12,933 constraints | Mode B requires +3,789 constraints (+41.4%) for the 10-level Poseidon tree verification. |
| **Proving Key Size** | 5.74 MB (`.zkey`) | 7.70 MB (`.zkey`) | Mode A saves 1.96 MB in initial client PWA asset download. |
| **WASM Prover Size** | 2.84 MB | 3.31 MB | Minor footprint difference (+466 KB for Mode B). |
| **Witness Generation** | Instantaneous (< 240 ms) | Requires SMT witness fetch (~695 ms network fetch) | Mode B requires an HTTP roundtrip to the Issuer API to retrieve 10 sibling hashes. |
| **Desktop Proving Time** | 841.2 ms | 801.7 ms | Statistically equivalent (both fit within $2^{14}$ Powers of Tau domain). |
| **Mobile Proving Time** | 2,397.4 ms | 2,284.8 ms | Both modes complete well under the 3-second interactive usability threshold. |
| **On-Chain Gas Cost** | 432,901 gas | 435,258 gas | Negligible delta (+2,357 gas for Mode B to validate the revocation root parameter). |

### Practical Deployment Guidance:
- **Use Mode A when**: The prover operates on a bandwidth-constrained network (e.g., edge IoT devices or rural cellular networks where downloading SMT witnesses is problematic) and where the credential ID itself is not a high-risk tracking vector.
- **Use Mode B when**: High-assurance anonymity is legally mandated (e.g., whistleblower credentials, medical status attestations, or anti-profiling employment checks) where verifiers must never learn which specific credential index was presented.

---

## 10.2 Gas Economics & Institutional Sustainability

A common failure mode of blockchain-based academic credentialing systems (such as early implementations of Blockcerts on Bitcoin or Ethereum L1) is operational cost unpredictability. When transaction fees fluctuate between $5.00 and $50.00 per document, public universities and national ministries cannot adopt the technology.

### 10.2.1 Economic Scaling Model
ZK-DocGuard resolves this economic barrier through two architectural vectors:
1. **Targeting Polygon PoS / Amoy**: Base transaction execution costs are orders of magnitude lower than Ethereum Mainnet while preserving identical EVM cryptographic precompiles (`0x06`, `0x07`, `0x08`).
2. **Merkle Batch Amortization**: Rather than committing individual document records to storage slots, issuers aggregate up to 100 credentials into a single Poseidon Merkle root via `DocumentRegistry.registerBatch`.

### Table 10.2: Institutional Cost Comparison (100,000 Credentials Issued Annually)
| System Architecture | Registration Model | Total Gas Consumed | Est. Annual Cost (POL @ $0.40) | Cost Per Student Diploma |
| :--- | :--- | :--- | :--- | :--- |
| **Ethereum L1 (Naive)** | Single `registerDocument` | 19,230,800,000 gas | $76,923.20 (at 10 Gwei) | $0.77 |
| **Polygon PoS (Naive)** | Single `registerDocument` | 19,230,800,000 gas | $230.77 (at 30 Gwei) | $0.0023 |
| **ZK-DocGuard (Batch 10)** | 10-Doc Poseidon Batches | 1,452,890,000 gas | $17.43 (at 30 Gwei) | $0.00017 |
| **ZK-DocGuard (Batch 100)**| 100-Doc Poseidon Batches | 145,301,000 gas | **$1.74 (at 30 Gwei)** | **$0.000017** |

By achieving a **99.2% gas reduction**, ZK-DocGuard enables a university issuing 100,000 degrees annually to anchor its entire graduating class onto a public, decentralized ledger for less than **$2.00 in total operational ledger fees**.

---

## 10.3 Synthesis Against State-of-the-Art Systems

Table 10.3 contextualizes ZK-DocGuard's empirical metrics against prior art documented in academic literature and production specifications.

### Table 10.3: Synthesis Matrix Against Existing Credential Frameworks
| Evaluation Criterion | Blockcerts (2016) | EBSI (2021) | Polygon ID (2023) | Semaphore (2022) | **ZK-DocGuard (Ours)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **On-Chain PII Storage** | Hash of cleartext PDF | DID Document hashes | Identity trees only | Nullifiers only | **Zero (Poseidon commitments)** |
| **Selective Disclosure** | No (Full PDF exposed) | Partial (via JSON-LD) | Yes (via Circom) | No (Group membership only)| **Yes (Arbitrary field masks)** |
| **ZKP Scheme** | None | None | Groth16 / Plonk | Groth16 | **Groth16 (BN254)** |
| **Revocation Proof** | On-chain lookup | StatusList2021 | Revocation Merkle Tree | Merkle Tree Exclusion | **Dual: On-Chain + SMT-10 SNARK** |
| **Gas Cost Per Doc** | ~190,000 gas | Off-chain | Variable | Variable | **1,453 gas (Batch 100)** |
| **Verification Gas** | N/A (Client check) | N/A (Off-chain) | ~450,000 gas | ~390,000 gas | **432,901 gas (Mode A) / 435,258 (Mode B)** |
| **Proving Time (Desktop)**| N/A | N/A | ~1.5 - 2.5 s | ~0.8 s | **0.80 s (Mode B) / 0.84 s (Mode A)** |
| **GDPR Art. 17 Ready** | Incompatible | Incompatible | Compliant | Compliant | **Provably Compliant** |

---

## 10.4 Operational Robustness & Lifecycle Governance

### 10.4.1 Issuer Key Rotation
In real-world institutional settings, cryptographic signing keys must be rotated periodically or revoked immediately upon suspected compromise. `IssuerRegistry.sol` provides an on-chain key rotation mechanism with built-in grace periods:
1. When an active issuer calls `rotateKey(newAx, newAy)`, the registry updates the authorized coordinates and records the timestamp.
2. Credentials issued under the prior key during its active validity window remain cryptographically verifiable, while newly issued credentials must bear signatures from the newly registered key.

### 10.4.2 Legal Compliance in Practice
By eliminating all identity hashes, names, and identifiers from blockchain calldata and event logs, ZK-DocGuard reconciles decentralized verification with European data protection jurisprudence. When a citizen requests account erasure under GDPR Article 17:
- The issuer deletes the holder's SQLite record and removes the IPFS pinning.
- No transaction rollback, block pruning, or hard forks are required on the underlying blockchain.
- Any subsequent presentation attempt by third parties fails because the cryptographic witnesses can no longer be retrieved.
