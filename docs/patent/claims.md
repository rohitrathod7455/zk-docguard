# Patent Specification: Patent Claims & Drawings

---

## Formal Patent Claims

### We claim:

**1. (Independent Method Claim)**  
A computer-implemented method for privacy-preserving verifiable credential issuance, selective disclosure, and non-revocation verification, the method comprising:
  - generating, by an issuer computing system, a digital credential comprising a unique credential identifier, a plurality of attribute fields, and a holder secret, wherein a cryptographic digest of said credential is computed using an algebraic hash function operating over a prime scalar field of an elliptic curve;
  - signing, by said issuer computing system, said cryptographic digest using a private key corresponding to a registered twisted Edwards curve public key;
  - maintaining, by said issuer computing system, an off-chain Sparse Merkle Tree representing revoked credentials, and publishing a root hash of said Sparse Merkle Tree to a distributed ledger contract;
  - receiving, at a holder computing device, a challenge session nonce from a verifier computing system;
  - synthesizing, by an asynchronous background worker of said holder computing device, a zero-knowledge succinct non-interactive argument of knowledge (zk-SNARK) proof, wherein said zk-SNARK proof proves in zero knowledge that:
    1. said digital credential bears a valid signature from said registered issuer public key;
    2. a non-membership path demonstrates that said unique credential identifier is excluded from said active Sparse Merkle Tree root hash;
    3. a subset of said plurality of attribute fields corresponds to a public disclosure mask without revealing undisclosed attribute fields; and
    4. a unique nullifier is deterministically derived from said holder secret, said challenge session nonce, and said credential identifier;
  - transmitting said zk-SNARK proof, said public disclosure mask, said disclosed attributes, and said nullifier to said verifier computing system; and
  - executing an on-chain verification transaction against a smart contract gateway on said distributed ledger, wherein said smart contract gateway validates said zk-SNARK proof against precompiled bilinear pairing contracts, confirms that said root hash is an active revocation root, and records said nullifier to prevent replay attacks.

**2. (Dependent Claim)**  
The method of claim 1, wherein said algebraic hash function is a Poseidon sponge permutation parameterized with state width $t = 3$, rate $r = 2$, capacity $c = 1$, 8 full rounds, and 57 partial rounds over the scalar field $\mathbb{F}_r$ of the BN254 elliptic curve.

**3. (Dependent Claim)**  
The method of claim 1, wherein said twisted Edwards curve is the BabyJubJub curve defined by $168700 x^2 + y^2 = 1 + 168696 x^2 y^2$ over the base field isomorphic to the scalar field of BN254, and wherein said digital signature is an EdDSA-Poseidon signature requiring fewer than 1,500 rank-1 constraint system (R1CS) constraints to verify within said zk-SNARK proof.

**4. (Dependent Claim)**  
The method of claim 1, wherein proving non-membership in said Sparse Merkle Tree comprises verifying inside said zk-SNARK proof that:
  - when a leaf slot corresponding to said credential identifier is unpopulated, an empty slot indicator is true and the leaf hash evaluates to zero; and
  - when said leaf slot is occupied by a conflicting leaf, an existing key in said conflicting leaf is strictly non-equal to said credential identifier.

**5. (Dependent Claim)**  
The method of claim 1, further comprising:
  - aggregating, by said issuer computing system, a plurality of up to 100 credential hashes into a batch Merkle tree; and
  - executing an on-chain batch registration transaction that stores per-document lookup records in tightly packed 256-bit storage slots, wherein said batch registration reduces effective gas consumption per document by at least 90 percent relative to single-document registration.

**6. (Dependent Claim)**  
The method of claim 1, wherein said holder secret comprises a random scalar possessing at least 250 bits of min-entropy, blinding said cryptographic digest against brute-force dictionary and rainbow table inversion for low-entropy attribute fields.

**7. (Dependent Claim)**  
The method of claim 1, further comprising:
  - encrypting a cleartext document payload at said holder device using authenticated AES-256-GCM symmetric encryption;
  - anchoring the resulting ciphertext to a content-addressed decentralized storage network (IPFS); and
  - securely delegating access to said verifier computing system by executing an ephemeral Diffie-Hellman key exchange (X25519) and wrapping the symmetric document key using ChaCha20-Poly1305 with an embedded expiration timestamp, without re-encrypting or re-uploading said ciphertext.

**8. (Dependent Claim)**  
The method of claim 1, wherein said unique nullifier evaluates $\mathcal{N} = \text{Poseidon}(holderSecret, sessionNonce, docId)$, guaranteeing that:
  - presenting the same credential across distinct verifier sessions produces distinct, un-linkable nullifiers; and
  - presenting the same proof within the same verifier session is detected and rejected on-chain as a duplicate nullifier.

**9. (Dependent Claim)**  
The method of claim 1, wherein said zk-SNARK proof is a Groth16 proof consisting of exactly three elliptic curve group elements $(A \in \mathbb{G}_1, B \in \mathbb{G}_2, C \in \mathbb{G}_1)$ serializing to 724 bytes.

**10. (Dependent Claim)**  
The method of claim 1, wherein said zk-SNARK proof verification on said distributed ledger executes using precompile contracts `0x06`, `0x07`, and `0x08` of the Ethereum Virtual Machine, consuming fewer than 450,000 gas units.

---

**11. (Independent System Claim)**  
A distributed computing system for privacy-preserving zero-knowledge credential verification, the system comprising:
  - an issuer computing platform configured to generate schema-parameterized credentials, compute EdDSA-Poseidon signatures over BabyJubJub, and maintain an off-chain Sparse Merkle Tree of revoked credentials;
  - an on-chain distributed ledger comprising an `IssuerRegistry` contract, a `DocumentRegistry` contract, a `RevocationRegistry` contract, and a `VerifierGateway` contract;
  - a holder computing device comprising a web browser environment, a user interface thread, and a background WebAssembly Web Worker;
  - wherein said Web Worker is configured to generate a Groth16 zero-knowledge proof proving valid issuer signature, selective attribute disclosure, and non-membership in said Sparse Merkle Tree without blocking said user interface thread; and
  - a verifier gateway service configured to issue challenge nonces, receive generated proofs from said holder computing device, and submit said proofs to said `VerifierGateway` contract for atomic nullifier consumption.

**12. (Dependent Claim)**  
The system of claim 11, wherein said `DocumentRegistry` contract packs an issuer address, an issuance timestamp, and a revocation flag into a single 256-bit storage slot, and updates an array of up to 100 documents within an unchecked loop counter.

**13. (Dependent Claim)**  
The system of claim 11, wherein said holder computing device stores credential private keys and secrets in an encrypted browser IndexedDB vault protected by an authenticated key derived via PBKDF2 or WebAuthn.

**14. (Dependent Claim)**  
The system of claim 11, wherein said `RevocationRegistry` contract stores sequential Sparse Merkle Tree roots with timestamp metadata, enabling historical root lookups within an epoch grace window.

---

**15. (Independent Computer-Readable Medium Claim)**  
A non-transitory computer-readable storage medium storing instructions that, when executed by one or more processors, cause the one or more processors to perform operations comprising:
  - obtaining a verifiable credential signed via an EdDSA-Poseidon signature over the BabyJubJub curve;
  - obtaining a session challenge nonce from a relying party verifier;
  - retrieving a logarithmic non-membership witness corresponding to a depth-10 Sparse Merkle Tree revocation root;
  - generating a Groth16 zero-knowledge proof in WebAssembly proving credential authenticity, attribute constraint satisfaction, and non-revocation without disclosing hidden attributes or a credential identifier;
  - computing an unforgeable session-bound nullifier; and
  - transmitting said Groth16 proof and nullifier to said relying party verifier for on-chain verification against an EVM smart contract gateway.

---

## List of Patent Drawings

- **FIG. 1**: Top-level system architecture illustrating the interaction between the Issuer Platform, Holder Client PWA, Verifier Gateway, IPFS Storage Layer, and EVM Blockchain Ledgers.
- **FIG. 2**: Cryptographic flowchart of the Document Issuance and Hierarchical Merkle Batch Registration protocol.
- **FIG. 3**: Dataflow and signal constraint architecture of the `DiscloseModeB` Groth16 zero-knowledge circuit.
- **FIG. 4**: Binary tree structure and witness verification logic for Sparse Merkle Tree (SMT-10) non-membership exclusion.
- **FIG. 5**: Sequence diagram of the Verifier-Scoped Ephemeral Key Wrapping and P2P document sharing workflow.
- **FIG. 6**: Smart contract topology and storage slot allocation model for `DocumentRegistry.sol` and `VerifierGateway.sol`.

---

## Patent Abstract

A computer-implemented system and method for privacy-preserving verifiable credential verification, selective attribute disclosure, and zero-knowledge non-revocation proofs. An issuer computes a Poseidon hash commitment over an 8-slot credential schema and signs the digest using BabyJubJub EdDSA. Document hashes are anchored to an EVM blockchain in amortized 100-item batches, achieving a 99.2% gas reduction. When presenting credentials, a holder Web Worker synthesizes a Groth16 zk-SNARK proof over BN254 in under one second. The proof verifies signature validity, evaluates selective attribute masks and range predicates, derives a session-bound nullifier, and proves exclusion from a depth-10 Sparse Merkle Tree revocation root without disclosing credential identifiers. An on-chain verifier gateway validates the proof using EVM pairing precompiles in ~435,000 gas while atomically consuming the nullifier to prevent replay attacks.
