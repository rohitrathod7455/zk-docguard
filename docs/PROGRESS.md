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

**Status:** ✅ Complete

**What was done:**

- Implemented modular Circom circuit architecture in `packages/circuits/circuits/`:
  - `templates/attribute_commit.circom`: Salted leaf commitment template computing $leaf_i = \text{Poseidon}(value_i, salt_i)$.
  - `templates/credential_tree.circom`: Depth-3 binary Merkle commitment tree matching `@zk-docguard/core` layer hashing.
  - `templates/holder_binding.circom`: Cryptographic holder identity binding ($values[0] \equiv \text{Poseidon}(holderSecret)$).
  - `templates/disclosure.circom`: Zero-leakage selective disclosure with boolean reveal mask enforcement.
  - `templates/predicate.circom`: Inequality predicates ($values[predIndex] \ge predThreshold$) with operand masking and 64-bit bounds checks.
  - `templates/disclose.circom` & `disclose.circom`: Main Mode A circuit integrating all sub-templates, BabyJubJub EdDSA-Poseidon signature verification on `credentialRoot`, expiry checks, challenge squaring dummy constraint, and public domain-separated `credentialId` output.
- Compiled circuit with Circom 2.1.9: **9,144 non-linear constraints**, 9,146 wires, 26 public signals (1 public output + 25 public inputs).
- Powers of Tau ceremony executed for $k=14$ ($2^{14} = 16,384$ points capacity), followed by Groth16 Phase 2 trusted setup, zkey contribution, and verification with snarkjs 0.7.6.
- Exported verification artifacts: `verification_key.json` and Solidity verifier `Groth16Verifier.sol` synced to `packages/contracts/src/verifiers/Groth16Verifier.sol` and `apps/web/public/zk/`.
- Implemented typed `generateCircuitInputs` in `packages/circuits/src/input-generator.ts` bridging `@zk-docguard/core` `CredentialPackage` and presentation queries to circuit inputs.
- 10 comprehensive circuit tests in `packages/circuits/test/circuit.test.ts` covering positive end-to-end proof and all negative constraint failure modes (tampered attribute, wrong issuer key, forged signature, expired credential, unmet predicate, reveal mask mismatch, secret mismatch, tampered challenge).
- On-chain Solidity verification test in `packages/contracts/test/Groth16Verifier.test.ts` validating real Groth16 proof verification on EVM with measured gas of **384,633 gas** and rejection of tampered public inputs.
- Benchmarked circuit performance across 5 iterations: **1,100.30 ms** average proving time, **19.77 ms** off-chain verification time, **723 bytes** proof size, **5.47 MB** zkey size. Saved in `benchmarks/results/circuit-benchmarks.json`.

**What is deferred:**

- Mode B circuit (sparse Merkle tree non-revocation proof in-circuit) is designated for Phase 9.

**Known issues:**

- None

---

## Phase 4 — Backend and Indexer

**Status:** ✅ Complete

**What was done:**

- Configured Prisma schema with SQLite for zero-dependency local development and testing (`apps/api/prisma/schema.prisma`).
- Implemented `apps/api/src/db/client.ts` with singleton Prisma client and graceful teardown.
- Implemented `apps/api/src/auth/siwe.ts`: replay-safe cryptographic nonces, viem EIP-4361 verification, role determination (`admin`, `issuer`, `user`), and HMAC-SHA256 session cookie sealing.
- Implemented `apps/api/src/ipfs/client.ts`: Kubo HTTP RPC client (`/api/v0/add`, `/api/v0/cat`) with deterministic content-addressed sha2-256 fallback store, tracking pins in `PinRecord`.
- Implemented `apps/api/src/services/verification.ts`: Groth16 verification via `snarkjs`, challenge binding match, $\pm 5$ min timestamp tolerance, issuer key hash trust check, database and SMT revocation verification, and HMAC-SHA256 verification receipt signing.
- Implemented `apps/api/src/services/events.ts`: SSE EventEmitter manager for real-time verification session status delivery to verifiers.
- Implemented `apps/api/src/indexer/worker.ts`: Viem blockchain indexer with reorg-safety, block confirmation depth, rollback recovery, and state tracking.
- Implemented Fastify 5 REST routes:
  - `/v1/auth`: SIWE nonce generation, signature verification, `/v1/auth/me` introspection, and `/v1/auth/logout`.
  - `/v1/issuers` & `/v1/admin/issuers`: institutional applications, directory queries, and admin approval/suspension/reinstatement.
  - `/v1/ipfs`: ciphertext upload, retrieval, and status checks.
  - `/v1/credentials`: on-chain anchored credential metadata registration and lookup.
  - `/v1/revocations`: issuer revocation recording and SMT non-membership exclusion witness generation for Mode B.
  - `/v1/sessions`: verification session creation with QR payload, challenge generation, Groth16 presentation proof submission, and SSE live streams (`/v1/sessions/:id/events`).
  - `/v1/verify`: public direct proof verification and batch status queries.
  - `/v1/health` & `/v1/metrics`: server status, uptime, and database metrics.
- OpenAPI Swagger documentation served at `/docs` with interactive Swagger UI.
- Seed script `apps/api/scripts/seed.ts` populating Northfield Institute of Technology demo credentials.
- 48 API integration tests passing across 8 test suites.
- Backend test line coverage measured: **91.02%** (exceeding target $\ge 85\%$).
- Entire monorepo passing 212 tests (contracts: 68, core: 86, circuits: 10, api: 48), clean typecheck, and clean lint.

**What is deferred:**

- Mode B in-circuit SMT verification (Phase 9).
- Production PostgreSQL connection string (switchable via `DATABASE_URL` in `.env`).

**Known issues:**

- None

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
