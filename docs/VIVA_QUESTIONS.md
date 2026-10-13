# Comprehensive Academic Viva Examination Questions & Model Answers

**Project Title:** ZK-DocGuard: A Privacy-Preserving Blockchain Document Verification and Selective Disclosure Framework Using Zero-Knowledge Proofs and Self-Sovereign Identity  
**Scope:** Applied Cryptography, Distributed Systems, EVM Smart Contracts, Zero-Knowledge Circuits, Information Security, and Data Privacy Jurisprudence.

---

## Domain 1: System Architecture & Design Philosophy (Questions 1–6)

### Q1: What fundamental conflict does ZK-DocGuard address that legacy blockchain credentialing systems fail to resolve?
**Model Answer:**  
Legacy blockchain credentialing systems (such as early MIT Blockcerts implementations) commit document hashes or student identifiers directly to public, immutable distributed ledgers. This creates an irreconcilable conflict known as the **Blockchain Privacy Paradox**:
1. Once a hash or identity string is committed on-chain, it remains permanently accessible to all network observers.
2. Under modern privacy statutes—specifically European Union GDPR Article 17 ("Right to be Forgotten")—data subjects have a legal right to request erasure of their personal information. Because public blockchains cannot prune or overwrite historic blocks without hard forks, anchoring identifiable hashes directly on-chain constitutes an ongoing regulatory violation.
3. Multiple presentations of the same static hash across distinct relying parties allow passive observers to correlate user activity and reconstruct their real-world interaction graphs.

ZK-DocGuard resolves this paradox by guaranteeing that **zero personally identifiable information (PII), cleartext documents, or static reversible identifiers are ever stored on-chain**. The blockchain maintains only issuer public key registrations, aggregate batch Merkle roots, and dynamic Sparse Merkle Tree revocation roots. Verification occurs via zero-knowledge proofs (zk-SNARKs) that prove credential validity and non-revocation off-chain, submitting only single-use session nullifiers to the ledger.

---

### Q2: Why did you choose a monorepo topology with pnpm workspaces and Turborepo?
**Model Answer:**  
The ZK-DocGuard codebase spans heterogeneous development environments: Circom domain-specific language for circuit constraints, Solidity for smart contracts, TypeScript for cryptographic utilities and SDKs, Fastify for backend microservices, and React/Next.js for the client wallet. A monorepo architecture managed via `pnpm` workspaces and `Turborepo` delivers:
1. **Strict Boundary Enforcement**: Packages maintain isolated `package.json` definitions. For example, `@zk-docguard/contracts` cannot accidentally import client-side UI libraries.
2. **Deterministic Artifact Sharing**: Compiled circuit verification keys (`vkey.json`), contract ABIs, and TypeScript types are generated once and directly consumed by `@zk-docguard/sdk` and the backend services without error-prone copy-pasting.
3. **Optimized Build Pipelines**: Turborepo caches task pipelines (e.g., `build`, `test`, `lint`, `typecheck`), allowing incremental builds across the 8 workspaces and ensuring that changes to circuit source files trigger appropriate re-compilations downstream.

---

### Q3: What is the architectural role of the Verifier Gateway contract (`VerifierGateway.sol`)?
**Model Answer:**  
Rather than requiring verifiers to deploy individual verification contracts or execute ad-hoc cryptographic verifications, `VerifierGateway.sol` acts as a centralized, canonical on-chain mediator that:
1. **Verifies Proof Validity**: Dispatches incoming Groth16 proofs to `Groth16Verifier.sol` (Mode A) or `Groth16VerifierModeB.sol` (Mode B).
2. **Enforces Key Registration**: Validates that the public key coordinates $(A_x, A_y)$ embedded in public signals 1 and 2 belong to an active, accredited issuer registered in `IssuerRegistry.sol`.
3. **Validates Revocation Roots**: For Mode B proofs, ensures that the revocation root in signal 3 matches an active root recorded in `RevocationRegistry.sol`.
4. **Guarantees Replay Protection**: Stores consumed session nullifiers in a persistent mapping (`mapping(bytes32 => bool)`), atomically reverting if an identical nullifier is resubmitted.
5. **Emits Audit Events**: Emits an immutable `ProofVerified(nullifier, issuer, mode)` event, providing relying parties with non-repudiable on-chain proof of verification.

---

### Q4: Explain the difference between Presentation Mode A and Presentation Mode B.
**Model Answer:**  
- **Mode A (Selective Disclosure with Direct Revocation)**: The prover generates a 9,144-constraint Groth16 proof validating the issuer's EdDSA signature and selective field disclosures. Revocation status is verified by looking up the document status on-chain in `RevocationRegistry.sol`. This mode minimizes circuit constraints and client memory footprint, but requires referencing the credential on-chain.
- **Mode B (Zero-Knowledge Non-Revocation via Sparse Merkle Trees)**: The prover generates a 12,933-constraint proof that incorporates an in-circuit depth-10 Sparse Merkle Tree (SMT) exclusion verification. The prover demonstrates that their `docId` is excluded from the issuer's active on-chain revocation root without disclosing the `docId` to the verifier or the blockchain. This provides complete mathematical unlinkability and maximum privacy at the cost of downloading a 10-element witness.

---

### Q5: How does the system handle off-chain document storage without violating data confidentiality?
**Model Answer:**  
Large credential payloads (e.g., official diploma PDFs, medical transcripts) are handled via a **two-tier content addressing model**:
1. In the client wallet, the document payload is encrypted client-side using authenticated symmetric encryption (AES-256-GCM) under a randomly generated 256-bit symmetric document key $K_{\text{doc}}$.
2. The resulting ciphertext is anchored to the InterPlanetary File System (IPFS) via Helia, producing an immutable Content Identifier (CIDv1 base32).
3. The CID and ciphertext can be safely replicated across public IPFS pinning nodes because the payload is cryptographically indecipherable without $K_{\text{doc}}$.
4. Cleartext documents are never transmitted over the wire or stored on backend servers.

---

### Q6: How does the Verifier receive access to underlying documents when an audit is required?
**Model Answer:**  
When selective disclosure is insufficient and the relying party must inspect the source document, ZK-DocGuard executes an **Ephemeral Key Wrapping Protocol**:
1. The verifier generates a short-lived X25519 keypair $(sk_V, pk_V)$ and transmits $pk_V$ alongside a challenge session.
2. The holder generates an ephemeral X25519 keypair $(sk_H, pk_H)$, computes the shared Diffie-Hellman secret, and derives a Key Encryption Key ($KEK$) using HKDF-SHA256.
3. The holder wraps $K_{\text{doc}}$ using ChaCha20-Poly1305 with an embedded expiration timestamp:
$$\text{WrappedKey} = \text{ChaCha20-Poly1305}(KEK, K_{\text{doc}})$$
4. The verifier unwraps $K_{\text{doc}}$ using their private key $sk_V$ and fetches the ciphertext from IPFS, decrypting it locally. Once the session expires, the ephemeral keys are discarded, preventing persistent access.

---

## Domain 2: Applied Cryptography & Elliptic Curves (Questions 7–15)

### Q7: Why did you choose the BN254 elliptic curve instead of BLS12-381?
**Model Answer:**  
While BLS12-381 offers ~128 bits of cryptographic security (compared to ~100 bits for BN254 under modern tower number field sieve algorithms), BN254 is the only pairing-friendly elliptic curve natively supported by Ethereum Virtual Machine precompiled contracts under EIP-196 and EIP-197:
- `0x06`: $\mathbb{G}_1$ point addition (`ecAdd`, 150 gas)
- `0x07`: $\mathbb{G}_1$ scalar multiplication (`ecMul`, 6,000 gas)
- `0x08`: Bilinear pairing evaluation (`ecPairing`, $45,000 + 34,000 \times k$ gas)

Verifying a Groth16 proof on BN254 requires 3 bilinear pairings and consumes ~384,621 gas on EVM. In contrast, verifying BLS12-381 on an EVM chain requires emulating non-native modular field arithmetic in software, consuming over 4,000,000 gas per verification. Thus, BN254 was selected because it enables economically viable, sub-dollar on-chain verification on public blockchains.

---

### Q8: What is BabyJubJub, and why is it used for issuer signatures instead of Secp256k1?
**Model Answer:**  
BabyJubJub is a twisted Edwards curve defined by:
$$168700 x^2 + y^2 = 1 + 168696 x^2 y^2$$
Crucially, its base field is isomorphic to the **scalar field $\mathbb{F}_r$ of the BN254 curve**.
If we attempted to verify standard Ethereum Secp256k1 ECDSA signatures inside a Circom SNARK circuit, the circuit would have to emulate 256-bit non-native arithmetic across mismatched prime fields, requiring over 150,000 R1CS constraints per signature. Because BabyJubJub curve operations execute natively over $\mathbb{F}_r$, an EdDSA signature verification circuit requires only **1,418 R1CS constraints**—a 99% reduction that enables sub-second client proving.

---

### Q9: Why is the Poseidon hash function used rather than SHA-256 or Keccak-256?
**Model Answer:**  
Standard cryptographic hash functions (SHA-256, Keccak-256) are designed for efficient hardware execution using bitwise operations (XOR, bitwise rotations, AND). When represented as arithmetic circuits over a large prime field $\mathbb{F}_r$, every bitwise operation requires decomposing field elements into boolean constraints:
- SHA-256 requires ~25,000 to ~30,000 R1CS constraints per 512-bit compression block.
- Keccak-256 requires ~150,000 R1CS constraints.

Poseidon is an algebraic sponge hash function designed specifically for zero-knowledge proof systems. It operates directly over $\mathbb{F}_r$ elements using high-degree non-linear permutations ($S$-boxes $x^5$) and Maximum Distance Separable (MDS) matrix multiplications. Parameterized with state width $t = 3$, rate $r = 2$, capacity $c = 1$, $R_F = 8$, and $R_P = 57$, a 2-to-1 Poseidon hash consumes only **240 R1CS constraints**—over 100 times fewer constraints than SHA-256.

---

### Q10: What are the three group elements in a Groth16 proof, and what is the exact proof size?
**Model Answer:**  
A Groth16 proof $\pi$ consists of exactly three elliptic curve group elements:
$$\pi = (A \in \mathbb{G}_1, B \in \mathbb{G}_2, C \in \mathbb{G}_1)$$
On the BN254 curve:
- $A \in \mathbb{G}_1$ is represented by coordinates $(x, y) \in \mathbb{F}_p^2$ (2 field elements = 64 bytes uncompressed, or 32 bytes compressed).
- $B \in \mathbb{G}_2$ is represented by coordinates in the quadratic extension field $\mathbb{F}_{p^2}$ (4 field elements = 128 bytes uncompressed, or 64 bytes compressed).
- $C \in \mathbb{G}_1$ is represented by coordinates $(x, y) \in \mathbb{F}_p^2$ (2 field elements = 64 bytes uncompressed, or 32 bytes compressed).

Serialized in standard uncompressed affine representation along with JSON formatting or ABI encoding, the proof structure is exactly **724 bytes** (or 256 bytes in packed binary representation).

---

### Q11: Explain the verification equation of the Groth16 protocol.
**Model Answer:**  
The Groth16 verifier checks whether the following bilinear pairing equality holds over the Ate pairing $e: \mathbb{G}_1 \times \mathbb{G}_2 \rightarrow \mathbb{G}_T$:

$$e(A, B) = e(\alpha, \beta) \cdot e\left(\sum_{i=0}^l x_i \cdot \frac{\beta u_i(x) + \alpha v_i(x) + w_i(x)}{\gamma}, \gamma\right) \cdot e(C, \delta)$$

In the EVM smart contract, to minimize gas, the equation is rearranged to equal $1 \in \mathbb{G}_T$:
$$e(-A, B) \cdot e(\alpha, \beta) \cdot e(IC_0 + \sum_{i=1}^l x_i IC_i, \gamma) \cdot e(C, \delta) = 1$$
This is submitted to precompile `0x08` as a single 4-pairing batch call. If the product of pairings equals 1 in $\mathbb{G}_T$, the proof is mathematically valid; otherwise, the precompile call returns 0.

---

### Q12: What is the purpose of the `holderSecret` and how does it prevent dictionary attacks?
**Model Answer:**  
Many credential attributes have narrow, low-entropy domains. For instance, a `birthYear` attribute has approximately 80 possible values (1940–2020), and a `gradePointAverage` attribute has ~400 values. If an issuer computed a commitment directly over attributes:
$$M = \text{Poseidon}(docId, attribute)$$
An attacker observing the public commitment could precompute the Poseidon hash for all 80 possible birth years in milliseconds, completely de-anonymizing the holder.
To prevent this, ZK-DocGuard binds an entropy-dense **253-bit random scalar `holderSecret`** into the initial credential commitment:
$$M = \text{Poseidon}(docId, holderSecret, attr_1, \dots, attr_8)$$
Because `holderSecret` possesses $> 250$ bits of min-entropy, inverting or dictionary-attacking the commitment requires $2^{250}$ hash evaluations, rendering brute-force de-anonymization impossible.

---

### Q13: How is a nullifier derived, and why does it incorporate the verifier's session nonce?
**Model Answer:**  
The nullifier is computed inside the circuit as:
$$\mathcal{N} = \text{Poseidon}(holderSecret, sessionNonce, docId)$$
It incorporates the verifier's `sessionNonce` for two vital reasons:
1. **Unlinkability Across Verifiers**: If the nullifier were simply $\text{Poseidon}(holderSecret, docId)$, it would be static. A holder presenting their credential to a university and later to an employer would emit identical nullifiers, allowing the two parties to collude and track the user. Injecting a fresh, random `sessionNonce` ensures that the nullifier is mathematically distinct and uncorrelated in every presentation.
2. **Replay Immunity**: Within a specific verifier session, the nonce is fixed. If an attacker intercepts the proof and tries to re-submit it to the same verifier, the nullifier will evaluate to the same value and `VerifierGateway.sol` will revert with `NullifierAlreadyConsumed()`.

---

### Q14: How does Sparse Merkle Tree (SMT) non-membership verification work inside Circom?
**Model Answer:**  
A Sparse Merkle Tree of depth 10 has $2^{10} = 1,024$ addressable leaf slots, initialized to zero. When credentials are revoked, their `docId` is inserted into the leaf slot corresponding to the lowest 10 bits of the `docId`.
To prove non-revocation in zero knowledge, the prover must show that their `docId` is **not** present in the tree:
- **Case 1 (Empty Slot)**: The leaf slot at the target index has never been populated. The witness supplies `isOld0 = 1`. The circuit enforces that the leaf value is 0, and hashes up the tree with the 10 sibling hashes to verify the active Merkle root.
- **Case 2 (Collision with a Different Revoked Leaf)**: The leaf slot is occupied, but by another credential's revocation record (`oldKey`). The witness supplies `isOld0 = 0`, `oldKey`, and `oldValue`. The circuit asserts:
$$\text{assert}(oldKey \neq docId)$$
It then computes $\text{leaf} = \text{Poseidon}(oldKey, oldValue)$ and hashes up the tree using the siblings to reconstruct the root.
Both cases prove that `docId` is absent from the revocation set without disclosing `docId`.

---

### Q15: What is the Powers of Tau setup, and what degree parameter $k$ does ZK-DocGuard require?
**Model Answer:**  
Groth16 requires a Common Reference String (CRS) generated via a two-phase trusted setup:
1. **Phase 1 (Powers of Tau)**: Universal, circuit-independent ceremony evaluating secret powers $\tau^0, \tau^1, \dots, \tau^{2^k - 1}$ in $\mathbb{G}_1$ and $\mathbb{G}_2$.
2. **Phase 2 (Circuit-Specific Setup)**: Binds the circuit's specific R1CS constraints to the Phase 1 parameters.

The degree parameter $k$ determines the maximum constraint capacity: $N_{\text{max}} = 2^k$.
- `DiscloseModeA` compiles to 9,144 constraints.
- `DiscloseModeB` compiles to 12,933 constraints.
Both circuits require $k = 14$ because $2^{13} = 8,192 < 9,144$, whereas $2^{14} = 16,384 \ge 12,933$. Both circuits utilize the standard `powersOfTau28_hez_final_14.ptau` CRS, providing optimal resource utilization within the $2^{14}$ domain bucket.

---

## Domain 3: Circuit Implementation & Constraints (Questions 16–22)

### Q16: Walk through the signal inputs of `DiscloseModeB.circom`.
**Model Answer:**  
`DiscloseModeB` defines the following public and private signals:
- **Public Inputs (7 signals + arrays = 26 signals total)**:
  - `nullifier`: The derived session nullifier.
  - `issuerPubKeyX`, `issuerPubKeyY`: The BabyJubJub coordinates of the issuing authority.
  - `currentRevocationRoot`: The active on-chain SMT root.
  - `sessionNonce`: The verifier challenge nonce.
  - `disclosedFieldsMask[8]`: Binary vector indicating which fields are revealed.
  - `disclosedFields[8]`: The cleartext values of revealed fields (zeros for hidden fields).
- **Private Witness Inputs**:
  - `docId`: The credential identifier.
  - `holderSecret`: The 253-bit holder blinding factor.
  - `rawFields[8]`: The 8 private credential attribute values.
  - `sigR8x`, `sigR8y`, `sigS`: The EdDSA-Poseidon signature components.
  - `smtSiblings[10]`: Sibling hashes along the Merkle path.
  - `isOld0`, `oldKey`, `oldValue`: SMT exclusion parameters.

---

### Q17: How is selective disclosure enforced arithmetically inside the circuit?
**Model Answer:**  
For each attribute slot $f \in \{0, \dots, 7\}$, the circuit enforces:
```circom
disclosedFields[f] === disclosedFieldsMask[f] * rawFields[f];
```
Additionally, `disclosedFieldsMask[f]` is constrained to be a strict binary value:
```circom
disclosedFieldsMask[f] * (1 - disclosedFieldsMask[f]) === 0;
```
If a field is masked ($mask = 0$), `disclosedFields[f]` must equal $0 \cdot rawFields[f] = 0$. The verifier only learns that the field is undisclosed. If unmasked ($mask = 1$), `disclosedFields[f]` must match `rawFields[f]`. Crucially, in both cases, `rawFields[f]` is fed into the Poseidon document hash and validated against the issuer's signature, guaranteeing that the prover cannot alter or fabricate attributes.

---

### Q18: How do you implement numerical range predicates (e.g., age $\ge 21$ or GPA $\ge 3.5$) in Circom?
**Model Answer:**  
In finite field arithmetic over $\mathbb{F}_r$, inequality comparisons ($a \ge b$) are non-trivial because elements wrap around modulo $r$. To compute $a \ge b$, we use the `GreaterEqThan(n)` component from `circomlib`:
1. It computes the difference $diff = a - b + 2^n$.
2. It decomposes $diff$ into $n + 1$ binary bits ($bit_0, \dots, bit_n$).
3. If $a \ge b$, the $(n+1)$-th bit (the most significant bit $2^n$) is 1. If $a < b$, an underflow occurs and the bit is 0.
4. By asserting that the resulting comparison bit equals 1, the circuit proves in zero knowledge that the numerical attribute satisfies the threshold without disclosing the exact numerical value.

---

### Q19: Why does `DiscloseModeB` have 12,933 constraints compared to 9,144 for `DiscloseModeA`?
**Model Answer:**  
The exact constraint delta is:
$$\Delta = 12,933 - 9,144 = 3,789 \text{ constraints } (+41.4\%)$$
This delta arises entirely from the `SMTNonMembershipVerifier(10)` component:
1. **10 Levels of Poseidon Tree Hashing**: Each tree level requires multiplexing the sibling based on the direction bit and executing a Poseidon sponge ($t=3$), consuming $10 \times 240 = 2,400$ constraints.
2. **Key Bit Decomposition**: Decomposing the 253-bit `docId` into binary address bits consumes ~253 constraints.
3. **Collision Disjunction Logic**: Enforcing $isOld0 \in \{0, 1\}$, computing $\text{Poseidon}(oldKey, oldValue)$, and proving $oldKey \neq docId$ via non-zero inversion checks ($k \cdot inv = 1$) consumes the remaining ~1,136 constraints.

---

### Q20: What is the proving time performance on desktop vs. mobile hardware?
**Model Answer:**  
As measured in `benchmarks/results/circuit-benchmarks.json`:
- **Desktop (x64 AVX2)**:
  - Mode A: Average proving time is **841.2 ms** (witness generation: 235.5 ms).
  - Mode B: Average proving time is **801.7 ms** (witness generation: 232.5 ms).
- **Mobile (ARM64 WebWorker emulation)**:
  - Mode A: Estimated at **2,397.4 ms**.
  - Mode B: Estimated at **2,284.8 ms**.
In both hardware tiers, proving executes in under 2.5 seconds, fitting within consumer usability expectations for online authentication.

---

### Q21: Why is Mode B desktop proving time (~802 ms) slightly faster than Mode A (~841 ms) despite having more constraints?
**Model Answer:**  
Both circuits reside in the exact same $k=14$ Powers of Tau bucket ($2^{14} = 16,384$ capacity). The dominant computational phases of the Groth16 prover—Fast Fourier Transforms (FFT) and Multi-Scalar Multiplications (MSM)—operate on power-of-two polynomial domains ($2^{14}$ elements). Because both circuits pad to $2^{14}$, their asymptotic algorithmic workloads are identical. The minor 39.5 ms variance (-4.7%) falls within standard CPU scheduling, cache locality, and garbage collection jitter across benchmark runs.

---

### Q22: What artifacts does Snarkjs produce during circuit compilation, and what are their respective sizes?
**Model Answer:**  
As measured for `DiscloseModeB`:
1. `DiscloseModeB.r1cs`: The compiled constraint system description.
2. `DiscloseModeB.wasm`: The WebAssembly witness calculator (**3.31 MB**).
3. `DiscloseModeB_final.zkey`: The Groth16 proving key containing evaluation points in $\mathbb{G}_1$ and $\mathbb{G}_2$ (**7.70 MB**).
4. `verification_key.json`: The public verification parameters $(IC, \alpha_1, \beta_2, \gamma_2, \delta_2)$ (**7.49 KB**).
5. `proof.json`: The generated Groth16 proof (**724 bytes**).

---

## Domain 4: Smart Contracts, EVM & Gas Optimization (Questions 23–29)

### Q23: How does `DocumentRegistry.sol` achieve a 99.2% gas reduction in batch registrations?
**Model Answer:**  
Registering a single document (`registerDocument`) consumes **192,308 gas** due to cold contract invocation, base 21,000 transaction overhead, and a 20,000-gas `SSTORE` operation.
In `registerBatch`:
1. The 21,000 transaction base fee is amortized over up to 100 documents.
2. Storage slots are tightly packed: `address issuer` (160 bits) + `uint64 timestamp` (64 bits) + `bool revoked` (8 bits) fit within a single 256-bit word (232 bits).
3. The array is passed as `calldata`, avoiding memory copies.
4. The loop counter is unrolled with `unchecked { ++i; }`, avoiding safe-math boundary checks.
For a 100-document batch, total transaction gas is **145,301 gas**, yielding an effective gas cost of **1,453 gas per document**—a 99.2% reduction.

---

### Q24: What is the gas cost of verifying a Groth16 proof on-chain?
**Model Answer:**  
In `gas-benchmarks.json`:
- Standalone verification via `Groth16Verifier.verifyProof`: **384,621 gas** (Mode A) and **384,645 gas** (Mode B).
- Full gateway execution via `VerifierGateway.consumeAndVerify`: **432,901 gas** (Mode A) and **435,258 gas** (Mode B).
The additional ~48,000 gas in the gateway covers loading issuer keys from storage, checking revocation root validity, checking nullifier non-consumption, writing the nullifier to storage (`SSTORE`), and emitting the `ProofVerified` event.

---

### Q25: How does `IssuerRegistry.sol` prevent malicious actors from self-accrediting as issuers?
**Model Answer:**  
`IssuerRegistry.sol` implements a **two-phase governance workflow**:
1. **Application Phase**: Any entity can call `applyAsIssuer(name, url, pubKeyX, pubKeyY)`, depositing metadata. The issuer is assigned status `Pending`.
2. **Review & Approval Phase**: Only the governance multisig/contract owner can invoke `approveIssuer(issuerAddress)`. Only after approval is the issuer's status changed to `Active`.
The gateway contract will strictly revert (`UnregisteredIssuerKey()`) if a proof references public keys not tied to an active, approved issuer.

---

### Q26: How does issuer key rotation work without invalidating previously issued credentials?
**Model Answer:**  
When an active issuer calls `rotateKey(newAx, newAy)`:
1. The contract verifies caller authorization and records the timestamp of rotation.
2. The old public key coordinates remain indexed with a validity timestamp window `[registrationTime, rotationTime]`.
3. When verifying a presentation, the contract checks whether the credential's issuance timestamp falls within the authorized window of the key. Credentials issued legally under the prior key remain verifiable, while new credentials must be signed by the newly registered key.

---

### Q27: What is the purpose of `Pausable` across all registry contracts?
**Model Answer:**  
The contracts inherit OpenZeppelin's `Pausable` pattern. In the event of an emergency (e.g., a critical zero-day discovered in the BN254 pairing precompile or an off-chain issuer private key compromise), the governance administrator can invoke `pause()`. This instantly suspends all `registerDocument`, `applyAsIssuer`, and `consumeAndVerify` operations, freezing contract state until an audited upgrade or mitigation is deployed.

---

### Q28: How does `RevocationRegistry.sol` support historical root validity for Mode B?
**Model Answer:**  
When an issuer updates its SMT revocation root via `updateRevocationRoot(newRoot)`, the contract appends `newRoot` to a history ring-buffer alongside `block.timestamp`.
A holder who downloaded an exclusion witness 15 minutes prior to presenting can still submit their proof because `isValidRevocationRoot(root)` checks whether the root was active within a configurable grace window (e.g., the last 1 hour). This prevents network jitter or concurrent revocations by other parties from invalidating in-flight presentation proofs.

---

### Q29: What EVM version is targeted, and what opcode optimizations are utilized?
**Model Answer:**  
The Solidity contracts target the `paris` EVM specification (Solidity 0.8.24) deployed on Polygon Amoy. Key optimizations include:
- `PUSH0` opcode support for 2-gas zero-value pushes onto the stack.
- Custom 4-byte selector errors instead of revert strings, saving ~100 bytes of bytecode per error.
- OpenZeppelin v5 contract primitives optimized for minimal storage overhead.

---

## Domain 5: Security, Threat Modeling & Replay Protection (Questions 30–35)

### Q30: How does ZK-DocGuard mitigate proof replay attacks?
**Model Answer:**  
Proof replay is eliminated via two interlocking safeguards:
1. **Verifier Challenge Nonce**: The verifier issues a cryptographically random 256-bit challenge `sessionNonce` with a 5-minute time-to-live. The Groth16 proof takes `sessionNonce` as a public input. A proof generated for Verifier A cannot be presented to Verifier B because Verifier B will supply a different nonce.
2. **On-Chain Nullifier Registry**: The circuit derives a deterministic nullifier $\mathcal{N} = \text{Poseidon}(holderSecret, sessionNonce, docId)$. In `VerifierGateway.sol`, `consumedNullifiers[nullifier]` is checked and set to `true`. Resubmitting the same proof within the same session will immediately revert.

---

### Q31: What is the consequence if an issuer's BabyJubJub private key is compromised?
**Model Answer:**  
If an issuer's signing key is compromised, an attacker could forge credentials under that issuer's identity.
To mitigate this:
1. The issuer immediately notifies governance to invoke `IssuerRegistry.suspendIssuer(issuerAddress)`.
2. Once suspended, `VerifierGateway.sol` rejects all proofs signed by that key.
3. The issuer generates a fresh BabyJubJub keypair, executes `rotateKey`, and reissues credentials to valid holders.

---

### Q32: Could an attacker forge a Groth16 proof without knowing the private inputs?
**Model Answer:**  
No. Groth16 achieves computational knowledge soundness under the **Generic Group Model (GGM)** and the **Knowledge-of-Exponent Assumption (KEA)**. For an attacker to forge a proof without knowing the underlying witness polynomials $(u, v, w)$, they would have to solve the discrete logarithm problem over the BN254 pairing groups $\mathbb{G}_1$ and $\mathbb{G}_2$, which requires on the order of $2^{100}$ group operations.

---

### Q33: How does the system defend against front-running of verification transactions?
**Model Answer:**  
In `VerifierGateway.sol`, the caller `msg.sender` can be the verifier gateway microservice. Even if an attacker observes a pending verification transaction in the mempool and attempts to front-run it by submitting the exact same proof:
1. The proof contains zero private attributes or secrets (only public signals).
2. The attacker gains no secret knowledge.
3. If the front-runner's transaction succeeds, the nullifier becomes consumed on-chain anyway, satisfying the verifier's objective.
4. If strict sender binding is required, `VerifierGateway` can enforce `msg.sender == verifierAddress`.

---

### Q34: What prevents an attacker from uploading arbitrary malicious payloads to IPFS?
**Model Answer:**  
IPFS is content-addressed; anyone can upload data to public nodes. However, ZK-DocGuard's security does not depend on IPFS integrity:
1. Payloads are encrypted client-side with AES-256-GCM.
2. The credential's integrity is determined by the issuer's EdDSA signature over the Poseidon commitment $M$.
3. If an attacker tampers with or substitutes an IPFS file, the decrypted payload will fail authentication (GCM tag verification failure) or its hash will fail the circuit equality check.

---

### Q35: How does the system protect against client-side memory leakage of credentials?
**Model Answer:**  
1. Private keys and issued credentials are stored in IndexedDB encrypted under AES-GCM-256 keys derived via PBKDF2 (100,000 iterations) or WebAuthn.
2. Proving operations execute in dedicated Web Workers whose memory buffers are garbage-collected upon worker termination.
3. Sensitive credentials are never written to `localStorage` or transmitted in HTTP query parameters.

---

## Domain 6: Legal Compliance, GDPR & Performance (Questions 36–42)

### Q36: How does ZK-DocGuard achieve compliance with GDPR Article 17 ("Right to be Forgotten")?
**Model Answer:**  
GDPR Article 17 mandates that personal data must be erased upon the data subject's request.
In ZK-DocGuard:
1. **Zero Cleartext on Blockchain**: The blockchain records only issuer public keys, aggregate Poseidon Merkle roots, and single-use nullifiers.
2. **Zero Reversible Hashes**: Standard SHA-256 hashes of names or emails are considered pseudonymous personal data under GDPR Recital 26 because they can be inverted via rainbow tables. ZK-DocGuard uses Poseidon commitments blinded by a 253-bit random `holderSecret`, preventing inversion.
3. **Erasure Mechanism**: When a holder requests erasure, the issuer deletes the user record from its database and stops pinning the encrypted document on IPFS. The distributed ledger requires no alteration, perfectly honoring Article 17.

---

### Q37: How does ZK-DocGuard comply with GDPR Article 5 ("Data Minimization")?
**Model Answer:**  
Article 5(1)(c) dictates that personal data processing must be limited to what is strictly necessary.
Through Circom selective disclosure circuits, holders can satisfy verification requests by proving predicate statements (e.g., `isGraduated == true`, `gpa >= 3.0`) without revealing their birth date, address, gender, or full academic transcript. Only the minimal required boolean or numerical assertions are revealed.

---

### Q38: What is the total latency of an end-to-end presentation, and where is time spent?
**Model Answer:**  
As benchmarked in `benchmarks/results/system-benchmarks.json`, the full end-to-end presentation lifecycle takes **3,217.2 ms**:
1. Session Challenge Creation: **22.9 ms** (0.7%)
2. Session Fetch over HTTP: **10.0 ms** (0.3%)
3. SMT Witness Download from Issuer: **694.9 ms** (21.6%)
4. Client Web Worker Proving: **1,574.4 ms** (48.9%)
5. Verifier Gateway & On-Chain Check: **911.5 ms** (28.3%)
6. HMAC Receipt Generation: **3.5 ms** (0.1%)
Over 70% of total latency is consumed by cryptographic computation (proving and verification), with less than 25% spent on network I/O.

---

### Q39: What is the throughput of the Sparse Merkle Tree as leaf count scales from 1,000 to 100,000?
**Model Answer:**  
As measured in `benchmarks/results/smt-benchmarks.json`:
- At **1,000 leaves**: Build time is 1.65 s (607 leaves/s); non-membership proof extraction is **0.09 ms**.
- At **10,000 leaves**: Build time is 19.58 s (511 leaves/s); non-membership proof extraction is **0.13 ms**.
- At **100,000 leaves**: Build time is 219.31 s (456 leaves/s); non-membership proof extraction is **0.15 ms**.
While initial batch tree building scales linearly with size ($O(N \log d)$), proof query time scales strictly logarithmically ($O(d)$), requiring under 0.15 ms even at 100,000 revocation records.

---

### Q40: What was the result of running the automated end-to-end demonstration (`pnpm demo`)?
**Model Answer:**  
The automated end-to-end demonstration script (`scripts/demo.ts`) executed all eight lifecycle stages:
1. Issuer Onboarding and Key Generation.
2. Credential Creation & Helia IPFS Upload.
3. Poseidon Batch Registration on EVM Hardhat.
4. Verifier Challenge Session Initialization.
5. In-Browser Witness Synthesis & Groth16 Proving.
6. Mode A & Mode B Gateway Verification.
7. Credential Revocation & SMT Root Update.
8. Proof Replay Detection & Revoked Presentation Rejection.
The entire 8-stage lifecycle completed with 100% cryptographic precision in **15.70 seconds**.

---

### Q41: How does the system handle high-resolution image or PDF encryption performance?
**Model Answer:**  
In `benchmarks/results/system-benchmarks.json`:
- A 100 KB diploma image encrypts in **0.24 ms** and achieves a full upload, download, and decryption roundtrip via Helia IPFS in **15.94 ms**.
- A 500 KB multi-page transcript package encrypts in **0.85 ms** with a full IPFS roundtrip of **27.55 ms**.
This demonstrates that client-side AES-256-GCM encryption introduces virtually zero overhead compared to network transmission times.

---

### Q42: What are the main limitations of the current architecture, and what would you improve in future work?
**Model Answer:**  
1. **Cross-Credential Batching**: Presenting multiple credentials currently requires generating and verifying separate Groth16 proofs. Future work could introduce recursive folding schemes (such as Nova or SnarkPack) to fold multiple credential proofs into a single constant-size proof.
2. **Standardization Alignment**: While ZK-DocGuard implements its own optimized 8-slot schema, future work could map W3C Verifiable Credentials Data Model v2.0 and BBS+ signatures directly into Circom circuits for universal interoperability.
3. **Wallet Account Abstraction**: Integrating ERC-4337 account abstraction with WebAuthn passkeys would eliminate gas management for holders, allowing verifiers or issuers to sponsor on-chain verification fees via Paymasters.
