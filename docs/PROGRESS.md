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

**Status:** 🔲 Not started

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
