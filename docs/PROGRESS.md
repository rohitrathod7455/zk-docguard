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

**Status:** ✅ Complete

**What was done:**

- Configured Next.js 15 App Router with Google Fonts: `Newsreader` (editorial serif), `IBM_Plex_Sans` (neutral grotesque), and `JetBrains_Mono` (cryptographic values).
- Implemented institutional Design System tokens (`apps/web/src/styles/tokens.css` and `globals.css`) for warm archival paper light theme (`#F6F4EE`, ink `#15181D`, verdigris `#0E5A4E`) and true institutional dark slate theme (`#0F1216`, surface `#161A20`, accent `#1EB69E`).
- Implemented `ThemeProvider` with localStorage persistence and system color preference detection.
- Implemented `WalletProvider` & `WalletModal` supporting role switching (`public`, `issuer`, `holder`, `verifier`, `admin`), network indicator (Hardhat 31337 / Amoy 80002 / Sepolia 11155111), and 4 pre-seeded demo accounts (Admin, Northfield University Issuer, Alex Vance Holder, State Board Verifier).
- Implemented global `ToastProvider` with accessible notifications and auto-dismiss.
- Implemented core reusable UI components:
  - `Button`: Primary verdigris, secondary outline, ghost, danger, sizes (sm, md, lg), and loading spinners.
  - `Input`: Labels, hints, validation error states, prefix/suffix addons.
  - `Select`: Hairline options, custom chevron.
  - `Badge`: Semantic status tags (`valid`, `revoked`, `pending`, `neutral`, `accent`).
  - `Chip`: Monospace copyable chips with tooltip, copy feedback, and middle truncation for DIDs, CIDs, and hashes.
  - `Card`: Institutional card with header, subtitle, actions, and archival borders.
  - `Dialog`: Accessible modal with backdrop blur, focus trapping, and Escape key dismissal.
  - `Tabs`: Underline institutional tab strip.
  - `Stepper`: Real progressive stepper with step status and elapsed millisecond indicators.
  - `EmptyState`: Contextual empty states with title, description, and primary CTA.
- Implemented Section 9 signature components:
  - `CredentialCard`: Certificate double-frame aesthetic, seal watermark, serif degree title, holder details, and cryptographic chips.
  - `VerificationReceipt`: Printable archival receipt with verified attributes, in-circuit satisfied predicates, HMAC signature, print stylesheet, and JSON download.
  - `ConsentSheet`: Pre-proving verification consent sheet showing verbatim disclosed attributes, proven predicates, and hidden confidential attributes.
  - `QRCodeDisplay`: Crisp QR code generator using HTML canvas with copy and download actions.
- Implemented Web Shell:
  - `AppHeader`: Institutional branding, network pill, role switcher, design system link, theme toggle, wallet button.
  - `AppNavigation`: Secondary role-based navigation reflecting active persona routes.
  - `AppFooter`: W3C VC 1.1, Groth16 BN254, DID:ethr, and academic attribution.
  - `HomePage`: Hero statement, live document hash lookup drop zone, and 4 protocol pillars.
- Implemented interactive Component Gallery & Documentation page at `/design`:
  - Architecture & Color tokens
  - Base UI Primitives interactive testbench
  - Signature Components interactive showcase
  - Banned Patterns Compliance Sign-Off:
    - [x] Zero purple/pink or neon gradients
    - [x] Zero glassmorphism or blur halos
    - [x] Zero emoji (Lucide icons only)
    - [x] 2-4px crisp radii (no oversized rounded-2xl corners)
    - [x] Archival Newsreader serif + IBM Plex Sans + JetBrains Mono
    - [x] WCAG 2.2 AA contrast compliance & `prefers-reduced-motion`
- Production build verified: `next build` static export succeeded with 0 errors (`/`, `/design`, `/_not-found`). Monorepo passing 212 tests, clean typecheck, and clean lint.

**What is deferred:**

- Role-specific view implementations (Issuer console in Phase 6, Holder wallet in Phase 7, Verifier portal in Phase 8).

**Known issues:**

- None

---

## Phase 6 — Issuer Console and Admin

**Status:** ✅ Complete

**What was done:**

- **Administrative Governance Console (`/admin`, `/admin/issuers`, `/admin/audit`):**
  - Institutional applicant review table with status filtering (Pending, Active, Suspended, Revoked).
  - Admin approval, suspension, and role verification flows.
  - Immutable activity audit log tracking registration, approval, suspension, and anchor events.
  - Dashboard metrics for pending reviews, active issuers, anchored credentials, and batch operations.
- **Issuer Key Studio & DID Management (`/issuer/keys`, `apps/web/src/lib/keys.ts`):**
  - Deterministic BabyJubJub EdDSA proving key derivation from connected wallet signature via HKDF-SHA256.
  - Cryptographic Poseidon key hash computation (`Poseidon(pubKeyX, pubKeyY)`) matching EVM `IssuerRegistry`.
  - DID publication and formatting (`did:ethr:<chainId>:<address>`) with W3C DID document resolver links.
  - Key rotation studio supporting active key verification and 90-day grace period enforcement.
- **Single Issuance Studio (`/issuer/issue`, `apps/web/src/lib/issuance.ts`):**
  - 5-step progressive Stepper workflow:
    1. Schema & Document: 8-slot `UniversityDegree` schema form with degree level, field of study, GPA (scaled x100), graduation date, and holder DID.
    2. Document Attachment: Client-side document encryption using WebCrypto AES-256-GCM.
    3. Cryptographic Sealing: Poseidon 8-leaf commitment Merkle tree calculation and BabyJubJub EdDSA signature.
    4. On-Chain Anchoring: Contract client execution against `DocumentRegistry` recording `(docHash, credentialId, schemaId, cid, expiry)`.
    5. Delivery & Export: W3C Verifiable Credential package generation, crisp Canvas QR code display, and `.json` credential export.
- **Batch Issuance Engine (`/issuer/batch`, `apps/web/src/lib/sample-batch-data.ts`):**
  - Batch CSV processing for graduating cohorts with built-in 50-student sample cohort generator.
  - Per-row 8-slot schema validation, field scalar constraints, and holder DID resolution.
  - Batch Merkle tree construction over document hashes and credential IDs.
  - Single-transaction on-chain batch root anchoring (`anchorBatchRoot`).
  - Batch issuance manifest and delivery zip/bundle export.
- **Credentials Registry & Revocation Management (`/issuer/credentials`):**
  - Paginated registry of issued credentials with real-time status pills (Valid, Revoked, Expired).
  - Detail inspection drawer showing slot commitments, Merkle proofs, and IPFS multihashes.
  - On-chain document revocation and SMT revocation leaf publishing with reason codes.
- **API Enhancements (`apps/api`):**
  - Implemented `GET /v1/credentials` with pagination, status filtering, and issuer scoping.
  - Implemented `GET /v1/issuers` public listing with status querying.
  - Added robust cascading cleanup in test suites ensuring isolated database states.
- **End-to-End Integration Test Suite (`e2e/test/issuer-flow.test.ts`):**
  - Verified all 6 Phase 6 criteria in automated tests:
    1. Institutional application and admin approval workflow.
    2. Single credential issuance with 8-slot Poseidon schema and BabyJubJub EdDSA signature.
    3. On-chain `DocumentRegistry` verification showing anchored document hash and timestamp.
    4. IPFS storage validation verifying uploaded payload is encrypted ciphertext (asserted not valid plaintext or PDF).
    5. Credential revocation verification marking record `Revoked` and invalidating SMT non-membership witness (409 Conflict).
    6. Batch issuance of 50 students with an anchored Merkle root and manifest generation.
- **Verification & Builds:**
  - 218 total unit, circuit, contract, integration, and E2E tests passing 100% across the monorepo.
  - Clean TypeScript typecheck (`pnpm typecheck`) with 0 errors across 8 packages.
  - Clean ESLint and Solhint (`pnpm lint`) with 0 errors.
  - Next.js production build (`next build`) generating all 14 routes statically.

**What is deferred:**

- Holder wallet & in-browser ZK proof generation (Phase 7).

**Known issues:**

- None.

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
