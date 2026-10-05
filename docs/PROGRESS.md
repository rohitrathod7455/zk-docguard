# ZK-DocGuard — Progress Tracker

> Updated at the end of each phase.

---

## Phase 0 — Foundation

**Status:** ✅ Complete

**What was done:**

- Initialized pnpm monorepo with Turborepo
- Created workspace packages: `contracts`, `circuits`, `core`, `config`, `api`, `web`, `e2e`, `benchmarks`
- Shared configs: strict TypeScript, ESLint (flat config), Prettier, Solhint
- Docker Compose with PostgreSQL 16, IPFS Kubo, Hardhat node
- `.env.example` with all known environment variables
- GitHub Actions CI (install, lint, typecheck, test, build, gitleaks)
- Architecture documentation with Mermaid diagrams
- Circom compiler 2.1.9 and snarkjs 0.7.6 installed and verified
- Placeholder contracts, tests, and API server to validate the pipeline

**What is deferred:**

- Docker daemon is not installed on the current dev machine; `docker compose up` validated structurally; local Hardhat node, local SQLite/Postgres can be used for dev.

**Known issues:**

- None

---

## Phase 1 — Smart Contracts

**Status:** ✅ Complete

**What was done:**

- Implemented `IssuerRegistry`, `DocumentRegistry`, and `RevocationRegistry` with custom errors, events, and NatSpec documentation.
- Implemented OpenZeppelin v5 AccessControl, Pausable, and MerkleProof for batch issuance.
- Implemented key rotation with configurable grace window (default 7 days) and 32-slot ring buffer for SMT roots.
- 68 test cases across 4 test suites passing with **98.71%** line coverage (target ≥ 95%).
- Slither 0.11.6 static analysis passed with 0 high and 0 medium findings (accepted findings documented in `DECISIONS.md`).
- Solhint passed with 0 errors and 0 warnings.
- Gas reporting configured and real measurements captured in `packages/contracts/gas-report.txt`.
- ABIs and deployment addresses exported to `@zk-docguard/core`.
- Deployment and verification scripts created (`deploy.ts`, `verify-scan.ts`, `export-artifacts.ts`) and verified on Hardhat network (`deployments/hardhat.json`).

**What is deferred:**

- Live broadcast to Polygon Amoy (chainId 80002) and Sepolia (chainId 11155111) is ready via `pnpm deploy:amoy` / `pnpm deploy:sepolia` when funded deployer private key is supplied in `.env`.

**Known issues:**

- None

---

## Phase 2 — Core Library

**Status:** ✅ Complete

**What was done:**

- Implemented RFC 8785 JSON Canonicalization Scheme (JCS) via `canonicalJson()`.
- Implemented BN254 scalar field arithmetic, bounds validation, and 253-bit deterministic string/bytes-to-field element mapping (`MASK_253_BITS`), eliminating modular reduction bias.
- Implemented Poseidon multi-input and 2-input hashing, leaf commitment computation, domain-separated `credentialId` derivation (`Poseidon(root, 1)`), and issuer key hash generation.
- Implemented deterministic BabyJubJub EdDSA key derivation from Ethereum wallet `personal_sign` signatures (RFC 6979) via HKDF-SHA256.
- Implemented BabyJubJub EdDSA-Poseidon credential signing and verification with complete tamper rejection.
- Implemented depth-3, 8-leaf binary Poseidon Merkle commitment tree builder with Merkle audit proof generation and cryptographic path verification.
- Implemented client-side AES-256-GCM encryption/decryption with WebCrypto APIs and packed envelope serialization.
- Implemented ECIES key wrapping (X25519 ECDH + HKDF-SHA256 + AES-256-GCM) with verifier-scoped expiration timestamps.
- Implemented gasless browser-based holder SSI identity (`did:key:z...`) with Base58btc codec and W3C DID document resolver.
- Implemented `did:ethr` parser and extended issuer DID document generator supporting `ZkDocGuardBabyJubJubKey2026`.
- Defined canonical JSON Schema for `UniversityDegree` with 8 pinned attribute slots, precomputed `DEGREE_SCHEMA_ID`, and typed slot encoder.
- Implemented dynamic `SchemaRegistry` with validation against JSON schema definitions.
- Implemented W3C Verifiable Credential builder (`issueUniversityDegreeCredential`) and verifier (`verifyUniversityDegreeCredential`) with full cryptographic and structural validation.
- Implemented Sparse Merkle Tree (SMT) revocation helper wrapping `circomlibjs.newMemEmptyTrie()`, generating inclusion and non-membership exclusion witnesses with padded siblings for Circom Mode B non-revocation proofs.
- Implemented viem smart contract client wrappers for `IssuerRegistry`, `DocumentRegistry`, and `RevocationRegistry` with high-level on-chain query helpers.
- Test suite: **86 unit tests passing across 11 test suites** with **94.62% line coverage** and **97.36% function coverage** (exceeding the ≥ 90% requirement).
- Format, lint, typecheck, build, and tests verified across the entire monorepo.

**What is deferred:**

- None

**Known issues:**

- None

---

## Phase 3 — Circuits and Trusted Setup

**Status:** 🔲 Not started

---

## Phase 4 — Backend and Indexer

**Status:** 🔲 Not started

---

## Phase 5 — Design System and Web Shell

**Status:** 🔲 Not started

---

## Phase 6 — Issuer Console and Admin

**Status:** 🔲 Not started

---

## Phase 7 — Holder Wallet and In-Browser Proving

**Status:** 🔲 Not started

---

## Phase 8 — Verifier and Public Verification

**Status:** 🔲 Not started

---

## Phase 9 — Privacy-Preserving Revocation, Gateway, Sharing

**Status:** 🔲 Not started

---

## Phase 10 — Testing, Security Review, Benchmarks

**Status:** 🔲 Not started

---

## Phase 11 — Deployment and Demo

**Status:** 🔲 Not started

---

## Phase 12 — Report, Patent Package, Presentation

**Status:** 🔲 Not started
