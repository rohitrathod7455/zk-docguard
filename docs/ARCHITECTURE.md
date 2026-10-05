# ZK-DocGuard — System Architecture

> Privacy-Preserving Blockchain Document Verification System using Zero-Knowledge Proofs and Self-Sovereign Identity

---

## 1. Context Diagram

```mermaid
C4Context
    title ZK-DocGuard System Context

    Person(issuer, "Issuer", "Institution that issues credentials")
    Person(holder, "Holder", "Individual holding credentials")
    Person(verifier, "Verifier", "Entity verifying credentials")
    Person(admin, "Admin", "Platform administrator")

    System(zkdocguard, "ZK-DocGuard", "Privacy-preserving document verification system")

    System_Ext(blockchain, "EVM Blockchain", "Polygon Amoy / Sepolia / Hardhat")
    System_Ext(ipfs, "IPFS", "Decentralized storage via Kubo / Pinata")

    Rel(issuer, zkdocguard, "Registers, issues, revokes credentials")
    Rel(holder, zkdocguard, "Stores credentials, generates ZK proofs")
    Rel(verifier, zkdocguard, "Creates verification requests, checks proofs")
    Rel(admin, zkdocguard, "Approves issuers, manages platform")
    Rel(zkdocguard, blockchain, "Anchors hashes, verifies proofs, manages registries")
    Rel(zkdocguard, ipfs, "Stores encrypted documents")
```

---

## 2. Component Diagram

```mermaid
graph TB
    subgraph "Frontend — Next.js App"
        WEB_PUBLIC["Public Pages<br/>(Verify, How it Works)"]
        WEB_ISSUER["Issuer Console<br/>(Issue, Manage, Revoke)"]
        WEB_HOLDER["Holder Wallet<br/>(Store, Present, Backup)"]
        WEB_VERIFIER["Verifier Portal<br/>(Request, QR, Result)"]
        WEB_ADMIN["Admin Panel<br/>(Approve Issuers)"]
        WORKER["Web Worker<br/>(ZK Proof Generation)"]
    end

    subgraph "Backend — Fastify API"
        AUTH["Auth (SIWE)"]
        SESSIONS["Verification Sessions"]
        INDEXER["Chain Indexer"]
        IPFS_SVC["IPFS Service"]
        REVOC["Revocation Service (SMT)"]
        VERIFY["Proof Verifier"]
    end

    subgraph "Shared Libraries"
        CORE["@zk-docguard/core<br/>(Crypto, DID, VC, Schema)"]
        CIRCUITS["@zk-docguard/circuits<br/>(Circom, snarkjs)"]
        CONTRACTS["@zk-docguard/contracts<br/>(Solidity, ABIs)"]
    end

    subgraph "Infrastructure"
        PG["PostgreSQL 16"]
        KUBO["IPFS Kubo"]
        CHAIN["EVM Chain"]
    end

    WEB_ISSUER --> AUTH
    WEB_HOLDER --> SESSIONS
    WEB_VERIFIER --> SESSIONS
    WEB_ADMIN --> AUTH
    WEB_PUBLIC --> VERIFY

    WEB_HOLDER --> WORKER
    WORKER --> CIRCUITS

    AUTH --> PG
    SESSIONS --> PG
    INDEXER --> CHAIN
    INDEXER --> PG
    IPFS_SVC --> KUBO
    VERIFY --> CORE

    CORE --> CONTRACTS
    CIRCUITS --> CORE
```

---

## 3. Credential Issuance Sequence

```mermaid
sequenceDiagram
    participant Issuer as Issuer Browser
    participant API as Backend API
    participant Chain as EVM Chain
    participant IPFS as IPFS (Kubo)
    participant Holder as Holder Wallet

    Note over Issuer: Issuer already registered and approved on-chain

    Issuer->>Issuer: 1. Fill credential form (attributes)
    Issuer->>Issuer: 2. Encrypt document (AES-256-GCM)
    Issuer->>IPFS: 3. Pin encrypted ciphertext
    IPFS-->>Issuer: CID

    Issuer->>Issuer: 4. Encode attributes to field elements
    Issuer->>Issuer: 5. Generate salts, compute leaf commitments
    Issuer->>Issuer: 6. Build Poseidon Merkle tree → credentialRoot
    Issuer->>Issuer: 7. Sign credentialRoot (BabyJubJub EdDSA-Poseidon)
    Issuer->>Issuer: 8. Compute credentialId = Poseidon(credentialRoot, 1)
    Issuer->>Issuer: 9. Compute docHash = SHA-256(document)

    Issuer->>Chain: 10. registerDocument(docHash, credentialId, schemaId, CID, expiry)
    Chain-->>Issuer: tx receipt

    Issuer->>API: 11. POST /credentials/anchor (tx info)
    API->>API: 12. Index and cache

    Issuer->>Issuer: 13. Build W3C VC JSON (attributes, salts, signature, metadata)
    Issuer->>Issuer: 14. Wrap document key to holder's X25519 public key

    Issuer->>Holder: 15. Deliver VC package (link / QR)
    Holder->>Holder: 16. Decrypt and store in IndexedDB
```

---

## 4. Selective Disclosure Presentation Sequence

```mermaid
sequenceDiagram
    participant Verifier as Verifier Browser
    participant API as Backend API
    participant Holder as Holder Wallet
    participant Worker as Web Worker
    participant Chain as EVM Chain

    Verifier->>API: 1. POST /sessions (claims, predicates, trusted issuers)
    API-->>Verifier: sessionId, nonce, QR payload

    Verifier->>Verifier: 2. Display QR code + SSE listener

    Holder->>Holder: 3. Scan QR code
    Holder->>API: 4. GET /sessions/:id (fetch request details)
    API-->>Holder: disclosure mask, predicates, challenge, trusted issuers

    Holder->>Holder: 5. Show consent sheet (what is revealed / proven / hidden)
    Note over Holder: User explicitly approves

    Holder->>Worker: 6. Send credential data + request params
    Worker->>Worker: 7. Load circuit WASM + zkey (cached)
    Worker->>Worker: 8. Compute witness
    Worker->>Worker: 9. Generate Groth16 proof
    Worker->>Worker: 10. Local self-verification
    Worker-->>Holder: proof + publicSignals

    Holder->>API: 11. POST /sessions/:id/presentation
    API->>API: 12. snarkjs.groth16.verify
    API->>Chain: 13. Check issuerKeyHash active
    API->>Chain: 14. Check revocation status
    API->>API: 15. Validate challenge, time window, predicates
    API-->>Holder: verification result
    API-->>Verifier: 16. SSE: verified / failed

    Verifier->>Verifier: 17. Display verification receipt
```

---

## 5. Revocation Sequence (Mode B — SMT)

```mermaid
sequenceDiagram
    participant Issuer as Issuer Browser
    participant API as Backend API
    participant Chain as EVM Chain

    Issuer->>API: 1. POST /revocations (credentialId, issuer signature)
    API->>API: 2. Verify issuer authority
    API->>API: 3. Insert credentialId into SMT
    API->>API: 4. Compute new SMT root

    API->>Chain: 5. revokeCredential(credentialId) [v1 flag]
    API->>Chain: 6. updateRevocationRoot(issuerKeyHash, newRoot)
    Chain-->>API: tx receipts

    Note over API: Non-membership witnesses for<br/>non-revoked credentials remain valid

    Note over API: Holder fetches fresh witness before<br/>each presentation (GET /revocations/:key/witness/:id)
```

---

## 6. Data Flow and Trust Boundaries

```mermaid
graph LR
    subgraph "Trust Boundary: Client (Browser)"
        PRIV["Private Data<br/>(keys, attributes, salts)"]
        ENC["Encryption Layer<br/>(AES-256-GCM)"]
        ZKP["ZK Proof Generator"]
    end

    subgraph "Trust Boundary: Server (API)"
        API_PROC["Request Processing"]
        IDX["Chain Indexer"]
        SMT_SVC["SMT Service"]
    end

    subgraph "Trust Boundary: Public (Chain + IPFS)"
        REG["On-Chain Registries<br/>(hashes, CIDs, key hashes)"]
        IPFS_STORE["IPFS<br/>(encrypted ciphertext only)"]
    end

    PRIV -->|"never leaves"| ENC
    ENC -->|"ciphertext only"| IPFS_STORE
    PRIV -->|"never leaves"| ZKP
    ZKP -->|"proof + public signals only"| API_PROC
    API_PROC -->|"anchors"| REG
    IDX -->|"reads events"| REG
    SMT_SVC -->|"updates root"| REG
```

---

## 7. Technology Stack Summary

| Layer                 | Technology                                      | Version                  |
| --------------------- | ----------------------------------------------- | ------------------------ |
| Monorepo              | pnpm + Turborepo                                | pnpm 9, Turbo 2.x        |
| Contracts             | Solidity, Hardhat, OpenZeppelin v5              | 0.8.24                   |
| Chains                | Hardhat local, Polygon Amoy, Sepolia            | —                        |
| ZK Proofs             | Circom, snarkjs (Groth16, BN254)                | Circom 2.1.x             |
| Hashing (circuit)     | Poseidon                                        | circomlib                |
| Signatures (circuit)  | BabyJubJub EdDSA-Poseidon                       | circomlib                |
| Hashing (off-circuit) | SHA-256, keccak256                              | WebCrypto, Solidity      |
| Encryption            | AES-256-GCM, X25519 ECDH + HKDF                 | WebCrypto, @noble/curves |
| Identity              | did:ethr, did:key (Ed25519)                     | ethr-did-resolver        |
| Backend               | Fastify, Prisma, PostgreSQL 16                  | Fastify 5, PG 16         |
| Frontend              | Next.js (App Router), React 19, Tailwind CSS    | Next 15                  |
| Storage               | IPFS (Kubo), Pinata (optional)                  | Kubo 0.32.x              |
| Testing               | Hardhat/chai, vitest, circom_tester, Playwright | —                        |
| CI                    | GitHub Actions                                  | —                        |
