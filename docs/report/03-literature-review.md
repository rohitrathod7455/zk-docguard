# Chapter 3: Literature Review and Related Work

---

## 3.1 Overview of Identity and Credentialing Paradigms

The challenge of establishing trust across decentralized digital systems has spurred significant academic and industrial innovation over the past decade. This chapter reviews the theoretical foundations, cryptographic primitives, and existing production frameworks for decentralized credentials, selective disclosure, and blockchain anchoring. To substantiate the architectural and patent claims of ZK-DocGuard, this review explicitly details the mechanics of prior art, highlights their achievements, and critically analyzes the technical gaps that ZK-DocGuard resolves.

---

## 3.2 Blockchain-Based Document Anchoring Frameworks

### 3.2.1 Blockcerts (MIT Media Lab)
Pioneered by Schmidt et al. at the MIT Media Lab and Learning Machine in 2016, **Blockcerts** represents the foundational open standard for anchoring digital educational credentials to public blockchains (initially Bitcoin, and subsequently Ethereum).
* **Architecture:** Blockcerts represents academic certificates as Open Badges-compliant JSON documents. An issuing institution batches certificate JSON objects into a binary Merkle tree using SHA-256, writing the single Merkle root into an OP_RETURN output on Bitcoin or a simple contract transaction on Ethereum. The recipient is issued a JSON certificate package containing the certificate fields, the issuer's public key, and the Merkle inclusion proof.
* **Limitations and Contrast with ZK-DocGuard:**
  1. *Complete Plaintext Exposure:* Verification in Blockcerts requires the holder to provide the entire unredacted certificate JSON to the verifier. The verifier recomputes the SHA-256 hash of the full document, verifies the Merkle path to the on-chain root, and validates the issuer's ECDSA signature. There is zero selective disclosure or zero-knowledge capability.
  2. *Privacy Violations:* All attributes—including student ID, date of birth, GPA, and graduation honors—must be revealed to verify even a single claim.
  3. *Unencrypted Storage:* Blockcerts does not provide or mandate client-side envelope encryption. If the certificate is stored on decentralized storage (e.g., IPFS), anyone with the content address can inspect the candidate's personal data.
  4. *Linkable Revocation:* Revocation is handled either via on-chain transaction outputs (spent unspent transaction outputs / UTXOs) or centralized issuer HTTP revocation bitvectors, directly exposing the certificate identifier.

### 3.2.2 European Blockchain Services Infrastructure (EBSI)
Developed by the European Commission and the European Blockchain Partnership, **EBSI** deploys permissioned distributed ledger nodes across EU member states to support cross-border verifiable diplomas and notarization.
* **Architecture:** EBSI relies on W3C Verifiable Credentials and JSON Web Signatures (JWS). Issuer trust registries and schema registries are hosted across permissioned Hyperledger Besu nodes.
* **Limitations and Contrast with ZK-DocGuard:**
  1. *Permissioned Consortium Trust:* EBSI requires nodes operated by EU government authorities, precluding permissionless verifiability or trustless deployment on public EVM networks.
  2. *Lack of In-Circuit Predicate Proofs:* EBSI standard implementations rely primarily on standard ECDSA (secp256k1 or prime256v1) signatures over full JSON-LD structures. Proving numerical range predicates (such as $\text{CGPA} \ge 3.00$) requires either trusted verifier inspection of the plaintext claim or reliance on external identity providers.
  3. *Revocation Lists:* Revocation relies on W3C StatusList2021 bitstrings hosted by the issuer or anchored on-chain, requiring verifiers to look up individual credential indices.

---

## 3.3 Selective Disclosure Without Zero-Knowledge SNARKs

### 3.3.1 BBS+ Signatures (BBS19 / Pairing-Based Cryptography)
Proposed by Boneh, Boyen, and Shacham, and generalized by Camenisch et al., **BBS+** is a signature scheme based on bilinear pairings over asymmetric elliptic curves (e.g., BLS12-381) that supports selective disclosure and zero-knowledge proof of knowledge of signatures.
* **Architecture:** BBS+ signs a vector of field elements $(m_1, m_2, \dots, m_n)$ under an institutional public key. A holder can randomize the signature and create a proof of knowledge that reveals only a subset of messages $\{m_i\}_{i \in D}$ while keeping $\{m_j\}_{j \notin D}$ perfectly hidden.
* **Limitations and Contrast with ZK-DocGuard:**
  1. *Lack of Arbitrary In-Circuit Predicates:* While BBS+ natively supports disclosing messages without revealing hidden ones, proving complex numerical inequalities (e.g., $m_5 \ge 300$) or arbitrary polynomial arithmetic requires pairing-based zero-knowledge proofs (such as Camenisch-Lysyanskaya proofs), which are computationally complex and mathematically distinct from standard SNARKs.
  2. *EVM On-Chain Inefficiency:* BBS+ proofs are constructed over pairings on curves such as BLS12-381. The Ethereum Virtual Machine (EVM) only natively supports BN254 (alt_bn128) via the `ecPairing` precompile at address `0x08` (EIP-197). Verifying BBS+ proofs directly on Ethereum or Polygon requires software emulation of BLS12-381 pairings, which consumes between 1.5 million and 3 million gas—exceeding reasonable transaction cost limits. ZK-DocGuard instead relies on Groth16 over BN254, which verifies on-chain for only ~384k gas.

### 3.3.2 SD-JWT (IETF Selective Disclosure JSON Web Tokens)
Standardized by the IETF OAuth working group (RFC draft), **SD-JWT** introduces selective disclosure to conventional web tokens.
* **Architecture:** An issuer produces a JSON Web Token where individual claim values are replaced with salted digests (`_sd: [sha256(salt_1 || claim_1), ...]`). When presenting the token, the holder provides the base token along with only the pre-image disclosures for the claims they wish to reveal.
* **Limitations and Contrast with ZK-DocGuard:**
  1. *No Predicate Proving:* In SD-JWT, a claim is either revealed in full plaintext (by providing the salt and value) or kept hidden. It is impossible to prove "CGPA $\ge 3.00$" without revealing the exact numeric GPA string.
  2. *No Cryptographic Holder Binding Inside Proof:* SD-JWT binds holder keys via separate DPoP (Demonstrating Proof-of-Possession) or key-binding tokens, but does not bind the holder's secret key algebraically into a zero-knowledge commitment tree.
  3. *No On-Chain Smart Contract Integration:* SD-JWT is fundamentally an HTTP/OAuth transport mechanism with no native bridge to distributed ledger anchoring, on-chain revocation registries, or smart contract verifiers.

---

## 3.4 Anonymous Credentials and Self-Sovereign Identity Frameworks

### 3.4.1 Hyperledger Indy and AnonCreds
Originating from the Sovrin Network, **Hyperledger Indy / AnonCreds** implements CL-signatures (Camenisch-Lysyanskaya) over pairing curves to realize privacy-preserving decentralized identity.
* **Architecture:** AnonCreds provides unlinkable selective disclosure and predicate proofs over dedicated Indy ledger namespaces.
* **Limitations and Contrast with ZK-DocGuard:**
  1. *Isolated, Specialized Ledger:* AnonCreds requires a dedicated Hyperledger Indy network (a specialized Plenum Byzantine Fault Tolerant ledger) and cannot operate natively within standard public EVM smart contract ecosystems.
  2. *Heavy Client Storage & Crypto:* The cryptographic libraries (ursa / indy-sdk) are compiled from C/Rust native binaries and historical WebAssembly wrappers that carry high initialization overhead, making lightweight PWA execution challenging.
  3. *Non-Standard Revocation Accumulators:* Revocation uses cryptographic accumulators (Ursa accumulators) which require frequent, heavy issuer accumulator updates that cannot be verified natively inside EVM smart contracts.

### 3.4.2 Iden3 and Polygon ID
Developed by the Iden3 team, **Polygon ID** represents the state of the art in zk-SNARK identity on Ethereum and Polygon.
* **Architecture:** Polygon ID uses Circom, BabyJubJub EdDSA signatures, Poseidon hashing, and Sparse Merkle Trees (SMT). It models an identity as an SMT of identity claims and generates Groth16 proofs to verify identity claims on-chain.
* **Critical Technical Differences and Contrast with ZK-DocGuard:**
  1. *Identity Tree vs. Document/Credential Envelope:* Polygon ID models the *entire identity* of the holder as a state tree of claims managed by the holder's mobile app. This requires complex identity state transition proofs (proving the user's root state transitioned on-chain). In contrast, ZK-DocGuard models self-contained, schema-parameterized 8-slot credential trees signed directly by accredited institutional issuers (`did:ethr`).
  2. *Encrypted Document Attachment & Storage:* Polygon ID is purely a structured claim system; it provides no protocol for client-side envelope encryption of arbitrary binary documents (PDF diplomas, high-resolution transcripts), content-addressed IPFS anchoring, or ephemeral key-wrapping for temporary full-document auditing. ZK-DocGuard bridges zero-knowledge selective disclosure with client-side encrypted document storage.
  3. *Public Revocation SMT Architecture:* In Polygon ID, the issuer's revocation tree is public, and the holder proves in-circuit that their claim is in the issuer's claims tree and not in the issuer's revocation tree. ZK-DocGuard adopts and extends this SMT exclusion principle in Mode B, combining it with an on-chain historical root ring buffer on EVM contracts and an explicit verifier challenge nonce binding (`VerifierGateway`) to prevent replay and cross-verifier correlation.

### 3.4.3 Semaphore and Sismo
* **Semaphore:** An Ethereum-based zero-knowledge privacy primitive designed for anonymous signaling, voting, and membership verification. Semaphore users prove membership in an on-chain Merkle tree of identity commitments without revealing which leaf they occupy, using an external nullifier to prevent double-signaling.
* **Sismo:** An attestation protocol that allowed users to aggregate Web2 and Web3 reputation (tokens, GitHub accounts, Twitter followers) into privacy-preserving zero-knowledge "ZK Badges" (Sismo Vault) using Hydra-S2 circuits.
* **Contrast with ZK-DocGuard:** Both Semaphore and Sismo focus exclusively on *anonymous group membership* (proving "I am one of the $N$ members in this set"). Neither system supports multi-attribute selective disclosure, inequality range proofs over academic metrics, institutional credential issuance, or client-side document envelope encryption.

### 3.4.4 ZK-Email
* **Architecture:** Developed by Kang et al. (0xPARC), ZK-Email verifies DKIM (DomainKeys Identified Mail) RSA-SHA256 signatures inside Circom circuits. Users prove that they received an authentic email from a specific domain (e.g., `registrar@mit.edu`) without disclosing their email address or private contents.
* **Contrast with ZK-DocGuard:** ZK-Email proves authenticity retroactively over existing Web2 DKIM signatures. However, verifying RSA-SHA256 and regex parsing inside a SNARK incurs massive constraint overhead (often 100,000 to 1,000,000+ constraints), requiring client proving times of 15 to 45 seconds. ZK-DocGuard requires institutions to sign credentials natively using SNARK-friendly BabyJubJub EdDSA signatures, reducing the entire selective disclosure and predicate circuit to just **9,144–12,933 constraints** and achieving sub-second client proving.

---

## 3.5 Comparative Analysis Matrix

Table 3.1 synthesizes the technical differences between ZK-DocGuard and the closest existing systems across eight architectural criteria:

| System | ZK Selective Disclosure | In-Circuit Range Predicates | Client-Side Document Encrypt | On-Chain EVM Verify | Revocation Mechanism | Circuit Constraint Scale | Primary Target Network | Standard / Primitives |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Blockcerts** | ✘ | ✘ | ✘ | ✔ (Root only) | Public Hash List | N/A (No SNARK) | Bitcoin / Ethereum | Open Badges, SHA-256 |
| **EBSI** | ✘ | ✘ | ✘ | ✘ (Off-Chain JWS) | StatusList2021 | N/A (No SNARK) | Hyperledger Besu | W3C VC, X.509 |
| **BBS+ / W3C** | ✔ | ✘ | ✘ | ✘ (Costly Pairings) | Bitstring / List | N/A (Pairings) | Off-Chain | BLS12-381, Camenisch |
| **SD-JWT** | ✔ (All/None) | ✘ | ✘ | ✘ | Issuer OCSP / List | N/A (Hashes) | Off-Chain (OAuth) | IETF RFC, SHA-256 |
| **Hyperledger AnonCreds** | ✔ | ✔ | ✘ | ✘ | Ursa Accumulator | N/A (CL Signatures) | Indy Ledger | CL-Signatures, ZKP |
| **Polygon ID / Iden3** | ✔ | ✔ | ✘ | ✔ | SMT In-Circuit | ~12k–25k | Polygon / EVM | BabyJubJub, Circom |
| **Semaphore** | ✔ (Group only)| ✘ | ✘ | ✔ | Nullifier Hash | ~2k–4k | Ethereum | Poseidon, Circom |
| **ZK-Email** | ✔ | ✘ | ✘ | ✔ | DKIM Expiry | ~150k–1.2M | Ethereum | RSA-2048, SHA-256 |
| **ZK-DocGuard (Ours)** | **✔** | **✔** | **✔ (AES-GCM)** | **✔ (Paris EVM)** | **SMT Mode B + On-Chain** | **9,144 / 12,933** | **Polygon Amoy / EVM** | **BabyJubJub, Poseidon, BN254** |

---

## 3.6 Summary and Scientific Positioning

As demonstrated by the comparative analysis, no prior system provides a unified bridge connecting:
1. Client-side envelope encryption of full arbitrary documents on decentralized storage;
2. Succinct, sub-second zk-SNARK selective disclosure with simultaneous numerical and temporal predicate verification;
3. Linkage-resistant, in-circuit non-membership revocation over on-chain anchored Sparse Merkle Trees; and
4. Low-cost EVM verification (~435k gas) paired with verifier-scoped ephemeral key-wrapping.

ZK-DocGuard directly addresses this gap in the literature, establishing an open-source, mathematically rigorous benchmark for real-world verifiable identity systems.
