# ZK-DocGuard — Master Build Prompt

> Save this file in the repo root as `MASTER_PROMPT.md`. Start the agent with:
> **"Read MASTER_PROMPT.md fully. Begin with Phase 0. Stop at the end of each phase and wait for my 'proceed'."**

---

## 1. Mission

Build **ZK-DocGuard: A Privacy-Preserving Blockchain Document Verification System using Zero-Knowledge Proofs and Self-Sovereign Identity** as a working, end-to-end, demo-ready system, plus the complete academic and patent documentation for it. This is a final-year major project that will be evaluated live and used to draft a patent filing. Everything must actually run. Nothing may be faked.

**System summary**

- **Issuers** (institutions) are approved on-chain, then issue credentials. A document hash and metadata are anchored on an EVM testnet (Polygon Amoy primary, Sepolia secondary, local Hardhat node for development).
- The **document itself** is encrypted client-side (AES-256-GCM) and stored on IPFS. The ciphertext CID is anchored on-chain. The backend never sees plaintext.
- **Holders** keep credentials in a browser-based SSI wallet (DID + Verifiable Credentials). They generate **Zero-Knowledge proofs** (Circom + snarkjs, Groth16) in the browser, disclosing only chosen attributes or predicates (for example: "degree = B.Tech", "graduation year ≥ 2020", "issuer is trusted", "not revoked") without revealing the full document.
- **Verifiers** create a verification request, show a QR code, and receive a verified result within seconds. They can also check a raw document by dropping the file to hash-check it against the chain.
- **Revocation** is supported in two modes: a simple on-chain flag (public credentialId), and a privacy-preserving mode using a sparse Merkle tree (SMT) with in-circuit non-membership proofs.

---

## 2. Operating protocol (follow strictly)

1. **Work phase by phase** (Phases 0 → 12 below). Do not start a phase until the previous phase's exit criteria pass.
2. **At the start of every phase:** read `docs/PROGRESS.md` and `docs/DECISIONS.md`, restate the phase goal in 3–5 lines, list the files you will create or change, then implement.
3. **At the end of every phase:**
   - Run the full verification for that phase (tests, typecheck, lint, build). Paste the real command output summary.
   - Update `docs/PROGRESS.md` (what is done, what is deferred, known issues).
   - Commit with Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), one logical commit per task, then tag `phase-N-complete`.
   - Print a **Phase Report**: what was built, how to run/verify it, exit-criteria checklist (✔/✘), risks. **Then stop and wait for "proceed".** If I say "autopilot", continue automatically but still stop on any failing exit criterion.
4. **No placeholders in shipped code.** No `TODO: implement`, no mocked proofs, no hardcoded "verified: true", no fake IPFS. Dev stand-ins are allowed only if they are real local services (Kubo in Docker, Hardhat node, Postgres in Docker).
5. **Never fabricate numbers.** Every performance figure, gas value, constraint count, or proof time in documentation must come from a measured benchmark run committed under `benchmarks/results/`. If not measured yet, write "to be measured".
6. **Never invent library APIs.** Pin versions in `package.json`. Before using any library, check its installed version and read its types or README in `node_modules`. If an API differs from what this prompt suggests, adapt and record it in `docs/DECISIONS.md`.
7. **Decisions:** if something is ambiguous, pick the option consistent with this prompt, record it in `docs/DECISIONS.md` (context, options, choice, consequence), and continue. Ask me only when blocked by something you cannot create yourself (RPC URL, funded testnet key, Pinata JWT). List those in `.env.example` and in the Phase Report.
8. **Security hygiene:** no secrets in git, `.env.example` only, `gitleaks` or equivalent in CI, dependencies audited, strict TypeScript (`"strict": true`, no `any` without a comment).
9. **Quality bar:** every module has tests. Every public function has a doc comment explaining its security assumptions. Code is formatted (prettier, solhint) and passes CI.
10. **Environment:** Node 20 LTS, pnpm 9, Docker + Docker Compose, Circom 2.1.x binary, Rust toolchain only if needed to build Circom. Verify each tool exists at Phase 0 and install what is missing.

---

## 3. Pinned architecture decisions

| Layer                       | Choice                                                                                                                                                          | Reason                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Monorepo                    | pnpm workspaces + Turborepo                                                                                                                                     | Shared types and ABIs across contracts, API, web                        |
| Contracts                   | Solidity 0.8.24, Hardhat (TypeScript), ethers v6, OpenZeppelin Contracts v5, `evmVersion: "paris"` unless the target chain is verified to support newer opcodes | Mature tooling, gas reporter, coverage; testnet-safe bytecode           |
| Chains                      | Hardhat local → Polygon Amoy (chainId 80002) → Sepolia (11155111)                                                                                               | Mumbai is deprecated; Amoy is the current Polygon testnet               |
| ZK                          | Circom 2.1.x, circomlib, snarkjs (Groth16, BN254), circomlibjs, `circom_tester`                                                                                 | Smallest proofs, cheapest on-chain verification, browser-capable (WASM) |
| Hash / signature in circuit | Poseidon, BabyJubJub EdDSA-Poseidon                                                                                                                             | SNARK-friendly; far fewer constraints than SHA-256 or ECDSA in-circuit  |
| Off-circuit hash            | SHA-256 (document bytes), keccak256 (on-chain keys)                                                                                                             | Standard, interoperable                                                 |
| Encryption                  | WebCrypto AES-256-GCM (per-document key); key wrapping via X25519 ECDH + HKDF-SHA256 (ECIES-style) with `@noble/curves`                                         | Client-side confidentiality, no plaintext on server                     |
| Storage                     | IPFS via Kubo (Docker) for dev; Pinata as optional pinning for the deployed demo                                                                                | Content-addressed, real IPFS                                            |
| Identity                    | `did:ethr` for issuers (ethr-did-resolver), `did:key` (Ed25519) for holders; W3C VC Data Model 1.1                                                              | Issuers need on-chain-anchored rotation; holders need no gas            |
| Backend                     | Node.js, TypeScript, Fastify, Zod, Prisma, PostgreSQL 16, pino, SIWE for issuer/admin auth                                                                      | Typed, fast, testable                                                   |
| Frontend                    | Next.js (App Router), TypeScript, Tailwind CSS + Radix primitives (own components, not a stock kit look), TanStack Query, wagmi + viem (custom connect UI)      | Production-grade, SSR for public pages                                  |
| QR                          | `qrcode` (generate), `@yudiel/react-qr-scanner` or `html5-qrcode` (scan)                                                                                        | Works on mobile browsers                                                |
| Testing                     | Hardhat/chai, vitest, circom_tester (mocha), Playwright, k6 (load)                                                                                              | Full pyramid                                                            |
| Static analysis             | Slither, solhint, eslint, tsc                                                                                                                                   | Security baseline                                                       |
| CI                          | GitHub Actions                                                                                                                                                  | Reproducible checks                                                     |

---

## 4. Repository layout

```
zk-docguard/
├─ MASTER_PROMPT.md
├─ README.md                    # quickstart, architecture, demo script
├─ docker-compose.yml           # postgres, kubo (ipfs), hardhat node
├─ turbo.json  pnpm-workspace.yaml  .env.example  .github/workflows/ci.yml
├─ docs/
│  ├─ PROGRESS.md  DECISIONS.md  ARCHITECTURE.md  THREAT_MODEL.md
│  ├─ report/            # 01-abstract.md … 12-references.md (Phase 12)
│  ├─ patent/            # novelty.md, claims.md, prior-art-notes.md
│  └─ diagrams/          # Mermaid sources + exported SVG
├─ packages/
│  ├─ contracts/         # Hardhat project (src, test, scripts, deploy, abi export)
│  ├─ circuits/          # circom, build scripts, ptau, zkeys, tests
│  ├─ core/              # shared TS lib: crypto, DID, VC, schema, field encoding, SMT
│  └─ config/            # shared tsconfig, eslint, prettier
├─ apps/
│  ├─ api/               # Fastify service, Prisma, chain indexer
│  └─ web/               # Next.js app (issuer console, wallet, verifier, public)
├─ benchmarks/           # scripts + results/*.json + charts
└─ e2e/                  # Playwright + full-scenario scripts
```

---

## 5. Core cryptographic and data design

Implement exactly this unless a flaw is found; if you find one, document it in `DECISIONS.md` and propose the fix.

### 5.1 Credential model

A credential has **8 fixed attribute slots** (each a BN254 field element) defined by a **schema** (`schemaId` = Poseidon of the canonical schema JSON). Default `UniversityDegree` schema:

| Slot | Attribute        | Encoding                                                   |
| ---- | ---------------- | ---------------------------------------------------------- |
| 0    | holderCommitment | `Poseidon(holderSecret)`                                   |
| 1    | schemaId         | field element                                              |
| 2    | degreeCode       | enum → integer (e.g., B.Tech = 1, M.Tech = 2, …)           |
| 3    | programCode      | enum/hash → integer                                        |
| 4    | graduationYear   | integer (e.g., 2025)                                       |
| 5    | cgpaX100         | integer (e.g., 8.74 → 874)                                 |
| 6    | studentIdHash    | `Poseidon`/SHA-256 truncated to 253 bits of the student ID |
| 7    | expiry           | UNIX seconds (use a far-future value for "no expiry")      |

String → field: SHA-256 of canonical bytes, truncated to 253 bits (or Poseidon over chunks). Document the exact function in `packages/core` with test vectors.

### 5.2 Commitments

- `leaf_i = Poseidon(value_i, salt_i)` where `salt_i` is a fresh random 253-bit value per attribute.
- `credentialRoot` = Poseidon binary Merkle root of the 8 leaves (depth 3).
- Issuer signs `credentialRoot` with BabyJubJub **EdDSA-Poseidon** → `(R8x, R8y, S)`.
- `issuerKeyHash = Poseidon(Ax, Ay)` (the issuer's BabyJubJub public key). This hash is anchored in `IssuerRegistry`.
- `credentialId = Poseidon(credentialRoot, 1)` (domain-separated). Known to issuer and holder, used for revocation.
- `docHash = SHA-256(document bytes)` for full-document verification (separate, non-ZK path).

### 5.3 Key management

- **Issuer proving key:** derived deterministically in the issuer's browser from a wallet signature over a fixed domain message (`personal_sign` → HKDF → BabyJubJub private key). The private key is never sent to or stored on the server. Document the caveat: the wallet must produce deterministic signatures (RFC 6979). Provide an optional server-side signer behind an env flag for institutional batch issuance, off by default.
- **Holder wallet:** secrets (`holderSecret`, Ed25519 DID key, X25519 key) generated in the browser, stored in IndexedDB encrypted with a key derived from a passphrase (PBKDF2 ≥ 600k iterations or Argon2id via WASM). Provide encrypted backup export/import (recovery file) and a recovery phrase flow.
- **Document key wrapping:** per-document random AES-256-GCM key; wrapped to the holder's X25519 public key and, on demand, to a verifier's ephemeral X25519 key (time-limited share).

### 5.4 Verifiable Credential format

Issue a W3C VC (JSON) containing: `@context`, `type: ["VerifiableCredential","UniversityDegreeCredential"]`, `issuer` (did:ethr), `credentialSubject` (holder did:key plus `holderCommitment`), `credentialStatus` (registry address + `credentialId`), and **two proofs**:

1. `proof` type `ZkDocGuardPoseidonEdDSA2026` (the BabyJubJub signature over `credentialRoot`, plus the salts and attribute list delivered to the holder only).
2. A standard JWT-VC (ES256K via the issuer's did:ethr key) for full-disclosure interoperability.

The issuer's DID document lists the BabyJubJub key as a custom verification method; resolution must work through the standard resolver plus a small local extension.

### 5.5 On-chain vs off-chain vs on-device

| Data                                                                  | On-chain | IPFS                   | API DB              | Holder device |
| --------------------------------------------------------------------- | -------- | ---------------------- | ------------------- | ------------- |
| Issuer record (DID, key hash, status, metadata URI, key epoch)        | ✔        | metadata JSON optional | cached profile      | —             |
| docHash, ciphertext CID, schemaId, credentialId, expiry, revoked flag | ✔        | —                      | indexed copy        | —             |
| Revocation SMT root (+ root history)                                  | ✔        | —                      | full SMT leaves     | —             |
| Encrypted document                                                    | —        | ✔                      | CID pin record only | wrapped key   |
| Attribute values, salts, signature                                    | —        | —                      | **never**           | ✔ (encrypted) |
| Holder secrets and private keys                                       | —        | —                      | **never**           | ✔ (encrypted) |
| Verification sessions (nonce, request, status)                        | —        | —                      | ✔                   | —             |
| Audit log (no personal data)                                          | —        | —                      | ✔                   | —             |

---

## 6. Smart contract specification (`packages/contracts`)

Use custom errors, events for every state change, NatSpec on everything, `Pausable` and `AccessControl` from OpenZeppelin v5. Target ≥ 95% line coverage and a clean Slither run (document any accepted findings).

**`IssuerRegistry`**

- `struct Issuer { string did; bytes32 zkKeyHash; string metadataURI; Status status; uint64 registeredAt; uint32 keyEpoch; }` with `Status { None, Pending, Active, Suspended, Revoked }`.
- Functions: `applyAsIssuer(did, zkKeyHash, metadataURI)`, `approveIssuer(address)`, `suspendIssuer`, `reinstateIssuer`, `revokeIssuer` (admin only), `rotateKey(newZkKeyHash)` (issuer; increments `keyEpoch`; old key stays valid for a configurable grace window), `isActiveKey(bytes32 zkKeyHash) → bool`, `issuerOfKey(bytes32) → address`.
- Events: `IssuerApplied`, `IssuerApproved`, `IssuerSuspended`, `IssuerReinstated`, `IssuerRevoked`, `KeyRotated`.

**`DocumentRegistry`**

- `struct Record { address issuer; bytes32 credentialId; bytes32 schemaId; string cid; uint64 issuedAt; uint64 expiry; bool revoked; }`
- `registerDocument(bytes32 docHash, bytes32 credentialId, bytes32 schemaId, string cid, uint64 expiry)` — only active issuers; reverts on duplicates.
- `registerBatch(bytes32 batchRoot, uint32 count, string manifestCid)` — anchors a Merkle root of many docHashes for cheap bulk issuance; `verifyInBatch(batchRoot, docHash, proof[])`.
- `revokeDocument(bytes32 docHash, bytes32 reasonCode)` — only the issuing issuer.
- `verifyDocument(bytes32 docHash) → (Status, address issuer, uint64 issuedAt, uint64 expiry)` view, where Status ∈ {Unknown, Valid, Expired, Revoked, IssuerSuspended}.
- Events: `DocumentRegistered`, `BatchRegistered`, `DocumentRevoked`.

**`RevocationRegistry`**

- v1: `revokeCredential(bytes32 credentialId)` (only the credential's issuer), `isRevoked(bytes32) → bool`.
- v2 (Phase 9): per-issuer SMT root: `updateRevocationRoot(bytes32 issuerKeyHash, bytes32 newRoot)`; ring buffer of the last 32 roots; `isValidRoot(bytes32 issuerKeyHash, bytes32 root) → bool`; event `RevocationRootUpdated(issuerKeyHash, root, epoch)`.

**`Groth16Verifier`**: generated by `snarkjs zkey export solidityverifier`. Never hand-edit; regenerate via script.

**`VerifierGateway`** (Phase 9)

- `verifyPresentation(uint[2] a, uint[2][2] b, uint[2] c, uint[] pubSignals) view → (bool ok, uint8 reasonCode)`: checks the Groth16 proof, `IssuerRegistry.isActiveKey(issuerKeyHash)`, `RevocationRegistry.isValidRoot(...)`, and that `currentTime` is within ±5 minutes of `block.timestamp`.
- `consumeAndVerify(...)` non-view variant that records the challenge nonce to prevent replay (used to measure on-chain gas).

**Tests (minimum):** role and access control for every restricted function; duplicate registration; revoke then verify; expired document; suspended issuer invalidates new issuance and shows in `verifyDocument`; key rotation grace window; batch Merkle proof valid and invalid; pausing; fuzz tests on batch proofs; gas snapshot per function.

---

## 7. Circuit specification (`packages/circuits`)

**Circuit: `Disclose(N=8, SMT_LEVELS=20)`** (final level count chosen and justified in `DECISIONS.md`).

_Private inputs:_ `values[8]`, `salts[8]`, `holderSecret`, issuer key `(Ax, Ay)`, signature `(R8x, R8y, S)`, and (Mode B) SMT non-membership witness (siblings, `oldKey`, `oldValue`, `isOld0`) per circomlib's `SMTVerifier` exclusion mode.

_Public inputs:_ `issuerKeyHash`, `revealMask[8]`, `revealedValues[8]`, predicate parameters (`P = 2` predicates: `predEnable[P]`, `predIndex[P]`, `predThreshold[P]`, each meaning `values[predIndex] ≥ predThreshold`; "≤" is expressed by encoding the attribute inverted or a second comparator template), `currentTime`, `challenge`, and (Mode B) `revocationRoot`. In Mode A, `credentialId` is a public output instead of `revocationRoot`.

_Constraints:_

1. Recompute all 8 leaves with Poseidon and the Merkle root `credentialRoot`.
2. Verify `EdDSAPoseidonVerifier(Ax, Ay, R8x, R8y, S, credentialRoot)`.
3. `Poseidon(Ax, Ay) === issuerKeyHash`.
4. Holder binding: `values[0] === Poseidon(holderSecret)`.
5. Selective disclosure: each `revealMask[i]` is boolean; `revealMask[i] * (values[i] - revealedValues[i]) === 0`; `(1 - revealMask[i]) * revealedValues[i] === 0`.
6. Predicates: select `values[predIndex]` with a multiplexer, enforce `GreaterEqThan(bits)` when enabled (range-check operands to avoid wrap-around).
7. Expiry: `values[7] ≥ currentTime` (bit-width constrained).
8. Challenge binding: constrain `challenge` with a dummy squaring so it cannot be optimized out; the verifier supplies `challenge = Poseidon(nonce, verifierDomainHash)`.
9. Revocation: Mode A outputs `credentialId = Poseidon(credentialRoot, 1)`; Mode B proves non-membership of `credentialId` in the SMT with root `revocationRoot`.

**Pipeline scripts** (`pnpm circuits:build`): compile → download or verify the Hermez Powers of Tau file sized to the measured constraint count → `groth16 setup` → at least one real phase-2 contribution → verify zkey → export `verification_key.json` → export Solidity verifier → copy wasm and zkey to `apps/web/public/zk/` and verifier to `packages/contracts`. State clearly that a single-contributor dev setup is not production-grade.

**Circuit tests (circom_tester + snarkjs):** valid proof passes; tampered attribute fails; wrong issuer key fails; forged signature fails; revoked credential fails (Mode B); expired fails; predicate unmet fails; mask reveals wrong value fails; different `holderSecret` fails; challenge changed after proving fails verification; Solidity verifier accepts the same proof; report constraint count.

---

## 8. Backend specification (`apps/api`)

**Auth:** SIWE (EIP-4361) → httpOnly, SameSite=strict session cookie; roles from chain state (`admin`, `issuer`).
**Chain indexer:** background worker subscribes to contract events with reorg-safe confirmations and backfill; caches issuer and document state in Postgres.
**Prisma models (outline):** `Issuer`, `IssuanceBatch`, `CredentialRecord` (docHash, credentialId, schemaId, cid, status, txHash, issuer; **no attributes**), `VerificationSession` (id, verifierName, domain, requestJson, nonce, challenge, expiresAt, status, resultJson, receiptSig), `RevocationLeaf` (issuerKeyHash, credentialId, revokedAt, smtIndex), `SmtRoot` (issuerKeyHash, root, epoch, txHash), `PinRecord` (cid, size, pinnedAt), `AuditLog`.

**Endpoints (`/v1`, all Zod-validated, OpenAPI generated):**

- `POST /auth/siwe/nonce`, `POST /auth/siwe/verify`, `POST /auth/logout`
- `POST /issuers/apply`, `GET /issuers/:address`, `GET /admin/issuers?status=`, `POST /admin/issuers/:address/approve|suspend`
- `POST /ipfs/upload` (ciphertext only, size and type limits, rate limited) → `{cid}`; `GET /ipfs/:cid`
- `POST /credentials/anchor` (records tx info after the issuer's wallet sends the transaction), `GET /credentials/by-doc-hash/:hash`
- `POST /revocations` (issuer-signed), `GET /revocations/:issuerKeyHash/witness/:credentialId` (SMT non-membership witness, Phase 9)
- `POST /sessions` (verifier creates request) → `{sessionId, qrPayload, nonce, expiresAt}`; `GET /sessions/:id` (wallet fetches request); `POST /sessions/:id/presentation` (wallet submits `{proof, publicSignals}`); `GET /sessions/:id/events` (SSE for live status)
- `POST /verify/document` (hash lookup result), `GET /health`, `GET /metrics`

**Presentation verification logic (server):** `snarkjs.groth16.verify` with the verification key → compare public signals to the stored request (mask, revealed values, predicates, challenge, `currentTime` window) → check `issuerKeyHash` active on-chain and listed in the request's trusted issuers → check revocation (flag or root validity) → record result → emit SSE → return a signed verification receipt.

**Hardening:** Helmet, strict CORS, rate limiting, request size limits, idempotency keys on anchoring, structured logs without personal data, graceful shutdown.

---

## 9. Frontend design brief (`apps/web`)

**Goal:** a calm, credible, institutional product that looks designed by a human product team. It must not look like generated UI.

**Banned patterns:** purple/blue-pink gradients, glassmorphism, neon glows, emoji as icons, centered "hero + three identical feature cards" layouts, oversized rounded corners on everything, stock illustrations, generic slogans ("Revolutionizing…", "Next-gen…"), lorem ipsum, fake testimonials, floating blobs, gratuitous animation, identical card grids for every section.

**Design system**

- **Palette (tokens in CSS variables):** warm paper background `#F6F4EE`, ink `#15181D`, muted ink `#5B6068`, hairline `#DAD6CB`, one deep accent (verdigris `#0E5A4E`), semantic states: valid `#1F7A4D`, revoked `#A3302B`, pending/expired `#9A6A00`. Dark theme as a true, tested alternative (not just inverted colors).
- **Type:** a serif for headings (Source Serif 4 or Newsreader), a neutral grotesque for UI (IBM Plex Sans or Geist), a monospace for hashes/CIDs/DIDs (IBM Plex Mono or JetBrains Mono). Load with `next/font`. Tight, deliberate scale (e.g., 12/14/16/20/28/40).
- **Shape and depth:** 2–4px radii, 1px hairline borders, almost no shadows, strong alignment on a 12-column grid, generous but disciplined whitespace, left-aligned editorial layouts, dense and readable tables.
- **Icons:** Lucide only, one stroke width. No emoji anywhere in the UI.
- **Motion:** 150–200ms ease-out for state changes only; respect `prefers-reduced-motion`.

**Signature components (hand-built):**

- **Credential card:** looks like a certificate (hairline frame, issuer line, serif title, mono ID, a quiet seal mark), not a SaaS tile.
- **Verification receipt:** a printable "receipt" with status, issuer DID, truncated tx hash + copy button + explorer link, timestamp, and exactly which claims were proven.
- **Proof progress:** a real stepper bound to actual work (loading circuit → computing witness → generating proof → local self-check → submitting), with elapsed time per step.
- **Consent sheet:** before any proof, show verbatim: who is asking, what will be **revealed**, what will only be **proven** (predicates), and what stays **hidden**.
- **Hash/CID/DID chips:** monospace, middle-truncated, copyable, full value on hover/focus.
- **Data tables:** sticky headers, sortable, keyboard navigable, real empty states with a specific next action.

**Information architecture**

- **Public:** Home (concise statement of what it does, a live "verify a document" drop zone, short "How it works" with an accurate diagram), How it works (technical explainer with the real protocol), Verify document (drag-drop file → hash → on-chain lookup), Verify result page (shareable receipt).
- **Issuer console:** Overview (counts, recent activity), Issue credential (form from schema → encrypt → pin → sign → anchor, with a step log), Batch issue (CSV upload with validation preview), Credentials (search, status, revoke), Issuer profile and key rotation.
- **Holder wallet (mobile-first, PWA):** Onboarding (create wallet, passphrase, recovery file), Credentials list, Credential detail (decrypt and view document, share), Present (scan QR → consent → proof → done), Activity history, Settings and backup.
- **Verifier:** New request (choose claims and thresholds, trusted issuers) → QR screen with live status → result receipt; request history.
- **Admin:** Issuer applications (approve, suspend), registry overview.

**Quality requirements:** WCAG 2.2 AA, full keyboard use, visible focus states, proper form errors, skeleton loaders, optimistic UI where safe, responsive from 360px, Lighthouse ≥ 90 (performance and accessibility) on public pages, strict CSP (no inline scripts), proofs run in a **Web Worker** so the UI never blocks, zkey cached with the Cache API, and all copy written like real product copy (specific, plain, no hype). Seed a fictional but realistic demo institution (for example "Northfield Institute of Technology") with believable data.

---

## 10. Phases

Each phase: **Goal → Tasks → Exit criteria.** Do not skip exit criteria.

### Phase 0 — Foundation

**Goal:** reproducible monorepo and dev environment.
**Tasks:** initialize pnpm + Turborepo; shared configs (tsconfig strict, eslint, prettier, solhint); `docker-compose.yml` (Postgres 16, Kubo, Hardhat node); `.env.example`; CI workflow (install, lint, typecheck, test, build, gitleaks); `docs/PROGRESS.md`, `DECISIONS.md`, `ARCHITECTURE.md` (Mermaid: context diagram, component diagram, issuance / presentation / revocation sequence diagrams); verify and install Node, pnpm, Docker, Circom, snarkjs.
**Exit:** `pnpm i && pnpm lint && pnpm typecheck && pnpm test` green on a fresh clone; `docker compose up` brings up Postgres, Kubo, and a local chain; CI green; architecture doc renders.

### Phase 1 — Smart contracts

**Goal:** registry layer complete and tested.
**Tasks:** implement `IssuerRegistry`, `DocumentRegistry`, `RevocationRegistry` (v1) per section 6; deploy scripts with deterministic addresses per network, ABI and address export to `packages/core`; gas reporter; coverage; Slither; deploy to Hardhat local and Polygon Amoy (and Sepolia if keys are available) with Etherscan/Polygonscan verification scripts.
**Exit:** all tests pass; coverage ≥ 95%; Slither has no high or medium findings (or each is documented); gas table committed; deployed addresses recorded in `deployments/*.json`.

### Phase 2 — Core library (crypto, DID, VC, schema)

**Goal:** one shared, tested library used by API and web.
**Tasks:** canonical JSON (JCS); field-element encoding; Poseidon helpers; BabyJubJub key derivation from a wallet signature; EdDSA-Poseidon sign/verify; commitment tree builder; AES-256-GCM encrypt/decrypt streaming for files; X25519 + HKDF key wrapping; `did:ethr` and `did:key` creation/resolution (with the BabyJubJub verification-method extension); VC build/sign/verify (ZK proof type + JWT-VC); schema registry with JSON Schema and a `UniversityDegree` schema; SMT helper (circomlibjs); contract client wrappers (viem).
**Exit:** ≥ 90% coverage; known-answer test vectors committed; round-trip tests (encrypt → wrap → unwrap → decrypt; sign → verify; tamper → fail); library runs in both Node and browser (vitest browser/jsdom plus a Playwright smoke test).

### Phase 3 — Circuits and trusted setup

**Goal:** the selective-disclosure circuit (Mode A) working end to end.
**Tasks:** implement templates (`AttributeCommit`, `CredentialTree`, `Disclosure`, `Predicate`, `HolderBinding`, `Disclose`) per section 7 in Mode A; build pipeline; input generator from `packages/core` credentials; all circuit tests; export and test the Solidity verifier on the local chain; record constraint count and ptau size choice.
**Exit:** every positive and negative circuit test behaves as specified; a proof generated in Node verifies in snarkjs **and** on-chain; benchmark script prints witness time, proving time, proof size, verification key size; documented constraint count.

### Phase 4 — Backend and indexer

**Goal:** fully working API.
**Tasks:** Fastify app with plugins; Prisma schema and migrations; SIWE auth and role guards; IPFS upload/get (Kubo client, optional Pinata); indexer worker; sessions and presentation verification logic; SSE; OpenAPI; rate limiting and hardening; seed script.
**Exit:** API integration tests (vitest + Testcontainers or Docker) cover every endpoint including negative paths (bad signature, expired session, replayed nonce, oversized upload, wrong role); indexer recovers after restart and handles a simulated reorg; 85%+ coverage on API.

### Phase 5 — Design system and web shell

**Goal:** the visual and interaction foundation.
**Tasks:** Next.js app, tokens, fonts, Tailwind config, base components (button, input, select, table, dialog, toast, tabs, chips, stepper, receipt, credential card), light/dark themes, app shell and navigation per role, wallet-connect UI, SIWE flow, error and empty-state patterns, Storybook or an internal `/design` page documenting components.
**Exit:** component gallery complete; keyboard and axe accessibility checks pass; Lighthouse ≥ 90 on the shell; design review checklist against the "banned patterns" list in section 9 signed off in `PROGRESS.md`.

### Phase 6 — Issuer console and admin

**Goal:** institutions can onboard and issue.
**Tasks:** issuer application and admin approval flow; issuer key derivation UI and DID publication; single issuance (form → client-side encrypt → pin → build commitment tree → sign → anchor on-chain → deliver credential package to holder via wrapped-key link or QR); batch CSV issuance with preview, per-row errors, and a batch anchor; credentials list and revoke; key rotation.
**Exit:** Playwright e2e: admin approves issuer; issuer issues a credential; the chain shows it; the IPFS object is ciphertext (assert not a valid PDF); revoke works; batch of 50 rows succeeds with an anchored root.

### Phase 7 — Holder wallet and in-browser proving

**Goal:** holders receive, store, and present credentials.
**Tasks:** onboarding and encrypted storage; receive credential (link/QR); credential detail and document decryption; presentation flow (scan QR → fetch request → consent sheet → Web Worker proving with progress → submit); activity history; encrypted backup export/import; PWA manifest and offline shell.
**Exit:** e2e: wallet created, credential received, proof generated and accepted; the network log of a presentation shows **no** plaintext attributes beyond the revealed ones; proving does not block the UI thread; backup restore reproduces credentials.

### Phase 8 — Verifier and public verification

**Goal:** the live verification experience.
**Tasks:** request builder (claims and thresholds, trusted issuers, validity window); QR screen with SSE live status; result receipt (printable, shareable); public document verify (drag-drop → hash → registry lookup, plus optional ZK path); verifier history.
**Exit:** full scenario passes in Playwright with two browser contexts (verifier and holder-on-mobile viewport): request → scan → consent → proof → verified in the verifier UI; end-to-end time measured and recorded; expired session, wrong issuer, and unmet predicate each show correct, human-readable failure states.

### Phase 9 — Privacy-preserving revocation, gateway, and sharing

**Goal:** the advanced contributions, built on a working core.
**Tasks:** SMT revocation service (persisted tree, batched root updates on-chain, root history); Mode B circuit (in-circuit non-membership) and re-run the full pipeline; `VerifierGateway` (view and consuming variants); witness endpoint and wallet integration (fetch fresh non-membership witness before proving); verifier-scoped time-limited document sharing (re-wrap the document key to a verifier ephemeral X25519 key; link expires); key-rotation grace handling end to end.
**Exit:** revoked credential can no longer produce a valid Mode B proof (negative e2e); non-revoked proofs remain valid after other credentials are revoked; stale-root rejection works; on-chain `consumeAndVerify` gas measured; Mode A remains functional as a switchable configuration.

### Phase 10 — Testing, security review, benchmarks

**Goal:** evidence for the report and patent.
**Tasks:**

- _Test hardening:_ property-based tests for encoding and tree code; contract fuzzing (Foundry or Echidna optional); negative e2e suite; accessibility suite; coverage gate in CI.
- _Security:_ STRIDE-based `THREAT_MODEL.md` (assets, trust boundaries, attacker types, mitigations, residual risks) covering: forged issuer, replay, credential sharing between holders, malicious verifier linkage, front-running, issuer key compromise, trusted-setup toxic waste, IPFS availability and CID enumeration, XSS against the wallet, session fixation, supply-chain risk. Run Slither, `npm audit`/`pnpm audit`, and ZAP baseline against the API.
- _Benchmarks (`benchmarks/`):_ constraint counts; zkey and wasm size; witness time and proving time on desktop and mid-range mobile (record device); proof size; verification time (Node, browser, on-chain gas for each contract function and for `consumeAndVerify`); end-to-end latency (QR scan to verified UI); issuance throughput (single vs batch gas per document); SMT update time at 1k, 10k, 100k leaves; API load test with k6; IPFS upload/retrieval latency by file size. Output JSON plus charts (SVG/PNG).
  **Exit:** CI gates enforce coverage and lint; threat model complete; benchmark JSON committed with reproducible scripts; no unresolved high-severity findings.

### Phase 11 — Deployment and demo

**Goal:** a reliable live demo.
**Tasks:** production Dockerfiles; deploy API and Postgres (Railway/Fly/Render) and web (Vercel or the same host); contracts on Polygon Amoy with verified source; Pinata fallback; seeded demo institution and three demo holders; a one-command `pnpm demo` that runs the whole scenario (issue → present → verify → revoke → re-verify fails); a 7-minute demo script with a fallback plan for network failures (cached chain state, pre-generated proofs); `README.md` with architecture, quickstart, and screenshots.
**Exit:** a stranger can follow the README on a clean machine and reach a working demo; live deployment passes the smoke e2e.

### Phase 12 — Report, patent package, and presentation material

**Goal:** all academic and patent deliverables, using only real, measured results.
**Tasks:** generate `docs/report/` with one file per chapter (Abstract; Introduction with problem statement, objectives, motivation, scope; Literature Review; System Architecture and Design; Technology Stack with justification; Implementation Details with real code excerpts; Algorithms and Workflows; Security Analysis; Performance Evaluation; Results and Discussion; Conclusion and Future Work; References), a combined `report.md`, and Mermaid diagrams exported to SVG. Add `docs/patent/` (see section 11), a 4–6 month timeline retrospective with phase-to-calendar mapping, a future-work chapter, a viva question-and-answer bank (≥ 40 questions), and a slide outline.
**Rules for the report:** only cite references you can verify exist; mark any uncertain reference with `[verify]`. The literature review must honestly compare against existing systems and state precisely what is different: for example Blockcerts-style hash anchoring, EBSI, Hyperledger Indy/AnonCreds, Iden3/Polygon ID, Semaphore, Sismo, zk-email, BBS+ and SD-JWT selective disclosure, W3C VC and DID specs, the IPFS paper, and the Groth16 paper. Do not claim novelty over any of them without a stated technical difference. Results chapters must use numbers from `benchmarks/results/`.
**Exit:** all 12 report chapters complete and consistent with the code; every figure traceable to a committed benchmark; diagrams render; patent documents drafted.

---

## 11. Patent package (`docs/patent/`)

Draft for review by a patent attorney. This is not legal advice. Software-implemented inventions face eligibility limits in many jurisdictions, so frame everything around the **technical effect** (reduced data exposure, reduced on-chain footprint, improved verification latency, replay resistance) and avoid describing it as an abstract business method.

**`novelty.md`:** describe 4–6 candidate technical contributions, each with problem, technical solution, difference over closest known art, and the evidence (benchmark or test) from this repo. Candidates, to be confirmed or discarded after the prior-art notes:

1. **Unified selective-disclosure presentation circuit:** a single proof that combines mask-based attribute reveal, range/threshold predicates, expiry check, issuer-key binding, and holder binding over a fixed-slot, schema-parameterized credential commitment tree.
2. **Linkage-resistant revocation:** per-issuer SMT root anchored on-chain with a root-history window, and in-circuit non-membership proof of a domain-separated credential identifier, so the verifier learns neither the identifier nor the position.
3. **Verifier-challenge binding and session protocol:** verifier-supplied challenge derived from nonce and verifier-domain hash bound inside the proof, carried by a QR-initiated session, preventing replay and cross-verifier reuse.
4. **Dual-layer anchoring:** coexistence of document-level hash anchoring (with encrypted IPFS storage) and attribute-level ZK verification under one issuance transaction, linked by a shared credential identifier, with batch anchoring via Merkle roots.
5. **Issuer key architecture:** on-chain issuer registry linking a DID to a SNARK-friendly proving-key hash, with key epochs and a grace window so credentials survive rotation while compromised keys are cut off.
6. **Verifier-scoped, time-limited document disclosure:** re-wrapping of the per-document symmetric key to an ephemeral verifier key with an expiry, so the encrypted object on IPFS is never re-uploaded or re-encrypted.

**`claims.md`:** structured outline:

- **Independent claim 1 (method):** steps: committing attributes into a salted Merkle tree; issuer signing the root with a SNARK-friendly signature; anchoring an issuer-key hash and credential identifier on a distributed ledger; receiving a verifier challenge; generating a zero-knowledge proof of signature validity, disclosure mask conformity, predicate satisfaction, and non-revocation; verifying the proof against ledger state.
- **Independent claim 2 (system):** issuer module, registry contract(s), storage module (encrypted content-addressed), holder wallet module, verifier module, with data flow between them.
- **Independent claim 3 (non-transitory medium):** instructions implementing claim 1.
- **Dependent claims:** fixed-slot schema with schema identifier in the tree; predicate comparators and expiry; SMT root history ring buffer; domain-separated credential identifier; key rotation with grace window; challenge derived from nonce and verifier domain hash; QR-initiated session; batch anchoring by Merkle root; client-side envelope encryption with per-verifier re-wrapping; proving key derived from a wallet signature; proof generated in an isolated browser worker; verification receipt signed by the verifier service.
- Add a **drawings list** (figures to include) and an **abstract** (≤ 150 words).

**`prior-art-notes.md`:** a structured table of closest known systems (including Iden3/Polygon ID, which already uses SMT revocation, Semaphore, Sismo, AnonCreds, BBS+, SD-JWT, Blockcerts, EBSI) with: what it does, what it does not do, and which of our contributions it threatens. Include search strings for Google Patents and Espacenet. Be candid: where a contribution is likely weak, say so and propose narrowing the claim to the specific combination.

---

## 12. Deliverables map (original requirements → where they live)

| #   | Requirement                                         | Location                                                     |
| --- | --------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Full project report, all chapters                   | `docs/report/` (Phase 12)                                    |
| 2   | System architecture and component explanation       | `docs/ARCHITECTURE.md`, report chapter 4                     |
| 3   | Solidity contracts (registry, issuer, revocation)   | `packages/contracts` (Phases 1, 9)                           |
| 4   | Circom selective-disclosure circuit and explanation | `packages/circuits` (Phases 3, 9), report chapter 7          |
| 5   | Frontend and backend structure                      | `apps/web`, `apps/api` (Phases 4–8)                          |
| 6   | Step-by-step implementation guide                   | `docs/PROGRESS.md` plus `README.md`, derived from the phases |
| 7   | On-chain vs off-chain data design                   | Section 5.5, report chapter 4, Prisma schema                 |
| 8   | Testing strategy and sample test cases              | Per-phase exit criteria, `e2e/`, report chapter 9            |
| 9   | Patent novelty points (4–6)                         | `docs/patent/novelty.md`                                     |
| 10  | Patent claim structure                              | `docs/patent/claims.md`                                      |
| 11  | 4–6 month timeline                                  | `docs/report/` timeline appendix                             |
| 12  | Future enhancements                                 | Report chapter 11                                            |

**Suggested calendar mapping (5 months):** Month 1 = Phases 0–2; Month 2 = Phase 3–4; Month 3 = Phases 5–7; Month 4 = Phases 8–9; Month 5 = Phases 10–12.

**Future enhancements to document (not to build now):** BBS+ and SD-JWT interoperability; recursive proofs and proof aggregation; PLONK/Halo2 to avoid circuit-specific setup; account abstraction and meta-transactions for gasless issuance; ZK-rollup anchoring (Polygon zkEVM, Base, Scroll); decentralized issuer governance (DAO) and trust frameworks (EBSI-style); mobile native wallet with secure enclave; multi-document composite proofs; offline verification with signed state checkpoints; DIDComm v2 transport; post-quantum considerations.

---

## 13. Final instruction

Begin with **Phase 0** now. Do not read ahead and implement later phases. When Phase 0 is complete, print the Phase Report and wait for my "proceed".
