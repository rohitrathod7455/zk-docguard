# Chapter 8: Security Analysis & Threat Model

## 8.1 STRIDE Threat Matrix

To evaluate the resilience of ZK-DocGuard across its lifecycle, we conduct a comprehensive threat analysis using Microsoft's STRIDE methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

| Threat Category | Potential Attack Vector | Attack Impact | Architectural Mitigation in ZK-DocGuard | Residual Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Forged credential presented with an unauthorized signature | Unearned credential acceptance | Circom SNARK circuit enforces BabyJubJub EdDSA signature verification against registered public key coordinates $(A_x, A_y)$ validated in `IssuerRegistry.sol`. | Negligible (discrete log security of BabyJubJub curve $\approx 100$ bits). |
| **Tampering** | Modification of credential fields (e.g., GPA, degree title) prior to presentation | Prover asserts fraudulent claims | In Circom circuits, raw attributes are hashed via Poseidon into message digest $M$. Signature verification fails if any attribute bit is altered. | None (Poseidon collision resistance). |
| **Repudiation** | Issuer denies having issued a fraudulent or erroneous credential | Lack of legal accountability | Digital signatures $\sigma = (R, S)$ are cryptographically bound to the issuer's registered BabyJubJub public key and published batch Merkle roots on Polygon. | None (unforgeability under chosen message attack). |
| **Information Disclosure** | Interception of credential data during presentation or correlation across verifiers | Identity leakage and PII profiling | Undisclosed fields remain private witnesses. Presentations generate one-time session-bound nullifiers $\mathcal{N} = \text{Poseidon}(s, nonce, docId)$, preventing cross-verifier linkability. | None (Groth16 perfect zero-knowledge). |
| **Denial of Service** | Gas griefing via spam submissions to `VerifierGateway.consumeAndVerify` | Contract execution stalls or drains verifier balance | Off-chain API gateway rate-limits proof submissions and enforces session nonce pre-validation before invoking on-chain transactions. | Minimal (mitigated by rate limiting and captcha). |
| **Elevation of Privilege** | Malicious actor applies and self-approves as an accredited issuer | Unauthorized authority to sign valid credentials | Two-phase governance in `IssuerRegistry.sol`: application requires institutional stake/review, and approval is restricted to contract multisig owner. | None (EVM role-based access control). |

---

## 8.2 Trust Boundaries & Attack Surfaces

The ZK-DocGuard architecture defines four distinct trust boundaries:

```
[ HOLDER ENVIRONMENT (Untrusted Mobile/Web PWA) ]
      ||
      || Boundary 1: TLS 1.3 / Authenticated API
      \/
[ ISSUER INFRASTRUCTURE (Fastify / SQLite) ] <--- Boundary 4 ---> [ IPFS (Content Addressed) ]
      ||
      || Boundary 2: Session Nonce / Ephemeral X25519
      \/
[ VERIFIER INFRASTRUCTURE (Fastify / SQLite) ]
      ||
      || Boundary 3: JSON-RPC / Polygon Amoy Transactions
      \/
[ EVM BLOCKCHAIN (Decentralized Consensus Layer) ]
```

### Boundary 1: Holder Client $\leftrightarrow$ Issuer Gateway
- **Threat**: Interception of newly issued credentials in transit.
- **Mitigation**: All issuance channels require TLS 1.3. Credentials are encrypted directly to the holder's public key prior to distribution.

### Boundary 2: Holder Client $\leftrightarrow$ Verifier Gateway
- **Threat**: Verifier intercepts and replays holder proofs to an upstream relying party (e.g., impersonating the holder to a bank).
- **Mitigation**: Every presentation proof ingests an active, short-lived `sessionNonce` issued by the specific verifier. In `VerifierGateway.sol`, the resulting nullifier $\mathcal{N} = \text{Poseidon}(s_H, sessionNonce, docId)$ is consumed atomically. If a verifier attempts to replay the proof elsewhere, the challenge nonce will not match the target party's challenge, causing instant on-chain rejection.

### Boundary 3: Verifier Gateway $\leftrightarrow$ Smart Contracts
- **Threat**: Transaction front-running or miner extraction of pending verification transactions.
- **Mitigation**: The Groth16 proof contains no sensitive cleartext data, and the nullifier is deterministic. Even if front-run, the nullifier becomes consumed on-chain, achieving the verification outcome without revealing private inputs.

### Boundary 4: Issuer/Holder $\leftrightarrow$ Helia IPFS
- **Threat**: Eavesdropping on public IPFS DHT nodes to harvest credential documents.
- **Mitigation**: ZK-DocGuard enforces client-side envelope encryption. Payloads are encrypted with authenticated symmetric AES-256-GCM prior to Helia chunking. Plaintext is never placed onto IPFS nodes.

---

## 8.3 Attack Trees & Empirical Mitigations

### 8.3.1 Attack Tree 1: Proof Replay & Front-Running
```
Goal: Impersonate Holder by Replaying a Valid Proof
|
+--- 1. Intercept Proof π from Verifier Network Traffic
|     +--- 2. Submit π to Another Verifier
|           |--> Fails: Session nonce mismatch (π is bound to Verifier A's nonce)
|
+--- 3. Resubmit π to the Same Verifier
      +--- 4. Invoke VerifierGateway.consumeAndVerify
            |--> Fails: consumedNullifiers[nullifier] reverts with NullifierAlreadyConsumed
```

### 8.3.2 Attack Tree 2: Low-Entropy Field Dictionary Attacks
- **Vulnerability**: If an attribute such as `birthYear` has a narrow search space (e.g., 1950–2010 = 60 values), an attacker observing a public Poseidon commitment could precompute a rainbow table of all 60 hashes and de-anonymize the holder.
- **Mitigation**: ZK-DocGuard implements **cryptographic salt blinding**. The document digest computation integrates an entropy-dense 253-bit `holderSecret`:

$$M = \text{Poseidon}(docId, holderSecret, attribute_1, \dots, attribute_n)$$

Because `holderSecret` possesses $> 250$ bits of min-entropy, rainbow table generation requires $2^{250}$ Poseidon evaluations, rendering brute-force dictionary inversion mathematically infeasible.

### 8.3.3 Attack Tree 3: Revocation Race Condition
- **Vulnerability**: A revoked holder attempts to present a credential before the verifier updates its local revocation state.
- **Mitigation**: In Presentation Mode B, the verifier gateway queries `RevocationRegistry.sol` to fetch the current active Merkle root $R_{current}$ directly from the canonical chain state. The circuit enforces that the exclusion proof matches $R_{current}$. Once an issuer submits an updated root on-chain (latency $< 2$ seconds on Polygon), all stale non-revocation witnesses fail immediately.

---

## 8.4 Cryptographic Hardness Assumptions

ZK-DocGuard's security invariants rest upon well-established cryptographic assumptions:
1. **Computational Diffie-Hellman (CDH) & Discrete Logarithm**: Assumed hard over the subgroup of prime order $r$ on the BN254 curve and $\ell$ on the BabyJubJub curve.
2. **Knowledge-of-Exponent Assumption (KEA)**: Underlies Groth16 knowledge soundness, ensuring a prover cannot output an acceptable proof without possessing the underlying witness polynomials.
3. **Algebraic Collision Resistance of Poseidon**: Assumed hard against algebraic attacks (Gröbner basis computation) due to the combination of $R_F = 8$ full non-linear rounds and $R_P = 57$ partial rounds over $\mathbb{F}_r$.
