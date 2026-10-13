# ZK-DocGuard STRIDE Threat Model & Security Architecture

**Version:** 1.0  
**Status:** Approved (Phase 10 Security Review)  
**Standard:** Microsoft STRIDE Threat Classification & OWASP Security Assessment  
**Target Systems:** Monorepo `@zk-docguard/*` (Smart Contracts, Circom Circuits, API Services, PWA Holder Wallet, Verifier Gateway)

---

## 1. System Overview & Context

ZK-DocGuard is a decentralized, privacy-preserving credential issuance, verification, and document anchoring framework. It uses:
- **On-chain smart contracts:** `IssuerRegistry`, `DocumentRegistry`, `RevocationRegistry`, and `VerifierGateway`.
- **Zero-knowledge circuits:** `DiscloseModeA.circom` (Groth16 selective disclosure over Poseidon attribute trees) and `DiscloseModeB.circom` (in-circuit Sparse Merkle Tree non-membership proving).
- **Client-side cryptography:** EdDSA over BabyJubJub, Poseidon hashing, AES-256-GCM envelope encryption, and ephemeral X25519 key wrapping.
- **Off-chain persistence:** IPFS (content-addressed encrypted payloads), PostgreSQL (indexing and session coordination), and Fastify API.

```
+-----------------------------------------------------------------------------------+
|                                  TRUST BOUNDARY 1                                 |
|  [Holder Device / PWA Wallet]                                                     |
|    - BabyJubJub Identity Seed & Private Key (IndexedDB + WebCrypto AES-GCM)       |
|    - In-Browser SNARK Prover (Web Worker + snarkjs + BN254)                       |
+--------------------------^-----------------------------+--------------------------+
                           | QR Challenge / SSE          | Presentation Proof
                           v                             v
+-----------------------------------------------------------------------------------+
|                                  TRUST BOUNDARY 2                                 |
|  [Fastify API & Gateway Server]                                                   |
|    - Verification Sessions (UUIDv4, Nonce, Domain-Bound Challenge)                |
|    - SMT Exclusion Witness Service (10-level Circomlib Sparse Merkle Tree)        |
|    - Ephemeral Key-Wrapping Relay (X25519 authenticated share exchange)          |
+--------------------------^-----------------------------+--------------------------+
                           | Read Registry State         | Verify Proof On-Chain
                           v                             v
+-----------------------------------------------------------------------------------+
|                                  TRUST BOUNDARY 3                                 |
|  [Ethereum / EVM Blockchain Layer]                                                |
|    - IssuerRegistry.sol (Authorized DIDs & ZK Key Hashes)                         |
|    - RevocationRegistry.sol (On-chain bit-flags & SMT Root History Ring Buffer)   |
|    - VerifierGateway.sol (Groth16 Verifiers Mode A & Mode B)                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Protected Assets & Security Objectives

| Asset ID | Asset Description | Security Objective | Criticality |
|---|---|---|---|
| **A-1** | Holder Identity Secret ($s_{holder}$) | Confidentiality: Must never leave holder memory or sandbox. | Critical |
| **A-2** | Issuer Signing Key ($sk_{issuer}$) | Confidentiality & Integrity: Single-source credential authenticity. | Critical |
| **A-3** | Raw Document Contents (PDF/JSON) | Confidentiality: Encrypted at rest (AES-256-GCM) on IPFS; never stored plaintext off-device. | High |
| **A-4** | Undisclosed Credential Attributes | Confidentiality & Unlinkability: Zero-knowledge protection against verifiers. | High |
| **A-5** | Credential Revocation State | Integrity: Instant, non-forgeable revocation recognition. | High |
| **A-6** | Verifier Session Challenges | Integrity & Non-Replay: Nonces bound to verifier domain and timestamps. | Medium |
| **A-7** | On-Chain Registry Integrity | Integrity & Availability: Decentralized immutability via EVM consensus. | Critical |

---

## 3. Threat Actor Profiles

1. **Malicious Verifier:** Wants to correlate holder presentations across sessions, unmask hidden attributes, or replay presentations to impersonate the holder.
2. **Rogue / Compromised Issuer:** Tries to issue fraudulent credentials, backdate issuances, or repudiate historical commitments.
3. **Colluding Holders:** Holder A attempts to share their credential with Holder B to allow Holder B to pass verification checks without qualifying.
4. **Network Man-in-the-Middle (MitM):** Observes or tampers with traffic between Wallet, Verifier, and API service.
5. **Malicious Blockchain Node / MEV Searcher:** Front-runs revocation transactions or replays on-chain gateway transactions.
6. **Compromised IPFS Gateway:** Attempts to serve tampered ciphertexts or inspect payload metadata.

---

## 4. STRIDE Threat Analysis Matrix

| STRIDE Category | Threat ID | Threat Description | Affected Component | Severity | Mitigation Status |
|---|---|---|---|---|---|
| **Spoofing** | T-S1 | Forged credential issued by unauthorized entity | Core / Contracts | High | Mitigated (`IssuerRegistry` on-chain verification) |
| **Spoofing** | T-S2 | Sybil holder presenting another holder's credential | Circuit / Wallet | Critical | Mitigated (In-circuit Holder Commitment binding) |
| **Tampering** | T-T1 | Modification of hidden attribute values in presentation | Circuit (BN254) | Critical | Mitigated (Cryptographic Poseidon Merkle Proof) |
| **Tampering** | T-T2 | Alteration of public signals during transit | API / Gateway | High | Mitigated (Groth16 mathematical pair checks) |
| **Repudiation** | T-R1 | Issuer denies having issued a valid credential | Contracts / IPFS | Medium | Mitigated (On-chain anchoring & BabyJubJub EdDSA signature) |
| **Repudiation** | T-R2 | Verifier denies issuing a valid verification receipt | API / Verifier | Low | Mitigated (HMAC-SHA256 timestamped signed receipt) |
| **Information Disclosure** | T-I1 | Verifier cross-session tracking via `credentialId` | Verifier / Circuit | High | Mitigated (Mode B anonymous SMT non-membership proof) |
| **Information Disclosure** | T-I2 | IPFS ciphertext inspection or CID correlation | IPFS / Crypto | High | Mitigated (AES-256-GCM per-document random keys) |
| **Information Disclosure** | T-I3 | Extraction of holder private key via XSS | Web Wallet | Critical | Mitigated (IndexedDB PBKDF2/AES-GCM encryption & CSP) |
| **Denial of Service** | T-D1 | Flooding verification sessions to exhaust API | API | Medium | Mitigated (TTL session expiry & rate limits) |
| **Denial of Service** | T-D2 | IPFS pinning loss causing document unavailability | Storage / IPFS | Medium | Mitigated (Pinata pinning redundancy fallback) |
| **Elevation of Privilege**| T-E1 | Unauthorized revocation of another issuer's credential| API / Contracts | Critical | Mitigated (`onlyOwner` / `onlyIssuer` role checks) |

---

## 5. In-Depth Threat Scenarios & Technical Mitigations

### 5.1 Forged Issuer (T-S1)
- **Threat Vector:** An attacker signs arbitrary credentials using a generated BabyJubJub key and presents them to a verifier.
- **Mitigation:**
  1. The circuit requires `issuerPublicKey` as a private witness and outputs `issuerKeyHash = Poseidon(Ax, Ay)` as a public signal.
  2. The verifier (and `VerifierGateway.sol`) validates `issuerKeyHash` against `IssuerRegistry.sol`.
  3. If the issuer key hash is not active in the on-chain registry, verification unconditionally fails with `UNTRUSTED_ISSUER`.

### 5.2 Replay Attacks & Cross-Verifier Collusion (T-S2, T-T2)
- **Threat Vector:** Verifier A receives a valid selective-disclosure proof from Alice and attempts to submit it to Verifier B to impersonate Alice.
- **Mitigation:**
  1. Sessions generate a single-use random challenge $\mathcal{C} = \text{Poseidon}(\text{nonce}, \text{stringToField}(\text{domain}))$.
  2. The circuit includes `challenge` as a public signal and verifies in-circuit:
     $$\text{challenge} \times (\text{challenge} - \text{inputChallenge}) = 0$$
  3. On-chain, `VerifierGateway.sol` maintains `mapping(uint256 => bool) public usedChallenges;` and reverts on reused challenges.
  4. Timestamp tolerance window $\pm 300\text{s}$ prevents delayed presentation injection.

### 5.3 Credential Sharing Between Holders (Collusion) (T-S2)
- **Threat Vector:** Alice qualifies for an honors credential and shares the VC JSON with Bob. Bob tries to generate a presentation proof in his wallet.
- **Mitigation:**
  1. During issuance, the credential commits to Alice's holder commitment $C_{holder} = \text{Poseidon}(s_{holder}, \text{salt})$ as slot index 0.
  2. Proving requires knowledge of $s_{holder}$ satisfying the commitment.
  3. Unless Alice shares her entire identity private key (which grants total control over all her credentials and wallet identities), Bob cannot generate a valid Groth16 witness.

### 5.4 Malicious Verifier Linkage (T-I1)
- **Threat Vector:** In Mode A, `credentialId` is published in public signals. Verifiers can collaborate to track where and when a holder uses their credential.
- **Mitigation:**
  1. **Mode B Architecture:** In `DiscloseModeB.circom`, `credentialId` is private.
  2. Revocation non-membership is proven in-circuit using a 10-level Sparse Merkle Tree (`SMTVerifier(10)`).
  3. Verifiers receive only the issuer's anonymous revocation root and cannot correlate sessions to a physical identity or credential index.

### 5.5 Mempool Front-Running & MEV (T-T2, T-E1)
- **Threat Vector:** An attacker monitors the Ethereum mempool for a pending revocation or verification transaction and attempts to front-run it.
- **Mitigation:**
  1. Revocations are keyed to `msg.sender == issuerAddress`. Front-runners submitting the same calldata cannot impersonate the issuer address.
  2. Verification presentations are bound to unique per-verifier session nonces, rendering front-run proof extraction useless for any other verifier address or domain.

### 5.6 Issuer Key Compromise & Key Epochs (T-S1, T-E1)
- **Threat Vector:** An issuer's BabyJubJub signing key is compromised.
- **Mitigation:**
  1. `IssuerRegistry.sol` supports explicit key rotation with epoch counters: `rotateIssuerKey(newKeyHash)`.
  2. Historical credentials issued under prior keys remain valid within a defined grace period or can be revoked en masse by marking the epoch inactive.
  3. On key revocation, the contract updates `zkKeyHash` and emits `IssuerKeyRotated`.

### 5.7 Trusted-Setup Toxic Waste (T-T1)
- **Threat Vector:** Compromised toxic waste in Groth16 CRS setup could allow forgery of arbitrary proofs.
- **Mitigation:**
  1. Phase 1 Powers of Tau ceremony utilized the perpetual Hermez BN254 multi-party computation ceremony (over 54 independent contributors).
  2. Phase 2 circuit-specific setup generates verifiable entropy with reproducible verification hashes committed in `packages/circuits/build/`.
  3. Verification keys and circuit constraints are cross-verified by both TypeScript (`snarkjs`) and Solidity verifiers (`Groth16Verifier.sol`).

### 5.8 IPFS Availability & Ciphertext Enumeration (T-I2, T-D2)
- **Threat Vector:** Attackers scrape the IPFS DHT for CIDs and attempt to decipher or delete stored documents.
- **Mitigation:**
  1. All payloads stored on IPFS are wrapped in AES-256-GCM ciphertexts with 96-bit random IVs and 128-bit authentication tags.
  2. CIDs point exclusively to opaque binary blobs; zero plaintext metadata or student identifiers are embedded in the IPFS IPLD object.
  3. Redundant pinning strategy: local Kubo gateway supplemented by Pinata pinning cluster.

### 5.9 XSS Against Wallet & Session Fixation (T-I3, T-D1)
- **Threat Vector:** Cross-Site Scripting attack against the holder web wallet attempting to exfiltrate private keys.
- **Mitigation:**
  1. Strict Content Security Policy (CSP) eliminating inline scripts (`script-src 'self'`).
  2. Zero raw key persistence: identity keys are derived via PBKDF2/WebCrypto and stored encrypted in IndexedDB.
  3. Proving operations execute in an isolated Web Worker context, decoupling cryptographic evaluation from main-thread DOM manipulation.
  4. API session cookies use `httpOnly; SameSite=Strict; Secure; Path=/` with HMAC-SHA256 signing (`sealSession`), preventing JavaScript cookie extraction.

### 5.10 Supply-Chain & Dependency Risks
- **Threat Vector:** Malicious dependency injection in `npm` packages compromising cryptographic primitives.
- **Mitigation:**
  1. Strict dependency pinning via `pnpm-lock.yaml`.
  2. Cryptographic operations rely strictly on audited libraries: `@noble/curves`, `@noble/hashes`, and `circomlibjs`.
  3. Automated `pnpm audit` gate in CI pipeline.

---

## 6. Residual Risks & Future Architectural Hardening

| Residual Risk | Severity | Accepted Rationale | Future Hardening Roadmap (Phase 12) |
|---|---|---|---|
| **Client Device Compromise** | Medium | If the holder's OS has rootkits or memory dumpers, active in-memory keys can be compromised. | Mobile Secure Enclave / Hardware Key (WebAuthn) backing. |
| **Groth16 Proof Malleability** | Low | Groth16 proofs can be altered without invalidating pairings if public signals are unchanged. | Controlled on-chain by `usedChallenges` preventing duplicate presentation processing. |
| **Circuit Scale Limitations** | Low | Depth-10 SMT accommodates 1,024 revocations per tree before rehashing. | Dynamic depth extension or PLONK/Halo2 recursive proof trees. |

---

## 7. Security Conclusion

The ZK-DocGuard architecture adheres to defense-in-depth principles across all three operational layers. By combining on-chain immutable registries, mathematical zero-knowledge privacy gates, and authenticated ephemeral key-wrapping, the system eliminates single points of failure and prevents cross-session identity correlation.
